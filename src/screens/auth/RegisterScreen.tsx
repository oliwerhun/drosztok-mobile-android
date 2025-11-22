import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { Picker } from '@react-native-picker/picker';

export default function RegisterScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [callsign, setCallsign] = useState('');
  const [password, setPassword] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [userType, setUserType] = useState<'' | 'Taxi' | 'Kombi Taxi' | 'VIP' | 'VIP Kombi' | 'V-Osztály'>('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    // Validations
    if (!email.trim() || !callsign.trim() || !password || !licensePlate.trim() || !userType) {
      Alert.alert('Hiba', 'Kérlek töltsd ki az összes mezőt!');
      return;
    }

    if (!/^\d{3}$/.test(callsign)) {
      Alert.alert('Hiba', 'Az URH számnak pontosan 3 számból kell állnia.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Hiba', 'A jelszónak legalább 6 karakter hosszúnak kell lennie.');
      return;
    }

    const plateUpper = licensePlate.toUpperCase().replace(/\s/g, '');
    if (!/^[A-Z0-9]{6,7}$/.test(plateUpper)) {
      Alert.alert('Hiba', 'Érvénytelen rendszám formátum. Helyes: ABC123 vagy ABCD123');
      return;
    }

    setLoading(true);
    try {
      // Check if callsign already exists
      const profilesRef = collection(db, 'profiles');
      const callsignQuery = query(profilesRef, where('username', '==', callsign));
      const existingCallsigns = await getDocs(callsignQuery);

      if (!existingCallsigns.empty) {
        Alert.alert('Hiba', 'Ez az URH szám már foglalt. Válassz másikat.');
        setLoading(false);
        return;
      }

      // Check if this is the first user
      const allProfiles = await getDocs(profilesRef);
      const isFirstUser = allProfiles.empty;

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Auto enable 213 for VIP/VIP Kombi
      const canSee213Auto = userType === 'VIP' || userType === 'VIP Kombi';

      // Create Firestore profile
      await setDoc(doc(db, 'profiles', user.uid), {
        email: email.trim(),
        username: callsign,
        licensePlate: plateUpper,
        userType: userType,
        status: isFirstUser ? 'approved' : 'pending',
        role: isFirstUser ? 'admin' : 'user',
        canSee213: canSee213Auto,
      });

      // Success - AuthContext will handle navigation
    } catch (error: any) {
      console.error('Register error:', error);
      Alert.alert('Regisztrációs hiba', getErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'Ez az email cím már használatban van.';
      case 'auth/invalid-email':
        return 'Érvénytelen email cím.';
      case 'auth/weak-password':
        return 'A jelszó túl gyenge.';
      default:
        return 'Ismeretlen hiba történt.';
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>DROSZTOK</Text>
        <Text style={styles.subtitle}>Regisztráció</Text>

        <TextInput
          style={styles.input}
          placeholder="Email cím"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="URH Szám (3 számjegy)"
          value={callsign}
          onChangeText={setCallsign}
          keyboardType="number-pad"
          maxLength={3}
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Jelszó (min. 6 karakter)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Rendszám (pl. ABC123)"
          value={licensePlate}
          onChangeText={setLicensePlate}
          autoCapitalize="characters"
          editable={!loading}
        />

        <View style={[styles.pickerContainer, !userType && styles.pickerPlaceholder]}>
          <Picker
            selectedValue={userType}
            onValueChange={(value) => {
              if (value !== '') {
                setUserType(value);
              }
            }}
            enabled={!loading}
            style={styles.picker}
          >
            <Picker.Item label="Válassz..." value="" color="#999" />
            <Picker.Item label="Taxi" value="Taxi" />
            <Picker.Item label="Kombi Taxi" value="Kombi Taxi" />
            <Picker.Item label="VIP" value="VIP" />
            <Picker.Item label="VIP Kombi" value="VIP Kombi" />
            <Picker.Item label="V-Osztály" value="V-Osztály" />
          </Picker>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Regisztráció</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          disabled={loading}
        >
          <Text style={styles.linkText}>
            Van már fiókod? Jelentkezz be!
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4f46e5',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  pickerPlaceholder: {
    // Optional: add a visual indicator when no selection is made
  },
  picker: {
    height: 50,
  },
  button: {
    backgroundColor: '#4f46e5',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkText: {
    color: '#4f46e5',
    textAlign: 'center',
    fontSize: 14,
  },
});
