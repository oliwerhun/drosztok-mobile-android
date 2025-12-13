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
  Modal,
  ActionSheetIOS,
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { useTheme } from '../../context/ThemeContext'; // Import hozzáadása
import Ionicons from '@expo/vector-icons/Ionicons';

export default function RegisterScreen({ navigation }: any) {
  const { colors } = useTheme(); // Theme hook
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [callsign, setCallsign] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [licensePlate, setLicensePlate] = useState('');
  const [userType, setUserType] = useState<'' | 'Taxi' | 'Kombi Taxi' | 'VIP' | 'VIP Kombi' | 'V-Osztály'>('');
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const handleRegister = async () => {
    // ... logic remains same ...
    // Validations
    if (!email.trim() || !confirmEmail.trim() || !callsign.trim() || !password || !confirmPassword || !licensePlate.trim() || !userType) {
      Alert.alert('Hiba', 'Kérlek töltsd ki az összes mezőt!');
      return;
    }

    if (email.trim() !== confirmEmail.trim()) {
      Alert.alert('Hiba', 'A két email cím nem egyezik meg.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Hiba', 'A két jelszó nem egyezik meg.');
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

  const handleTypeSelection = () => {
    if (Platform.OS === 'ios') {
      // iOS natív ActionSheet
      const options = ['Mégse', 'Taxi', 'Kombi Taxi', 'VIP', 'VIP Kombi', 'V-Osztály'];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 0,
          title: 'Válassz típust',
          userInterfaceStyle: 'dark', // Kövesse a témát, de itt nem tudjuk könnyen átadni, de alapból követi
        },
        (buttonIndex) => {
          if (buttonIndex !== 0) {
            setUserType(options[buttonIndex] as any);
          }
        }
      );
    } else {
      // Android - modal megoldás
      setShowPicker(true);
    }
  };

  const getErrorMessage = (code: string) => {
    // ... logic remains same ...
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
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[styles.title, { color: colors.primary || '#4f46e5' }]}>DROSZTOK</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Regisztráció</Text>

        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
            (email.length > 0 && confirmEmail.length > 0 && email !== confirmEmail) && { borderColor: '#ef4444', borderWidth: 1.5 }
          ]}
          placeholder="Email cím"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />

        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.card, color: colors.text, borderColor: colors.border },
            (email.length > 0 && confirmEmail.length > 0 && email !== confirmEmail) && { borderColor: '#ef4444', borderWidth: 1.5 }
          ]}
          placeholder="Email cím megerősítése"
          placeholderTextColor={colors.textSecondary}
          value={confirmEmail}
          onChangeText={setConfirmEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />

        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder="URH Szám (3 számjegy)"
          placeholderTextColor={colors.textSecondary}
          value={callsign}
          onChangeText={setCallsign}
          keyboardType="number-pad"
          maxLength={3}
          editable={!loading}
        />

        <View style={[
          styles.passwordContainer,
          { backgroundColor: colors.card, borderColor: colors.border },
          (password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword) && { borderColor: '#ef4444', borderWidth: 1.5 }
        ]}>
          <TextInput
            style={[styles.passwordInput, { color: colors.text }]}
            placeholder="Jelszó (min. 6 karakter)"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            editable={!loading}
            textContentType="password"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={[
          styles.passwordContainer,
          { backgroundColor: colors.card, borderColor: colors.border },
          (password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword) && { borderColor: '#ef4444', borderWidth: 1.5 }
        ]}>
          <TextInput
            style={[styles.passwordInput, { color: colors.text }]}
            placeholder="Jelszó megerősítése"
            placeholderTextColor={colors.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            editable={!loading}
            textContentType="password"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder="Rendszám (pl. ABC123)"
          placeholderTextColor={colors.textSecondary}
          value={licensePlate}
          onChangeText={setLicensePlate}
          autoCapitalize="characters"
          editable={!loading}
        />

        <View>
          <TouchableOpacity
            style={[styles.pickerButton, !userType && styles.pickerPlaceholder, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleTypeSelection}
            disabled={loading}
          >
            <Text style={[styles.pickerButtonText, !userType && { color: colors.textSecondary }, userType && { color: colors.text }]}>
              {userType || 'Válassz típust...'}
            </Text>
            <Ionicons
              name="chevron-down"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {/* Android Modal Picker */}
          {Platform.OS === 'android' && showPicker && (
            <View style={[styles.pickerDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ScrollView style={styles.pickerScrollView}>
                {['Taxi', 'Kombi Taxi', 'VIP', 'VIP Kombi', 'V-Osztály'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.pickerItem,
                      userType === type && { backgroundColor: (colors.background || '#eef2ff') },
                      { borderBottomColor: colors.border }
                    ]}
                    onPress={() => {
                      setUserType(type as any);
                      setShowPicker(false);
                    }}
                  >
                    <Text style={[
                      styles.pickerItemText,
                      { color: colors.text },
                      userType === type && { color: (colors.primary || '#4f46e5'), fontWeight: '600' }
                    ]}>
                      {type}
                    </Text>
                    {userType === type && (
                      <Ionicons name="checkmark" size={20} color={colors.primary || '#4f46e5'} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled, { backgroundColor: colors.primary || '#4f46e5' }]}
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
          <Text style={[styles.linkText, { color: colors.primary || '#4f46e5' }]}>
            Van már fiókod? Jelentkezz be!
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView >
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
    color: '#1f2937', // Ensure text is visible
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#1f2937', // Ensure text is visible
  },
  eyeIcon: {
    padding: 12,
  },
  pickerButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#1f2937',
  },
  pickerPlaceholder: {
    // Optional styling for placeholder state
  },
  pickerPlaceholderText: {
    color: '#9ca3af',
  },
  pickerDropdown: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginTop: -8,
    marginBottom: 12,
    maxHeight: 200,
    overflow: 'hidden',
  },
  pickerScrollView: {
    maxHeight: 200,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pickerItemSelected: {
    backgroundColor: '#eef2ff',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#1f2937',
  },
  pickerItemTextSelected: {
    color: '#4f46e5',
    fontWeight: '600',
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
