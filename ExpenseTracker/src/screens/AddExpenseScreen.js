import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Image, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, apiRequest } from '../services/api';

export default function AddExpenseScreen({ navigation, route }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [proof, setProof] = useState(null);
  const [proofName, setProofName] = useState(null);
  const [proofType, setProofType] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userState, setUserState] = useState(route?.params?.user || null);
  const [roomCode, setRoomCode] = useState(route?.params?.roomCode || route?.params?.user?.room_code || null);
  const [roomName, setRoomName] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);

  useEffect(() => {
    const init = async () => {
      // load stored user if route didn't provide one
      let currentUser = route?.params?.user || null;
      try {
        if (!currentUser) {
          const storedUser = await SecureStore.getItemAsync('user');
          if (storedUser) currentUser = JSON.parse(storedUser);
        }
      } catch (e) {
        console.log('Failed to read stored user', e.message);
      }
      setUserState(currentUser);

      // load active room
      try {
        const stored = await SecureStore.getItemAsync('activeRoom');
        if (stored) {
          const r = JSON.parse(stored);
          setRoomCode(r.room_code || r.roomCode || null);
          setRoomName(r.name || null);
        }
      } catch (e) {
        console.log('Failed to read active room', e.message);
      }

      // fetch rooms available to this user
      try {
        if (!currentUser) return;
        const q = `?user_id=${currentUser.id || ''}&email=${encodeURIComponent(currentUser.email || '')}`;
        const res = await fetch(`${API_BASE_URL}/rooms${q}`);
        if (!res.ok) {
          console.log('Failed to fetch rooms', res.status);
          return;
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.rooms || data);
        setRooms(list || []);
      } catch (err) {
        console.log('Error fetching rooms', err.message);
      }
    };

    init();
  }, []);

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera permission required');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7
    });

    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      const assetName = asset.fileName || asset.uri?.split('/').pop() || 'bill.jpg';
      const extension = (assetName.split('.').pop() || 'jpg').toLowerCase();
      const mimeType = asset.type ? `${asset.type}/${extension === 'heic' ? 'jpeg' : extension}` : `image/${extension === 'heic' ? 'jpeg' : extension}`;

      setProof(asset.uri);
      setProofName(assetName.includes('.') ? assetName : `${assetName}.${extension}`);
      setProofType(mimeType);
      setUploadStatus('Proof selected. Ready to upload.');
      setUploadedUrl(null);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Gallery permission required');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7
    });

    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      const assetName = asset.fileName || asset.uri?.split('/').pop() || 'bill.jpg';
      const extension = (assetName.split('.').pop() || 'jpg').toLowerCase();
      const mimeType = asset.type ? `${asset.type}/${extension === 'heic' ? 'jpeg' : extension}` : `image/${extension === 'heic' ? 'jpeg' : extension}`;

      setProof(asset.uri);
      setProofName(assetName.includes('.') ? assetName : `${assetName}.${extension}`);
      setProofType(mimeType);
      setUploadStatus('Proof selected. Ready to upload.');
      setUploadedUrl(null);
    }
  };

  const uploadProof = async () => {
    if (!proof) return null;

    setUploadStatus('Uploading proof...');
    const formData = new FormData();
    const fileName = proofName || proof.split('/').pop() || 'bill.jpg';
    const extension = (fileName.split('.').pop() || 'jpg').toLowerCase();
    const mimeType = proofType || `image/${extension === 'heic' ? 'jpeg' : extension}`;
    const isWebRuntime = Platform.OS === 'web' || (typeof navigator !== 'undefined' && navigator.product !== 'ReactNative');
    console.log('uploadProof debug', { proof, proofName, proofType, mimeType, isWebRuntime });

    // Normalize uri for Android (ensure file:// or content://)
    let fileUri = proof;
    if (Platform.OS === 'android' && typeof fileUri === 'string' && !fileUri.startsWith('file://') && !fileUri.startsWith('content://')) {
      fileUri = `file://${fileUri}`;
    }

    const name = fileName.includes('.') ? fileName : `${fileName}.${extension}`;

    try {
      if (isWebRuntime) {
        const responseFile = await fetch(fileUri);
        const blob = await responseFile.blob();
        formData.append('bill', blob, name);
      } else {
        formData.append('bill', { uri: fileUri, name, type: mimeType });
      }

      const response = await fetch(`${API_BASE_URL}/upload/bill`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorBody = await response.text();
        setUploadStatus('Upload failed');
        throw new Error(errorBody || 'Failed to upload proof');
      }

      const result = await response.json();
      if (result?.url) {
        setUploadedUrl(result.url);
        setUploadStatus('Upload complete. Stored in Supabase bills bucket.');
      } else {
        setUploadStatus('Upload finished, but no URL returned.');
      }

      return result;
    } catch (err) {
      // If React Native fetch complains about unsupported FormData part, try blob fallback (Android content URIs)
      console.log('uploadProof error', err.message);
      if (err.message && err.message.includes('Unsupported FormDataPart implementation')) {
        try {
          const responseFile = await fetch(fileUri);
          const blob = await responseFile.blob();
          const fallbackForm = new FormData();
          fallbackForm.append('bill', blob, name);

          const resp2 = await fetch(`${API_BASE_URL}/upload/bill`, {
            method: 'POST',
            body: fallbackForm
          });

          if (!resp2.ok) {
            const errorBody = await resp2.text();
            setUploadStatus('Upload failed');
            throw new Error(errorBody || 'Failed to upload proof');
          }

          const result2 = await resp2.json();
          if (result2?.url) {
            setUploadedUrl(result2.url);
            setUploadStatus('Upload complete (fallback). Stored in Supabase bills bucket.');
          } else {
            setUploadStatus('Upload finished (fallback), but no URL returned.');
          }

          return result2;
        } catch (err2) {
          setUploadStatus('Upload failed');
          throw err2;
        }
      }

      setUploadStatus('Upload failed');
      throw err;
    }
  };

  const handleSubmit = async () => {
    if (!amount || !reason) {
      Alert.alert('Please fill all fields');
      return;
    }

    if (!userState?.email) {
      Alert.alert('Logged-in user missing');
      return;
    }
    if (!roomCode) {
      Alert.alert('No room joined yet');
      return;
    }

    setLoading(true);
    try {
      let uploaded = null;
      if (proof) {
        uploaded = await uploadProof();
      }

      await apiRequest('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          room_code: roomCode,
          paid_by: userState?.id,
          paid_by_email: userState.email,
          amount: Number(amount),
          category: 'general',
          description: reason,
          image_url: uploaded?.url || proof || null
        })
      });

      Alert.alert('Expense saved', 'Your expense has been sent to the backend.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Failed to save expense', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.title}>Add Expense</Text>
        <Text style={styles.subtitle}>Room: {roomName ? `${roomName} (${roomCode})` : (roomCode || 'Not joined')}</Text>
      </View>

      <Text style={styles.label}>Select room</Text>
      {rooms.length > 0 ? (
        <View>
          <TouchableOpacity style={styles.dropdownToggle} onPress={() => setShowRoomDropdown(!showRoomDropdown)}>
            <Text style={styles.dropdownToggleText}>{roomName ? `${roomName} (${roomCode})` : (roomCode || 'Choose a room')}</Text>
          </TouchableOpacity>
          {showRoomDropdown && (
            <View style={styles.dropdownList}>
              {rooms.map(r => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.dropdownItem, r.room_code === roomCode && styles.dropdownItemSelected]}
                  onPress={async () => {
                    setRoomCode(r.room_code);
                    setRoomName(r.name || null);
                    setShowRoomDropdown(false);
                    try {
                      await SecureStore.setItemAsync('activeRoom', JSON.stringify({ id: r.id, room_code: r.room_code, name: r.name }));
                    } catch (err) {
                      console.log('Failed to persist active room', err.message);
                    }
                  }}
                >
                  <Text style={styles.dropdownText}>{r.name || r.room_code} ({r.room_code})</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ) : (
        <Text style={styles.hint}>No rooms found. Create or join a room in Dashboard.</Text>
      )}
      <Text style={styles.subtitle}>Logged in as: {userState?.email || 'Unknown'}</Text>
      <TextInput style={styles.input} placeholder="Total amount" placeholderTextColor="#64748b" keyboardType="numeric" value={amount} onChangeText={setAmount} />
      <TextInput style={styles.input} placeholder="What was it for?" placeholderTextColor="#64748b" value={reason} onChangeText={setReason} />

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.uploadButton} onPress={handleTakePhoto}>
          <Text style={styles.uploadText}>Take photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.uploadButton} onPress={handlePickImage}>
          <Text style={styles.uploadText}>Pick from gallery</Text>
        </TouchableOpacity>
      </View>

      {uploadStatus ? <Text style={styles.uploadStatus}>{uploadStatus}</Text> : null}

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Save Expense'}</Text>
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
  subtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 6 },
  input: { backgroundColor: '#171717', color: '#f8fafc', borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#333333' },
  uploadButton: { backgroundColor: '#1f1f1f', padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#333333' },
  uploadText: { color: '#f8fafc', fontWeight: '600' },
  button: { backgroundColor: '#a855f7', padding: 14, borderRadius: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  uploadStatus: { fontSize: 14, color: '#f472b6', marginBottom: 8 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
    marginTop: 6,
    marginBottom: 6
  },
  hint: {
    color: '#94a3b8',
    marginBottom: 8
  },
  dropdownToggle: {
    backgroundColor: '#171717',
    borderColor: '#333333',
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 6
  },
  dropdownToggleText: { color: '#f8fafc' },
  dropdownList: { backgroundColor: '#171717', borderRadius: 12, borderWidth: 1, borderColor: '#333333', maxHeight: 220 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#2a2a2a' },
  dropdownItemSelected: { backgroundColor: '#1f1035' },
  dropdownText: { color: '#f8fafc' }
});
