import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiRequest } from '../services/api';

export default function SignupScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!name || !email || !password) {
      Alert.alert('Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest('/signup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });

      if (response?.user) {
        await SecureStore.setItemAsync('user', JSON.stringify(response.user));
        Alert.alert('Account created', 'Welcome!');
        navigation.replace('Main', {
          screen: 'Dashboard',
          params: {
            user: response.user,
            roomCode: response.joinedRoom?.room_code || response.user?.room_code || null
          }
        });
      }
    } catch (error) {
      Alert.alert('Signup failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Join the experience</Text>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Start splitting expenses beautifully.</Text>
        <TextInput style={styles.input} placeholder="Name" placeholderTextColor="#94a3b8" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#94a3b8" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#94a3b8" secureTextEntry value={password} onChangeText={setPassword} />
        <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Creating account...' : 'Sign up'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Already have an account?</Text>
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
    shadowColor: '#f472b6',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#f472b6',
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
    backgroundColor: '#f472b6',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#f472b6',
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
