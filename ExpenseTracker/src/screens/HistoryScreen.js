import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Modal, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from '../services/api';

export default function HistoryScreen() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expensesList, setExpensesList] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProof, setSelectedProof] = useState(null);
  const [expandedPayers, setExpandedPayers] = useState({});
  const [roomCode, setRoomCode] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedUser = await SecureStore.getItemAsync('user');
        if (storedUser) {
          setCurrentUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.log('Failed to load user for history', error.message);
      }

      try {
        const storedRoom = await SecureStore.getItemAsync('activeRoom');
        if (storedRoom) {
          const room = JSON.parse(storedRoom);
          setRoomCode(room.room_code || null);
        }
      } catch (error) {
        console.log('Failed to load active room for history', error.message);
      }
    };

    loadSession();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (!roomCode) {
        setLoading(false);
        return;
      }

      const loadHistory = async () => {
        setLoading(true);
        try {
          const data = await apiRequest(`/rooms/code/${roomCode}/balances`);
          const expenses = Array.isArray(data?.expenses) ? data.expenses : [];
          const summaryMap = new Map();

          expenses.forEach((expense) => {
            const amount = Number(expense.amount || 0);
            if (expense.paid_by) {
              const existing = summaryMap.get(expense.paid_by) || { paid: 0, share: 0 };
              summaryMap.set(expense.paid_by, { ...existing, paid: existing.paid + amount });
            }

            const splits = Array.isArray(expense.expense_splits) ? expense.expense_splits : [];
            splits.forEach((split) => {
              const key = split.user_id || `email:${split.email || ''}`;
              if (!key) return;
              const existing = summaryMap.get(key) || { paid: 0, share: 0 };
              summaryMap.set(key, { ...existing, share: existing.share + Number(split.amount || 0) });
            });
          });

          const rows = Array.from(summaryMap.entries()).map(([key, value]) => {
            const label = key === currentUser?.id
              ? 'You'
              : key.startsWith('email:')
                ? key.replace('email:', '')
                : `User ${String(key).slice(0, 8)}`;

            return {
              key,
              label,
              paid: Number(value.paid || 0),
              share: Number(value.share || 0),
              net: Number(value.paid || 0) - Number(value.share || 0)
            };
          });

          rows.sort((a, b) => b.net - a.net);
          setHistory(rows);
          setExpensesList(expenses);
        } catch (error) {
          console.log('Failed to load history', error.message);
        } finally {
          setLoading(false);
        }
      };

      loadHistory();
    }, [roomCode, currentUser?.id])
  );

  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.title}>History & Balances</Text>
        <Text style={styles.subtitle}>See who paid, who owes, and who should receive.</Text>
      </View>

      {!roomCode ? (
        <Text style={styles.emptyText}>Select a room first from the dashboard to view history.</Text>
      ) : null}

      {loading ? (
        <ActivityIndicator size="large" color="#a855f7" />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {history.length === 0 ? (
            <Text style={styles.emptyText}>No expenses yet for this room.</Text>
          ) : (
            history.map((row) => {
              const isOwed = row.net < 0;
              return (
                <View key={row.key} style={styles.card}>
                  <Text style={styles.name}>{row.label}</Text>
                  <View style={styles.row}>
                    <Text style={styles.label}>Paid</Text>
                    <Text style={styles.value}>₹ {row.paid.toFixed(2)}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Share</Text>
                    <Text style={styles.value}>₹ {row.share.toFixed(2)}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.label}>Net</Text>
                    <Text style={[styles.value, isOwed ? styles.owe : styles.receive]}>
                      {isOwed ? `Owes ₹ ${Math.abs(row.net).toFixed(2)}` : `Receives ₹ ${row.net.toFixed(2)}`}
                    </Text>
                  </View>
                </View>
              );
            })
          )}

          <View style={{ marginTop: 12 }}>
            <Text style={styles.sectionTitle}>Proofs</Text>
            {expensesList.filter(e => e.image_url).length === 0 ? (
              <Text style={styles.emptyText}>No proofs uploaded for this room.</Text>
            ) : (
              (() => {
                const proofs = expensesList.filter(e => e.image_url);
                const grouped = proofs.reduce((acc, e) => {
                  const payer = e.paid_by_email || e.paid_by || 'Unknown';
                  if (!acc[payer]) acc[payer] = [];
                  acc[payer].push(e);
                  return acc;
                }, {});

                return Object.entries(grouped).map(([payer, exps]) => (
                  <View key={payer} style={[styles.card, { paddingVertical: 8 }]}>
                    <TouchableOpacity onPress={() => setExpandedPayers((s) => ({ ...s, [payer]: !s[payer] }))}>
                      <Text style={styles.proofTitle}>{payer} <Text style={styles.proofCount}>({exps.length})</Text></Text>
                    </TouchableOpacity>
                    {expandedPayers[payer] ? (
                      <View style={{ marginTop: 8 }}>
                        {exps.map((exp) => (
                          <View key={exp.id || exp.image_url} style={{ marginBottom: 10 }}>
                            <Text style={styles.proofText}>{exp.description || 'Expense'}</Text>
                            <Text style={styles.proofMeta}>{new Date(exp.created_at).toLocaleString()}</Text>
                            <TouchableOpacity onPress={() => { setSelectedProof(exp.image_url); setModalVisible(true); }} style={{ marginTop: 6 }}>
                              <Text style={styles.viewProof}>View proof</Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ));
              })()
            )}
          </View>

          <Modal visible={modalVisible} transparent animationType="slide">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{ position: 'absolute', top: 40, right: 20 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Close</Text>
              </TouchableOpacity>
              {selectedProof ? (
                <Image source={{ uri: selectedProof }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />
              ) : (
                <Text style={{ color: '#fff' }}>No proof selected</Text>
              )}
            </View>
          </Modal>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#050505' },
  heroCard: {
    backgroundColor: '#111111',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2a2a2a'
  },
  title: { fontSize: 24, fontWeight: '800', color: '#f8fafc', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 6 },
  emptyText: { color: '#94a3b8', fontSize: 14, marginTop: 8 },
  card: { backgroundColor: '#111111', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  name: { fontSize: 16, fontWeight: '700', color: '#f8fafc', marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  label: { color: '#94a3b8' },
  value: { fontWeight: '600', color: '#f8fafc' },
  owe: { color: '#fb7185' },
  receive: { color: '#34d399' },
  sectionTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 16, marginBottom: 8 },
  proofTitle: { fontWeight: '800', fontSize: 16, color: '#f8fafc' },
  proofCount: { color: '#94a3b8', fontWeight: '600' },
  proofText: { color: '#f8fafc', fontWeight: '600' },
  proofMeta: { color: '#94a3b8', fontSize: 12 },
  viewProof: { color: '#f472b6', fontWeight: '700' }
});
