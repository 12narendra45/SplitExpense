import React, { useEffect, useState, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from '../services/api';

export default function DashboardScreen({ navigation, route }) {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const user = route?.params?.user || null;
  const roomCode = activeRoom?.room_code || route?.params?.roomCode || user?.room_code || null;

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('user');
    await SecureStore.deleteItemAsync('activeRoom');
    navigation.replace('Login');
  };

  const settleRoom = async () => {
    if (!activeRoom || !activeRoom.id) {
      Alert.alert('No active room', 'Select or join a room first');
      return;
    }

    Alert.alert(
      'Settle room',
      'This will clear all expenses in the room and reset balances to zero. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const resp = await apiRequest(`/rooms/${activeRoom.id}/settle`, { method: 'POST' });
              Alert.alert('Settled', `Cleared ${resp.deleted || 0} expenses`);
              await loadRooms();
              try {
                const data = await apiRequest(`/rooms/code/${roomCode}/balances`);
                setBalances(data.expenses || []);
              } catch (e) {
                console.log('Failed to refresh balances after settle', e.message);
              }
            } catch (err) {
              Alert.alert('Settle failed', err.message || String(err));
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Logout</Text>
        </TouchableOpacity>
      ),
      headerTitle: 'Dashboard',
      headerStyle: {
        backgroundColor: '#ffffff',
        shadowColor: '#e2e8f0',
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 2
      },
      headerTintColor: '#111827',
      headerTitleStyle: { color: '#111827', fontWeight: '800' },
      headerShadowVisible: false
    });
  }, [navigation, handleLogout]);

  const loadRooms = async () => {
    if (!user) return;

    try {
      const response = await apiRequest(`/rooms?user_id=${user.id}&email=${encodeURIComponent(user.email)}`);
      const availableRooms = response.rooms || [];
      setRooms(availableRooms);
      if (!activeRoom && availableRooms.length > 0) {
        setActiveRoom(availableRooms[0]);
        try {
          SecureStore.setItemAsync('activeRoom', JSON.stringify({ id: availableRooms[0].id, room_code: availableRooms[0].room_code, name: availableRooms[0].name }));
        } catch (e) {
          console.log('Failed to persist active room', e.message);
        }
      }
    } catch (error) {
      console.log('Failed to load rooms', error.message);
    }
  };

  const selectRoom = (room) => {
    setActiveRoom(room);
    try {
      SecureStore.setItemAsync('activeRoom', JSON.stringify({ id: room.id, room_code: room.room_code, name: room.name }));
    } catch (e) {
      console.log('Failed to persist active room', e.message);
    }
  };

  const refreshDashboard = React.useCallback(async () => {
    setRefreshing(true);

    try {
      await loadRooms();

      if (!roomCode) {
        setBalances([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const data = await apiRequest(`/rooms/code/${roomCode}/balances`);
      setBalances(data.expenses || []);
    } catch (error) {
      console.log('Failed to refresh dashboard', error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roomCode, user]);

  useFocusEffect(
    React.useCallback(() => {
      refreshDashboard();
      return () => {};
    }, [refreshDashboard])
  );

  useEffect(() => {
    loadRooms();
  }, [user]);

  useEffect(() => {
    const loadBalances = async () => {
      if (!roomCode) {
        setLoading(false);
        return;
      }

      try {
        const data = await apiRequest(`/rooms/code/${roomCode}/balances`);
        setBalances(data.expenses || []);
      } catch (error) {
        console.log(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadBalances();
  }, [roomCode]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refreshDashboard}
          colors={['#a855f7']}
          tintColor="#a855f7"
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <Text style={styles.title}>Room Expense Dashboard</Text>
        <Text style={styles.subtitle}>See your split balance and room activity</Text>
        <Text style={styles.roomCodeText}>Room code: {roomCode || 'No room joined yet'}</Text>
      </View>

      <View style={styles.roomListContainer}>
        <Text style={styles.sectionTitle}>Your rooms</Text>
        {rooms.length === 0 ? (
          <Text style={styles.emptyText}>No rooms found yet.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roomScroll}>
            {rooms.map((room) => (
              <TouchableOpacity
                key={room.id}
                style={[
                  styles.roomCard,
                  activeRoom?.id === room.id ? styles.roomCardActive : null
                ]}
                onPress={() => selectRoom(room)}
              >
                <Text style={styles.roomName}>{room.name}</Text>
                <Text style={styles.roomCode}>{room.room_code}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {activeRoom ? (
        <TouchableOpacity style={styles.buttonSecondary} onPress={settleRoom}>
          <Text style={styles.buttonText}>Settle room</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your balance</Text>
        <Text style={styles.amount}>₹ {balances.reduce((sum, item) => {
            const share = item.expense_splits?.find(s => s.user_id === user?.id)?.amount;
            return sum + Number(share || 0);
          }, 0)}</Text>
        <Text style={styles.cardText}>Your split share for room activities</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your total spent</Text>
        <Text style={styles.amount}>₹ {balances.reduce((sum, item) => {
            const paidByYou = item.paid_by === user?.id;
            return sum + (paidByYou ? Number(item.amount || 0) : 0);
          }, 0)}</Text>
        <Text style={styles.cardText}>Total amount you paid for this room</Text>
      </View>

      {loading ? <ActivityIndicator size="large" color="#7c3aed" /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505'
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40
  },
  heroCard: {
    backgroundColor: '#111111',
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    shadowColor: '#a855f7',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 6
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 6
  },
  roomCodeText: {
    fontSize: 13,
    color: '#f472b6',
    fontWeight: '700'
  },
  card: {
    backgroundColor: '#111111',
    padding: 18,
    borderRadius: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    shadowColor: '#a855f7',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  cardTitle: {
    fontSize: 15,
    color: '#cbd5e1',
    fontWeight: '600'
  },
  amount: {
    fontSize: 30,
    fontWeight: '800',
    marginTop: 8,
    color: '#f8fafc'
  },
  cardText: {
    marginTop: 8,
    color: '#94a3b8'
  },
  buttonSecondary: {
    backgroundColor: '#a855f7',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#a855f7',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700'
  },
  roomListContainer: {
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
    color: '#f8fafc'
  },
  roomScroll: {
    marginBottom: 8
  },
  roomCard: {
    backgroundColor: '#171717',
    padding: 14,
    borderRadius: 14,
    marginRight: 10,
    minWidth: 140,
    borderWidth: 1,
    borderColor: '#333333'
  },
  roomCardActive: {
    borderColor: '#a855f7',
    backgroundColor: '#1f1035'
  },
  roomName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    color: '#f8fafc'
  },
  roomCode: {
    color: '#94a3b8'
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14
  },
  headerButton: {
    marginRight: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#fdf2f8',
    borderWidth: 1,
    borderColor: '#f5c8e3'
  },
  headerButtonText: {
    color: '#be185d',
    fontWeight: '700'
  }
});
