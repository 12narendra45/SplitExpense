import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { apiRequest } from '../services/api';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const data = await apiRequest('/rooms/1/notifications');
        setNotifications(data.notifications || []);
      } catch (error) {
        console.log(error.message);
      } finally {
        setLoading(false);
      }
    };

    loadNotifications();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>
      {loading ? <ActivityIndicator size="large" color="#2563eb" /> : null}
      <FlatList
        data={notifications}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text>{item.message}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f5f7fb' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  item: { backgroundColor: '#fff', padding: 14, borderRadius: 12, marginBottom: 10 }
});
