import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform, KeyboardAvoidingView, FlatList } from 'react-native';
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
import { checkoutFromAllLocations, checkoutFromLocation } from '../../services/LocationService';
import GeofenceService, { GEOFENCED_LOCATIONS } from '../../services/GeofenceService';

// GEOFENCED_LOCATIONS and isPointInPolygon now imported from GeofenceService

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

  // Track previous zone status for state transition detection (like index.html)
  const prevIsInsideZone = useRef<boolean | null>(null);

  // Debounce auto-checkout: track when user first went outside
  const outsideZoneSince = useRef<number | null>(null);
  const AUTO_CHECKOUT_DELAY_MS = 10000; // 10 seconds outside before auto-checkout

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

  // Subscribe to global GeofenceService instead of local GPS tracking
  useEffect(() => {
    if (!gpsEnabled) return;

    // Get initial status from global service
    const initialStatus = GeofenceService.getStatus(resolvedGeofenceName);
    setIsInsideZone(initialStatus);

    // Subscribe to zone status changes
    const unsubscribe = GeofenceService.subscribe((locationName, isInside) => {
      if (locationName === resolvedGeofenceName) {
        console.log(`LocationScreen: ${locationName} status updated: ${isInside}`);
        setIsInsideZone(isInside);
      }
    });

    return unsubscribe;
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

      // EMIRATES PREREQUISITE: Must be in Reptér queue first
      if (locationName === 'Emirates') {
        const repterRef = doc(db, 'locations', 'Reptér');
        const repterSnap = await getDoc(repterRef);

        if (repterSnap.exists()) {
          const repterMembers = repterSnap.data().members || [];
          const isInRepter = repterMembers.some((m: any) => m.uid === user.uid);

          if (!isInRepter) {
            Alert.alert(
              'Figyelem',
              'Először a Reptéri sorba kell bejelentkezned!'
            );
            return;
          }

          // User is in Reptér → swap to Emirates
          console.log('Emirates check-in: swapping from Reptér to Emirates');
          await checkoutFromLocation('Reptér', user.uid);
        }
      }

      // REPTÉR CHECK-IN: If in Emirates, swap back to Reptér
      if (locationName === 'Reptér') {
        const emiratesRef = doc(db, 'locations', 'Emirates');
        const emiratesSnap = await getDoc(emiratesRef);

        if (emiratesSnap.exists()) {
          const emiratesMembers = emiratesSnap.data().members || [];
          const isInEmirates = emiratesMembers.some((m: any) => m.uid === user.uid);

          if (isInEmirates) {
            console.log('Reptér check-in: swapping from Emirates to Reptér');
            await checkoutFromLocation('Emirates', user.uid);
          }
        }
      }

      // Parallel execution: checkout from all locations (EXCEPT the new one) AND check-in to new location
      // Note: Emirates and Reptér swaps are handled above, so exclude both from general checkout
      const excludeLocations = (locationName === 'Emirates' || locationName === 'Reptér')
        ? ['Emirates', 'Reptér']
        : [locationName];

      await Promise.all([
        checkoutFromAllLocations(user.uid, userProfile, locationName, excludeLocations),
        setDoc(locationRef, { [resolvedMembersField]: arrayUnion(newMember) }, { merge: true })
      ]);

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

  // AUTO-CHECKOUT DISABLED - Causes instability and race conditions
  // The index.html does NOT have per-component auto-checkout logic
  // TODO: Implement global auto-checkout in GeofenceService if needed
  /*
  useEffect(() => {
    // Skip auto-checkout if zone has no geofence coordinates (e.g., V-Osztály)
    if (!GEOFENCED_LOCATIONS[resolvedGeofenceName]) {
      return;
    }

    const wasInside = prevIsInsideZone.current;
    const isNowOutside = isInsideZone === false;
    const isNowInside = isInsideZone === true;

    // Reset debounce timer if user is back inside
    if (isNowInside) {
      outsideZoneSince.current = null;
    }

    // CRITICAL FIX: Only proceed if user is actually checked into THIS zone
    const isUserInThisZone = user && members.some(m => m.uid === user.uid);
    if (!isUserInThisZone) {
      // User is not in this zone's queue, so don't auto-checkout
      return;
    }

    // Start debounce timer on first detection of being outside
    if (wasInside === true && isNowOutside && outsideZoneSince.current === null) {
      outsideZoneSince.current = Date.now();
      console.log(`User left zone ${resolvedGeofenceName}, starting ${AUTO_CHECKOUT_DELAY_MS / 1000}s debounce timer`);
    }

    // Check if user has been outside long enough
    if (wasInside === true && isNowOutside && outsideZoneSince.current !== null) {
      const timeOutside = Date.now() - outsideZoneSince.current;

      if (timeOutside >= AUTO_CHECKOUT_DELAY_MS && !loading && !checkingIn) {
        console.log(`Auto-checkout: User outside ${resolvedGeofenceName} for ${timeOutside / 1000}s, triggering checkout`);
        handleCheckOut();
        Alert.alert("Figyelem", "Elhagytad a droszt területét, ezért kijelentkeztettünk.");
        outsideZoneSince.current = null; // Reset timer
      }
    }

    // Update previous state for next comparison
    prevIsInsideZone.current = isInsideZone;
  }, [isInsideZone, members, user, gpsEnabled, loading, checkingIn, resolvedGeofenceName]);
  */

  const handleFlameClick = async () => {
    if (!user || checkingIn) return;

    // Disable Flame for Emirates (violates Reptér prerequisite rule)
    if (locationName === 'Emirates') {
      Alert.alert('Figyelem', 'Ez a gomb itt nem használható!');
      return;
    }

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
        <View
          style={[
            styles.memberItem,
            {
              backgroundColor: isActive ? colors.primary : (theme === 'dark' ? '#374151' : '#ffffff'),
              borderWidth: 1,
              borderColor: theme === 'dark' ? '#4b5563' : '#e5e7eb'
            },
          ]}
        >
          {userProfile?.role === 'admin' && (
            <TouchableOpacity
              onLongPress={drag}
              delayLongPress={100}
              style={styles.dragHandle}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.dragIcon, { color: colors.textSecondary }]}>☰</Text>
            </TouchableOpacity>
          )}

          <View style={styles.memberInfo}>
            <Text style={[styles.memberName, { color: isActive ? '#ffffff' : colors.text, fontSize: fontSize }]}>
              {item.displayName || item.username}
              {item.checkInTime ? ` - ${item.checkInTime}` : ''}
            </Text>
          </View>

          {userProfile?.role === 'admin' && (
            <TouchableOpacity onPress={() => handleManualKick(item.uid)} style={styles.kickButton}>
              <Ionicons name="close-circle" size={24} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
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
          {locationName !== 'V-Osztály' && (
            isInsideZone === true ? (
              <Ionicons name="checkmark-circle" size={28} color="#10b981" />
            ) : isInsideZone === false ? (
              <Ionicons name="ban" size={28} color="#ef4444" />
            ) : null
          )}
          <Text style={[styles.title, { color: colors.headerText, fontSize: 24 }]}>
            {locationName}
          </Text>
        </View>
        <Text style={[styles.count, { color: colors.headerText }]}>{members.length} autó</Text>
      </View>



      {userProfile?.role === 'admin' ? (
        <View style={{ flex: 1 }}>
          <DraggableFlatList
            data={members}
            onDragEnd={({ data }) => handleDragEnd(data)}
            keyExtractor={(item) => item.uid}
            renderItem={renderItem}
            ListHeaderComponent={
              loading ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#3b82f6" />
                </View>
              ) : null
            }
            contentContainerStyle={{ paddingBottom: 150 }}
            containerStyle={{ flex: 1 }}
          />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            data={members}
            keyExtractor={(item) => item.uid}
            renderItem={({ item }) => renderItem({ item, drag: () => { }, isActive: false } as any)}
            ListHeaderComponent={
              loading ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#3b82f6" />
                </View>
              ) : null
            }
            contentContainerStyle={{ paddingBottom: 150 }}
            style={{ flex: 1 }}
          />
        </View>
      )}

      {/* FOOTER BUTTONS */}
      {/* We use insets.bottom to ensure on iPhone X+ it doesn't overlap      {/* FOOTER BUTTONS - Hidden for V-Osztály */}
      {locationName !== 'V-Osztály' && (
        <View style={[
          styles.footerContainer,
          {
            backgroundColor: colors.footerBackground,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 10,
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
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    padding: 12,
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
    paddingVertical: 0,
    paddingHorizontal: 16,
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
  dragHandle: { paddingRight: 12, paddingVertical: 4 },
  dragIcon: { fontSize: 24, color: '#9ca3af' },
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

