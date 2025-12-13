import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth'; // Added signOut
import { doc, getDoc, onSnapshot } from 'firebase/firestore'; // Added onSnapshot
import { auth, db } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Added AsyncStorage
import { Alert } from 'react-native'; // Added Alert
import { UserProfile } from '../types';
import { checkoutFromAllLocations } from '../services/LocationService'; // Added for session mismatch

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  refreshProfile: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // console.log('AuthContext: useEffect started');

    // 1. Auth State Listener
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          const profileRef = doc(db, 'profiles', firebaseUser.uid);
          const profileSnap = await getDoc(profileRef);

          if (profileSnap.exists()) {
            setUserProfile({ uid: firebaseUser.uid, ...profileSnap.data() } as UserProfile);
          } else {
            setUserProfile(null);
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    // 2. Session Monitor Listener
    let unsubscribeProfile: () => void;

    if (user) {
      const profileRef = doc(db, 'profiles', user.uid);
      unsubscribeProfile = onSnapshot(profileRef, async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const remoteSessionId = data.sessionId;

          if (remoteSessionId) {
            const localSessionId = await AsyncStorage.getItem('sessionId');
            // If local session exists but differs from remote, it means a newer login happened elsewhere
            if (localSessionId && localSessionId !== remoteSessionId) {
              console.log("Session Mismatch! Logging out.");

              // Checkout from all locations before logging out
              await checkoutFromAllLocations(user.uid, data as UserProfile);

              Alert.alert("Biztonsági Figyelmeztetés", "Bejelentkeztél egy másik eszközön. Ezen az eszközön kiléptettünk a sorból.");
              await signOut(auth);
              await AsyncStorage.removeItem('sessionId');
            }
          }
        }
      });
    }

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [user]); // Re-run effect when user changes to set up/tear down profile listener

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const profileRef = doc(db, 'profiles', user.uid);
      const profileSnap = await getDoc(profileRef);

      if (profileSnap.exists()) {
        setUserProfile({ uid: user.uid, ...profileSnap.data() } as UserProfile);
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  };

  const value = useMemo(() => ({
    user, userProfile, loading, refreshProfile
  }), [user, userProfile, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
