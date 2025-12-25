import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyBbbdc2E3I_PMAF0eyZq_HK7Qdjz_3Xbw8",
  authDomain: "elitdroszt-597f4.firebaseapp.com",
  projectId: "elitdroszt-597f4",
  storageBucket: "elitdroszt-597f4.firebasestorage.app",
  messagingSenderId: "652103280844",
  appId: "1:652103280844:web:86f21e7800bf0cbeb17a69",
  measurementId: "G-W0GH2HRP1V"
};

const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence: Platform.OS === 'web'
    ? browserLocalPersistence
    : getReactNativePersistence(AsyncStorage)
});

const db = getFirestore(app);

export { auth, db };
