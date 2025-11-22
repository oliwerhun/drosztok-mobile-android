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
  Modal,
} from 'react-native';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../config/firebase';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Hiba', 'Kérlek töltsd ki az összes mezőt!');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // Navigation handled by AuthContext
    } catch (error: any) {
      console.error('Login error:', error);
      Alert.alert('Bejelentkezési hiba', getErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordPress = () => {
    setResetEmail(email); // Pre-fill with login email if available
    setShowResetModal(true);
  };

  const handleSendResetEmail = async () => {
    if (!resetEmail.trim()) {
      Alert.alert('Hiba', 'Add meg az email címed!');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setShowResetModal(false);
      Alert.alert(
        'Email elküldve!',
        'Jelszó visszaállító email elküldve! Ellenőrizd a postaládád.'
      );
      setResetEmail('');
    } catch (error: any) {
      console.error('Password reset error:', error);
      Alert.alert('Hiba', getPasswordResetErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Hibás email cím vagy jelszó.';
      case 'auth/too-many-requests':
        return 'Túl sok próbálkozás. Próbáld újra később.';
      default:
        return 'Ismeretlen hiba történt.';
    }
  };

  const getPasswordResetErrorMessage = (code: string) => {
    switch (code) {
      case 'auth/user-not-found':
        return 'Nem található felhasználó ezzel az email címmel.';
      case 'auth/invalid-email':
        return 'Érvénytelen email cím.';
      default:
        return 'Hiba történt. Próbáld újra később.';
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>DROSZTOK</Text>
        <Text style={styles.subtitle}>Bejelentkezés</Text>

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
          placeholder="Jelszó"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Bejelentkezés</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleForgotPasswordPress}
          disabled={loading}
          style={styles.forgotPassword}
        >
          <Text style={styles.forgotPasswordText}>
            Elfelejtett jelszó?
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Register')}
          disabled={loading}
        >
          <Text style={styles.linkText}>
            Nincs még fiókod? Regisztrálj!
          </Text>
        </TouchableOpacity>
      </View>

      {/* Password Reset Modal */}
      <Modal
        visible={showResetModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Jelszó visszaállítás</Text>
            <Text style={styles.modalDescription}>
              Add meg az email címed és küldünk egy visszaállító linket.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Email cím"
              value={resetEmail}
              onChangeText={setResetEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              editable={!loading}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowResetModal(false);
                  setResetEmail('');
                }}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Mégse</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.sendButton, loading && styles.buttonDisabled]}
                onPress={handleSendResetEmail}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.sendButtonText}>Küldés</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
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
    marginBottom: 40,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#4f46e5',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  forgotPassword: {
    alignItems: 'center',
    marginBottom: 16,
  },
  forgotPasswordText: {
    color: '#4f46e5',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  linkText: {
    color: '#4f46e5',
    textAlign: 'center',
    fontSize: 14,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e5e7eb',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  sendButton: {
    backgroundColor: '#4f46e5',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
