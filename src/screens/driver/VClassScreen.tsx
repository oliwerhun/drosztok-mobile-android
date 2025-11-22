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

interface VClassScreenProps {
  gpsEnabled: boolean;
}

interface LastCheckoutData {
  locationName: string;
  memberData: LocationMember;
  index: number;
}

export default function VClassScreen({ gpsEnabled }: VClassScreenProps) {
  const { userProfile } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'sor' | 'rendelesek'>('sor');
  const [members, setMembers] = useState<LocationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [lastCheckout, setLastCheckout] = useState<LastCheckoutData | null>(null);

  useEffect(() => {
    const locationRef = doc(db, 'locations', 'V-Osztály');
    
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
  }, [userProfile?.uid]);

  const createMemberObject = (): LocationMember | null => {
    if (!userProfile) return null;

    let displayName = `${userProfile.username}V - ${userProfile.licensePlate}`;

    return {
      uid: userProfile.uid,
      username: userProfile.username,
      userType: userProfile.userType,
      licensePlate: userProfile.licensePlate,
      displayName,
    };
  };

  const handleCheckIn = async () => {
    if (!userProfile) return;

    const memberObject = createMemberObject();
    if (!memberObject) return;

    setLastCheckout(null);

    try {
      const locationRef = doc(db, 'locations', 'V-Osztály');
      const docSnap = await getDoc(locationRef);

      if (docSnap.exists()) {
        const currentMembers = docSnap.data().members || [];
        await updateDoc(locationRef, {
          members: [...currentMembers, memberObject],
        });
      } else {
        await setDoc(locationRef, {
          members: [memberObject],
        });
      }
    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert('Hiba', 'Nem sikerült bejelentkezni.');
    }
  };

  const handleCheckOut = async () => {
    if (!userProfile) return;

    try {
      const locationRef = doc(db, 'locations', 'V-Osztály');
      const docSnap = await getDoc(locationRef);

      if (docSnap.exists()) {
        const currentMembers = docSnap.data().members || [];
        const userIndex = currentMembers.findIndex((m: LocationMember) => m.uid === userProfile.uid);
        
        if (userIndex !== -1) {
          const memberToRemove = currentMembers[userIndex];
          
          setLastCheckout({
            locationName: 'V-Osztály',
            memberData: memberToRemove,
            index: userIndex,
          });

          const updatedMembers = currentMembers.filter((m: LocationMember) => m.uid !== userProfile.uid);
          await updateDoc(locationRef, {
            members: updatedMembers,
          });
        }
      }
    } catch (error) {
      console.error('Check-out error:', error);
      Alert.alert('Hiba', 'Nem sikerült kijelentkezni.');
    }
  };

  const handleFlame = async () => {
    if (!lastCheckout || !userProfile) return;

    try {
      const locationRef = doc(db, 'locations', 'V-Osztály');
      const docSnap = await getDoc(locationRef);

      if (docSnap.exists()) {
        const currentMembers = docSnap.data().members || [];
        
        if (currentMembers.some((m: LocationMember) => m.uid === userProfile.uid)) {
          setLastCheckout(null);
          return;
        }

        const memberWithFlame = {
          ...lastCheckout.memberData,
          displayName: `🔥 ${lastCheckout.memberData.displayName.replace(/^🔥\s*/, '')}`,
        };

        const updatedMembers = [...currentMembers];
        updatedMembers.splice(lastCheckout.index, 0, memberWithFlame);

        await updateDoc(locationRef, {
          members: updatedMembers,
        });

        setLastCheckout(null);
      }
    } catch (error) {
      console.error('Flame error:', error);
      Alert.alert('Hiba', 'Nem sikerült visszavenni a pozíciót.');
    }
  };

  const handleFoodPhone = async () => {
    if (!userProfile || !isCheckedIn) return;

    try {
      const locationRef = doc(db, 'locations', 'V-Osztály');
      const docSnap = await getDoc(locationRef);

      if (docSnap.exists()) {
        const currentMembers = docSnap.data().members || [];
        const userIndex = currentMembers.findIndex((m: LocationMember) => m.uid === userProfile.uid);
        
        if (userIndex !== -1) {
          const currentMember = currentMembers[userIndex];
          let newDisplayName = currentMember.displayName;

          const hasFoodPhone = newDisplayName.includes('🍔📞');

          if (hasFoodPhone) {
            newDisplayName = newDisplayName.replace(/🍔📞\s*/g, '');
          } else {
            if (newDisplayName.startsWith('🔥 ')) {
              newDisplayName = `🔥 🍔📞 ${newDisplayName.replace(/^🔥\s*/, '')}`;
            } else {
              newDisplayName = `🍔📞 ${newDisplayName}`;
            }
          }

          const updatedMember = {
            ...currentMember,
            displayName: newDisplayName,
          };

          const updatedMembers = [...currentMembers];
          updatedMembers[userIndex] = updatedMember;

          await updateDoc(locationRef, {
            members: updatedMembers,
          });
        }
      }
    } catch (error) {
      console.error('Food/Phone error:', error);
      Alert.alert('Hiba', 'Nem sikerült frissíteni.');
    }
  };

  const canUseFlame = () => {
    if (!lastCheckout) return false;
    if (isCheckedIn) return false;
    return true;
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
      {/* Sub-tab gombok */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          style={[
            styles.subTab,
            activeSubTab === 'sor' && styles.subTabActive,
          ]}
          onPress={() => setActiveSubTab('sor')}
        >
          <Text
            style={[
              styles.subTabText,
              activeSubTab === 'sor' && styles.subTabTextActive,
            ]}
          >
            V-Osztály Sor
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.subTab,
            activeSubTab === 'rendelesek' && styles.subTabActive,
          ]}
          onPress={() => setActiveSubTab('rendelesek')}
        >
          <Text
            style={[
              styles.subTabText,
              activeSubTab === 'rendelesek' && styles.subTabTextActive,
            ]}
          >
            Rendelések
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeSubTab === 'sor' ? (
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>V-Osztály Sor</Text>
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
              <Text style={styles.buttonText}>Be</Text>
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
              <Text style={styles.buttonText}>Ki</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.flameButton,
                !canUseFlame() && styles.buttonDisabled,
              ]}
              onPress={handleFlame}
              disabled={!canUseFlame()}
            >
              <Text style={styles.flameText}>🔥</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.foodPhoneButton,
                !isCheckedIn && styles.buttonDisabled,
              ]}
              onPress={handleFoodPhone}
              disabled={!isCheckedIn}
            >
              <Text style={styles.foodPhoneText}>🍔📞</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>Rendelések hamarosan...</Text>
        </View>
      )}
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
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  subTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  subTabActive: {
    backgroundColor: '#1f2937',
  },
  subTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  subTabTextActive: {
    color: '#fff',
  },
  header: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
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
    gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  button: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInButton: {
    backgroundColor: '#10b981',
  },
  checkOutButton: {
    backgroundColor: '#f59e0b',
  },
  flameButton: {
    backgroundColor: '#ef4444',
  },
  foodPhoneButton: {
    backgroundColor: '#3b82f6',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  flameText: {
    fontSize: 24,
  },
  foodPhoneText: {
    fontSize: 20,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#6b7280',
  },
});
