import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from '../services/api';

export default function CreateRoomScreen({ navigation, route }) {
  const [roomName, setRoomName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [memberEmails, setMemberEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(route?.params?.user || null);

  useEffect(() => {
    const loadUser = async () => {
      if (!route?.params?.user) {
        try {
          const stored = await SecureStore.getItemAsync('user');
          if (stored) setUser(JSON.parse(stored));
        } catch (err) {
          console.log('Failed to load user from SecureStore', err.message);
        }
      }
    };
    loadUser();
  }, []);

  const handleAddEmail = async () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) {
      Alert.alert('Enter a valid email');
      return;
    }
    if (memberEmails.includes(email)) {
      Alert.alert('Email already added');
      return;
    }

    try {
      const verify = await apiRequest(`/profiles/exists?email=${encodeURIComponent(email)}`);
      if (!verify.exists) {
        Alert.alert('Email not registered', 'Only users already registered in the app can be added to a room.');
        return;
      }
    } catch (err) {
      Alert.alert('Could not verify email', err.message);
      return;
    }

    setMemberEmails((current) => [...current, email]);
    setEmailInput('');
  };

  const handleCreateRoom = async () => {
    if (!roomName) {
      Alert.alert('Please enter a room name');
      return;
    }

    setLoading(true);
    try {
      const requestBody = {
        name: roomName,
        member_emails: memberEmails
      };
      if (user?.id) {
        requestBody.created_by = user.id;
      }
      if (user?.email) {
        requestBody.created_by_email = user.email;
      }

      const response = await apiRequest('/rooms', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      Alert.alert('Room created', `Code: ${response.room_code}`);
      try {
        await SecureStore.setItemAsync('activeRoom', JSON.stringify({ id: response.room.id, room_code: response.room_code, name: response.room.name }));
      } catch (e) {
        console.log('Failed to persist active room after create', e.message);
      }
      navigation.replace('Main', {
        screen: 'Dashboard',
        params: {
          user: { ...user, room_code: response.room_code },
          roomCode: response.room_code
        }
      });
    } catch (error) {
      Alert.alert('Room creation failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.title}>Create room</Text>
        <Text style={styles.subtitle}>Bring your people together in one place.</Text>
      </View>
      <TextInput style={styles.input} placeholder="Room name" placeholderTextColor="#64748b" value={roomName} onChangeText={setRoomName} />
      <Text style={styles.hint}>Only emails already registered in this app can be added as room members.</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.emailInput]}
          placeholder="Add member email"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          keyboardType="email-address"
          value={emailInput}
          onChangeText={setEmailInput}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddEmail}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      {memberEmails.length > 0 ? (
        <View style={styles.emailList}>
          {memberEmails.map((email) => (
            <Text key={email} style={styles.emailItem}>
              {email}
            </Text>
          ))}
        </View>
      ) : null}

      <TouchableOpacity style={styles.button} onPress={handleCreateRoom} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Create room'}</Text>
      </TouchableOpacity>
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
  subtitle: { fontSize: 14, color: '#94a3b8' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  input: { backgroundColor: '#171717', color: '#f8fafc', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#333333' },
  emailInput: { flex: 1, marginRight: 8 },
  addButton: { backgroundColor: '#a855f7', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
  addButtonText: { color: '#fff', fontWeight: '700' },
  emailList: { marginBottom: 12 },
  emailItem: { backgroundColor: '#171717', color: '#f8fafc', borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: '#333333' },
  button: { backgroundColor: '#f472b6', padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '700' },
  hint: { color: '#94a3b8', marginBottom: 12 }
});
