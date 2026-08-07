import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from '../services/api';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      if (response?.user) {
        await SecureStore.setItemAsync('user', JSON.stringify(response.user));
        navigation.replace('Main', {
          screen: 'Dashboard',
          params: {
            user: response.user,
            roomCode: response.joinedRoom?.room_code || response.user?.room_code || null
          }
        });
      }
    } catch (error) {
      Alert.alert('Login failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Welcome back</Text>
        <Text style={styles.title}>Login</Text>
        <Text style={styles.subtitle}>Manage your shared expenses with ease.</Text>
        <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#94a3b8" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#94a3b8" secureTextEntry value={password} onChangeText={setPassword} />
        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Please wait...' : 'Login'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
          <Text style={styles.link}>Create an account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#050505'
  },
  card: {
    backgroundColor: '#111111',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    shadowColor: '#a855f7',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#a855f7',
    fontWeight: '700',
    marginBottom: 6
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 6
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 18
  },
  input: {
    backgroundColor: '#171717',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333333',
    color: '#f8fafc'
  },
  button: {
    backgroundColor: '#a855f7',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#a855f7',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15
  },
  link: {
    marginTop: 16,
    color: '#f472b6',
    textAlign: 'center',
    fontWeight: '600'
  }
});
