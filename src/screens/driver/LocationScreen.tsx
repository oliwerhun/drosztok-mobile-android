import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { doc, onSnapshot, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { LocationMember } from '../../types';

interface LocationScreenProps {
  locationName: string;
  locationTitle: string;
}

export default function LocationScreen({ locationName, locationTitle }: LocationScreenProps) {
  const { userProfile } = useAuth();
  const [members, setMembers] = useState<LocationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  // Realtime Firestore listener
  useEffect(() => {
    if (!locationName) return;

    const locationRef = doc(db, 'locations', locationName);
    
    const unsubscribe = onSnapshot(
      locationRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const membersList = data.members || [];
          setMembers(membersList);
          
          const userInList = membersList.some((m: LocationMember) => m.uid === userProfile?.uid);
          setIsCheckedIn(userInList);
        } else {
          setMembers([]);
          setIsCheckedIn(false);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Firestore listener error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [locationName, userProfile?.uid]);

  // Create member object
  const createMemberObject = (): LocationMember | null => {
    if (!userProfile) return null;

    let displayName = '';
    switch (userProfile.userType) {
      case 'Taxi':
        displayName = `${userProfile.username}S - ${userProfile.licensePlate}`;
        break;
      case 'Kombi Taxi':
        displayName = `${userProfile.username}SK - ${userProfile.licensePlate}`;
        break;
      case 'V-Osztály':
        displayName = `${userProfile.username}V - ${userProfile.licensePlate}`;
        break;
      case 'VIP':
        displayName = `${userProfile.username} - ${userProfile.licensePlate}`;
        break;
      case 'VIP Kombi':
        displayName = `${userProfile.username}K - ${userProfile.licensePlate}`;
        break;
      default:
        displayName = `${userProfile.username} - ${userProfile.licensePlate}`;
    }

    return {
      uid: userProfile.uid,
      username: userProfile.username,
      userType: userProfile.userType,
      licensePlate: userProfile.licensePlate,
      displayName,
    };
  };

  // Check-in function (FIXED!)
  const handleCheckIn = async () => {
    if (!userProfile) return;

    const memberObject = createMemberObject();
    if (!memberObject) return;

    try {
      const locationRef = doc(db, 'locations', locationName);
      const docSnap = await getDoc(locationRef);

      if (docSnap.exists()) {
        // Document exists, use updateDoc
        const currentMembers = docSnap.data().members || [];
        await updateDoc(locationRef, {
          members: [...currentMembers, memberObject],
        });
      } else {
        // Document doesn't exist, create it with setDoc
        await setDoc(locationRef, {
          members: [memberObject],
        });
      }
    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert('Hiba', 'Nem sikerült bejelentkezni.');
    }
  };

  // Check-out function
  const handleCheckOut = async () => {
    if (!userProfile) return;

    try {
      const locationRef = doc(db, 'locations', locationName);
      const docSnap = await getDoc(locationRef);

      if (docSnap.exists()) {
        const currentMembers = docSnap.data().members || [];
        const updatedMembers = currentMembers.filter((m: LocationMember) => m.uid !== userProfile.uid);

        await updateDoc(locationRef, {
          members: updatedMembers,
        });
      }
    } catch (error) {
      console.error('Check-out error:', error);
      Alert.alert('Hiba', 'Nem sikerült kijelentkezni.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{locationTitle}</Text>
        <Text style={styles.headerSubtitle}>Sorban: {members.length} fő</Text>
      </View>

      <ScrollView style={styles.membersList}>
        {members.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nincs itt senki.</Text>
          </View>
        ) : (
          members.map((member, index) => (
            <View key={member.uid} style={styles.memberItem}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberPosition}>{index + 1}.</Text>
                <Text style={styles.memberName}>{member.displayName}</Text>
              </View>
              {member.uid === userProfile?.uid && (
                <View style={styles.youBadge}>
                  <Text style={styles.youBadgeText}>Te</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.checkInButton,
            isCheckedIn && styles.buttonDisabled,
          ]}
          onPress={handleCheckIn}
          disabled={isCheckedIn}
        >
          <Text style={styles.buttonText}>Bejelentkezés</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.checkOutButton,
            !isCheckedIn && styles.buttonDisabled,
          ]}
          onPress={handleCheckOut}
          disabled={!isCheckedIn}
        >
          <Text style={styles.buttonText}>Kijelentkezés</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#4f46e5',
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#c7d2fe',
    marginTop: 4,
  },
  membersList: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
  memberItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberPosition: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginRight: 12,
    minWidth: 30,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  youBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  youBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  checkInButton: {
    backgroundColor: '#10b981',
  },
  checkOutButton: {
    backgroundColor: '#f59e0b',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
