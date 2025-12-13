import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform, KeyboardAvoidingView } from 'react-native';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../config/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot, getDoc, setDoc } from 'firebase/firestore';
import { useTheme } from '../../context/ThemeContext';
import { useFontSize } from '../../context/FontSizeContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { getDistance } from 'geolib';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { checkoutFromAllLocations } from '../../services/LocationService';

// --- GEOFENCE DEFINITIONS ---
const GEOFENCED_LOCATIONS: Record<string, { polygon: { lat: number; lng: number }[] }> = {
  'Akadémia': {
    polygon: [
      { lat: 47.505695, lng: 19.049845 },
      { lat: 47.506827, lng: 19.049527 },
      { lat: 47.507495, lng: 19.055352 },
      { lat: 47.497514, lng: 19.055229 },
      { lat: 47.496632, lng: 19.049139 },
      { lat: 47.492195, lng: 19.051646 },
      { lat: 47.491865, lng: 19.050269 },
      { lat: 47.497717, lng: 19.046456 },
      { lat: 47.505254, lng: 19.044161 }
    ]
  },
  'Csillag': {
    polygon: [
      { lat: 47.562291479921036, lng: 19.02616134628049 },
      { lat: 47.562671208662096, lng: 19.02861431402625 },
      { lat: 47.561288593345246, lng: 19.02919148290761 },
      { lat: 47.56086990686127, lng: 19.027156962600827 }
    ]
  }
};

const isPointInPolygon = (point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]) => {
  let x = point.lat, y = point.lng;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i].lat, yi = polygon[i].lng;
    let xj = polygon[j].lat, yj = polygon[j].lng;
    let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

// Global variable to store last checkout for Undo (Flame) functionality
let lastCheckedOut: any = null;

interface Member {
  uid: string;
  username: string;
  displayName?: string;
  licensePlate?: string;
  userType?: string;
  checkInTime?: string;
}

interface LocationScreenProps {
  locationName: string;
  gpsEnabled?: boolean;
  firestorePath?: string; // optional custom Firestore document path, e.g., 'locations/Reptér'
  membersField?: string; // field inside the document that holds the members array
  geofenceName?: string; // name used to look up geofence polygon, defaults to locationName
}

const LocationScreen: React.FC<LocationScreenProps> = ({
  locationName,
  gpsEnabled = false,
  firestorePath,
  membersField = 'members',
  geofenceName,
}) => {
  // Resolve defaults
  const resolvedFirestorePath = firestorePath || `locations/${locationName}`;
  const resolvedMembersField = membersField;
  const resolvedGeofenceName = geofenceName || locationName;
  const { user, userProfile } = useAuth();
  const { theme, colors } = useTheme();
  const { fontSize } = useFontSize();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [isInsideZone, setIsInsideZone] = useState<boolean | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);

  const insets = useSafeAreaInsets();


  useEffect(() => {
    let unsubscribe: () => void;

    const fetchMembers = async () => {
      try {
        const [collectionName, docId] = resolvedFirestorePath.split('/');
        const locationRef = doc(db, collectionName, docId);

        unsubscribe = onSnapshot(locationRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setMembers(data[resolvedMembersField] || []);
          } else {
            setMembers([]);
          }
          setLoading(false);
        });
      } catch (error) {
        console.error('Error fetching members:', error);
        setLoading(false);
      }
    };

    fetchMembers();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [resolvedFirestorePath, resolvedMembersField]);

  useEffect(() => {
    if (!gpsEnabled) return;

    let locationSubscription: any;

    const startTracking = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setCurrentAddress('Helymeghatározás megtagadva');
          return;
        }

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          async (location) => {
            const { latitude, longitude } = location.coords;

            try {
              const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
              if (reverseGeocode.length > 0) {
                const address = reverseGeocode[0];
                setCurrentAddress(`${address.street || ''} ${address.streetNumber || ''}`);
              }
            } catch (e) {
              console.log("Geocoding error", e);
            }

            if (GEOFENCED_LOCATIONS[resolvedGeofenceName]) {
              const inside = isPointInPolygon({ lat: latitude, lng: longitude }, GEOFENCED_LOCATIONS[resolvedGeofenceName].polygon);
              setIsInsideZone(inside);
            } else {
              setIsInsideZone(true);
            }
          }
        );
      } catch (error) {
        console.error("Location tracking error:", error);
      }
    };

    startTracking();

    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, [resolvedGeofenceName, gpsEnabled]);


  const handleCheckIn = async () => {
    if (!user || checkingIn || !userProfile) return;

    if (gpsEnabled && GEOFENCED_LOCATIONS[resolvedGeofenceName] && isInsideZone === false) {
      Alert.alert("Hiba", "Nem vagy a droszt területén!");
      return;
    }

    setCheckingIn(true);
    try {
      const [collectionName, docId] = resolvedFirestorePath.split('/');
      const locationRef = doc(db, collectionName, docId);

      let displayName = userProfile.username;

      if (userProfile.userType === 'Taxi') displayName += `S - ${userProfile.licensePlate}`;
      else if (userProfile.userType === 'Kombi Taxi') displayName += `SK - ${userProfile.licensePlate}`;
      else if (userProfile.userType === 'V-Osztály') displayName += `V - ${userProfile.licensePlate}`;
      else if (userProfile.userType === 'VIP') displayName += ` - ${userProfile.licensePlate}`;
      else if (userProfile.userType === 'VIP Kombi') displayName += `K - ${userProfile.licensePlate}`;
      else displayName += ` - ${userProfile.licensePlate}`;

      const newMember = {
        uid: user.uid,
        username: userProfile.username,
        displayName: displayName,
        licensePlate: userProfile.licensePlate,
        userType: userProfile.userType,
        checkInTime: new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
      };

      // 1. Global Checkout logic
      await checkoutFromAllLocations(user.uid, userProfile);

      // 2. Main Check-in
      await setDoc(locationRef, { [resolvedMembersField]: arrayUnion(newMember) }, { merge: true });

      // 3. V-Class Double Queue Logic (City locations only)
      if (userProfile.userType === 'V-Osztály' && locationName !== 'Reptér' && locationName !== 'Emirates') {
        const vClassRef = doc(db, 'locations', 'V-Osztály');
        await setDoc(vClassRef, { members: arrayUnion(newMember) }, { merge: true });
      }

      lastCheckedOut = null;

    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert('Hiba', 'Nem sikerült bejelentkezni.');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    if (!user || checkingIn) return;
    setCheckingIn(true);
    try {
      const [collectionName, docId] = resolvedFirestorePath.split('/');
      const locationRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(locationRef);

      if (docSnap.exists()) {
        const currentMembers = docSnap.data()[resolvedMembersField] || [];
        const userIndex = currentMembers.findIndex((m: any) => m.uid === user.uid);

        if (userIndex !== -1) {
          const memberToRemove = currentMembers[userIndex];

          lastCheckedOut = {
            locationName, // Keep for backward compatibility or specific checks
            firestorePath: resolvedFirestorePath,
            membersField: resolvedMembersField,
            memberData: memberToRemove,
            index: userIndex,
            timestamp: Date.now()
          };

          await updateDoc(locationRef, {
            [resolvedMembersField]: arrayRemove(memberToRemove)
          });
        }
      }
    } catch (error) {
      console.error('Check-out error:', error);
      Alert.alert('Hiba', 'Nem sikerült kijelentkezni.');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleFlameClick = async () => {
    if (!user || checkingIn) return;

    if (!lastCheckedOut ||
      lastCheckedOut.memberData.uid !== user.uid ||
      lastCheckedOut.firestorePath !== resolvedFirestorePath ||
      lastCheckedOut.membersField !== resolvedMembersField) {
      Alert.alert('Hiba', 'Nincs visszavonható művelet.');
      return;
    }

    setCheckingIn(true);
    try {
      const [collectionName, docId] = resolvedFirestorePath.split('/');
      const locationRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(locationRef);
      let currentMembers = (docSnap.exists() && docSnap.data()[resolvedMembersField]) ? docSnap.data()[resolvedMembersField] : [];

      if (currentMembers.some((m: any) => m.uid === user.uid)) {
        lastCheckedOut = null;
        setCheckingIn(false);
        return;
      }

      let displayName = lastCheckedOut.memberData.displayName || '';
      displayName = displayName.replace(/^[🔥🍔📞\s]+/, '');
      displayName = '🔥 ' + displayName;

      const memberToReinsert = {
        ...lastCheckedOut.memberData,
        displayName: displayName
      };

      let insertIndex = lastCheckedOut.index;
      if (insertIndex > currentMembers.length) insertIndex = currentMembers.length;

      currentMembers.splice(insertIndex, 0, memberToReinsert);

      await updateDoc(locationRef, { [resolvedMembersField]: currentMembers });
      lastCheckedOut = null;

    } catch (error) {
      console.error("Flame error", error);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleFoodPhoneClick = async () => {
    if (!user || checkingIn) return;
    setCheckingIn(true);
    try {
      const [collectionName, docId] = resolvedFirestorePath.split('/');
      const locationRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(locationRef);
      if (!docSnap.exists()) return;

      const currentMembers = docSnap.data()[resolvedMembersField] || [];
      const userIndex = currentMembers.findIndex((m: any) => m.uid === user.uid);

      if (userIndex === -1) {
        setCheckingIn(false);
        return;
      }

      const userObject = currentMembers[userIndex];
      let currentName = userObject.displayName || '';

      const foodPhonePrefix = '🍔📞 ';
      const flamePrefix = '🔥 ';

      let baseName = currentName;
      if (baseName.startsWith(flamePrefix)) {
        baseName = baseName.substring(flamePrefix.length);
      }
      if (baseName.startsWith(foodPhonePrefix)) {
        baseName = baseName.substring(foodPhonePrefix.length);
      }

      const hasFoodPhone = currentName.includes(foodPhonePrefix);
      let newDisplayName;

      if (hasFoodPhone) {
        newDisplayName = (currentName.startsWith(flamePrefix) ? flamePrefix : '') + baseName;
      } else {
        newDisplayName = (currentName.startsWith(flamePrefix) ? flamePrefix : '') + foodPhonePrefix + baseName;
      }

      currentMembers[userIndex] = {
        ...userObject,
        displayName: newDisplayName
      };

      await updateDoc(locationRef, { [resolvedMembersField]: currentMembers });

    } catch (error) {
      console.error("FoodPhone error", error);
    } finally {
      setCheckingIn(false);
    }
  };

  const handleManualKick = async (uid: string) => {
    try {
      const [collectionName, docId] = resolvedFirestorePath.split('/');
      const locationRef = doc(db, collectionName, docId);
      // Fetch current list, find exact object, then remove
      const docSnap = await getDoc(locationRef);
      if (docSnap.exists()) {
        const list = docSnap.data()[resolvedMembersField] || [];
        const item = list.find((m: any) => m.uid === uid);
        if (item) {
          await updateDoc(locationRef, { [resolvedMembersField]: arrayRemove(item) });
        }
      }
    } catch (error) {
      console.error('Kick hiba:', error);
      Alert.alert('Hiba', 'Nem sikerült a kiléptetés.');
    }
  };

  const handleDragEnd = async (data: Member[]) => {
    setMembers(data);
    if (userProfile?.role !== 'admin') return;
    try {
      const [collectionName, docId] = resolvedFirestorePath.split('/');
      const locationRef = doc(db, collectionName, docId);
      await updateDoc(locationRef, { [resolvedMembersField]: data });
    } catch (error) {
      console.error("Drag update error:", error);
    }
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Member>) => {
    return (
      <ScaleDecorator>
        <TouchableOpacity
          onLongPress={drag}
          disabled={userProfile?.role !== 'admin'}
          style={[
            styles.memberItem,
            { backgroundColor: isActive ? colors.primary : colors.memberItem },
          ]}
        >
          <View style={styles.memberInfo}>
            {/* Show display name if present, otherwise fallback to username */}
            <Text style={[styles.memberName, { color: isActive ? '#ffffff' : colors.text }]}>
              {item.displayName || item.username}
            </Text>
            {/* License plate */}
            {item.licensePlate ? (
              <Text style={[styles.licensePlate, { color: isActive ? '#e5e7eb' : colors.textSecondary }]}>
                {item.licensePlate}
              </Text>
            ) : null}
            {/* Check‑in time */}
            {item.checkInTime ? (
              <Text style={[styles.checkInTime, { color: isActive ? '#e5e7eb' : colors.textSecondary }]}>
                {item.checkInTime}
              </Text>
            ) : null}
          </View>

          {userProfile?.role === 'admin' && (
            <TouchableOpacity onPress={() => handleManualKick(item.uid)} style={styles.kickButton}>
              <Ionicons name="close-circle" size={24} color="#ef4444" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  const isUserCheckedIn = members.some(m => m.uid === user?.uid);
  const canUndo = lastCheckedOut && lastCheckedOut.memberData.uid === user?.uid && lastCheckedOut.locationName === locationName;

  const buttonBaseStyle = {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, // Fixed shadow opacity
    shadowRadius: 1.41,
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      <View style={[styles.header, { backgroundColor: colors.locationHeader }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {isInsideZone === true ? (
            <Ionicons name="checkmark-circle" size={28} color="#10b981" />
          ) : isInsideZone === false ? (
            <Ionicons name="ban" size={28} color="#ef4444" />
          ) : null}
          <Text style={[styles.title, { color: colors.headerText, fontSize: fontSize >= 20 ? 28 : 24 }]}>
            {locationName}
          </Text>
        </View>
        <Text style={[styles.count, { color: colors.headerText }]}>{members.length} autó</Text>
      </View>



      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <DraggableFlatList
          data={members}
          onDragEnd={({ data }) => handleDragEnd(data)}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 120 }}
          style={{ flex: 1 }}
        />
      )}

      {/* FOOTER BUTTONS */}
      {/* We use insets.bottom to ensure on iPhone X+ it doesn't overlap home indicator */}
      <View style={[
        styles.footerContainer,
        {
          backgroundColor: colors.footerBackground,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 10,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
        }
      ]}>
        <View style={{ flexDirection: 'row' }}>
          {/* BE */}
          <TouchableOpacity
            style={[buttonBaseStyle, { backgroundColor: isUserCheckedIn || (gpsEnabled && isInsideZone === false) ? '#9ca3af' : '#10b981' }]}
            onPress={handleCheckIn}
            disabled={isUserCheckedIn || checkingIn || (gpsEnabled && isInsideZone === false)}
          >
            <Text style={styles.footerButtonText}>Be</Text>
          </TouchableOpacity>

          {/* KI */}
          <TouchableOpacity
            style={[buttonBaseStyle, { backgroundColor: !isUserCheckedIn ? '#9ca3af' : '#f97316' }]}
            onPress={handleCheckOut}
            disabled={!isUserCheckedIn || checkingIn}
          >
            <Text style={styles.footerButtonText}>Ki</Text>
          </TouchableOpacity>

          {/* LÁNG */}
          <TouchableOpacity
            style={[buttonBaseStyle, { backgroundColor: !canUndo || isUserCheckedIn || (gpsEnabled && isInsideZone === false) ? '#9ca3af' : '#ef4444' }]}
            onPress={handleFlameClick}
            disabled={!canUndo || isUserCheckedIn || checkingIn || (gpsEnabled && isInsideZone === false)}
          >
            <Text style={{ fontSize: 20 }}>🔥</Text>
          </TouchableOpacity>

          {/* FOOD/PHONE */}
          <TouchableOpacity
            style={[buttonBaseStyle, { backgroundColor: !isUserCheckedIn || (gpsEnabled && isInsideZone === false) ? '#9ca3af' : '#3b82f6' }]}
            onPress={handleFoodPhoneClick}
            disabled={!isUserCheckedIn || checkingIn || (gpsEnabled && isInsideZone === false)}
          >
            <Text style={{ fontSize: 20 }}>🍔📞</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  title: { fontWeight: 'bold' },
  count: { fontSize: 16, fontWeight: '600' },
  memberItem: {
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  licensePlate: { fontSize: 13 },
  checkInTime: { fontSize: 12, marginTop: 2 },
  kickButton: { padding: 8 },
  footerContainer: {
    borderTopWidth: 1,
    paddingHorizontal: 10,
    elevation: 10, // Added elevation to ensure shadow on Android
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  footerButtonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});

export default LocationScreen;

