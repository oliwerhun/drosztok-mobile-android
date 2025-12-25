import React, { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth'; // Added signOut
import { doc, getDoc, onSnapshot, deleteDoc } from 'firebase/firestore'; // Added onSnapshot
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
  const previousSessionIdRef = useRef<string | null>(null);

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
            const profileData = profileSnap.data();
            setUserProfile({ uid: firebaseUser.uid, ...profileData } as UserProfile);

            // ✅ Save USER_ID and IS_ADMIN to AsyncStorage for background location tracking
            await AsyncStorage.setItem('USER_ID', firebaseUser.uid);
            await AsyncStorage.setItem('IS_ADMIN', profileData.role === 'admin' ? 'true' : 'false');

            console.log('✅ [AuthContext] USER_ID saved to AsyncStorage for background tracking');
          } else {
            setUserProfile(null);
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
        // Clear AsyncStorage on logout (redundant safety, DashboardScreen already does this)
        await AsyncStorage.removeItem('USER_ID');
        await AsyncStorage.removeItem('IS_ADMIN');
        console.log('[AuthContext] USER_ID removed from AsyncStorage (logged out)');
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

          // Only check if sessionId actually changed
          if (remoteSessionId && remoteSessionId !== previousSessionIdRef.current) {
            console.log('🔐 [SESSION] SessionId changed, checking validity');
            previousSessionIdRef.current = remoteSessionId;

            const localSessionId = await AsyncStorage.getItem('sessionId');

            // Wait 2 seconds to avoid race condition with login sessionId update
            // This prevents false positive "logged in on another device" alert
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Re-check after delay
            const updatedLocalSessionId = await AsyncStorage.getItem('sessionId');

            // If local session exists but differs from remote, it means a newer login happened elsewhere
            if (updatedLocalSessionId && updatedLocalSessionId !== remoteSessionId) {
              console.log("Session Mismatch! Logging out.");

              // Checkout from all locations before logging out
              await checkoutFromAllLocations(user.uid, data as UserProfile);

              // Delete driver location to remove from map
              const locationRef = doc(db, 'driver_locations', user.uid);
              await deleteDoc(locationRef);
              console.log('Session Mismatch: Removed driver location from map');

              Alert.alert("Biztonsági Figyelmeztetés", "Bejelentkeztél egy másik eszközön. Ezen az eszközön kiléptettünk a sorból.");
              await signOut(auth);
              await AsyncStorage.removeItem('sessionId');
            } else {
              console.log('✅ [SESSION] Session ID matches, continuing');
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
