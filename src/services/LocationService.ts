import { db } from '../config/firebase';
import { doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { LocationMember } from '../screens/driver/LocationScreen';
import { undoService } from './UndoService';

export const LOCATIONS = ['Akadémia', 'Belváros', 'Budai', 'Conti', 'Crowne', 'Kozmo', 'Reptér', 'Emirates', 'V-Osztály', '213'];

import AsyncStorage from '@react-native-async-storage/async-storage';

export const checkoutFromAllLocations = async (uid: string, currentProfile?: any, excludeLocation?: string, excludeLocations?: string[]) => {
    if (!uid) return;

    // CRITICAL FIX v1.6.15: Clear active checkin data on global checkout (unless we are just switching tabs locally)
    // But wait, if we are switching tabs (e.g. checkinToNewLocation calls this), we might want to keep it?
    // Actually, checkinToNewLocation calls this THEN sets the new one. So clearing here is safe,
    // because the new one will be set immediately after by handleCheckIn.
    // However, to be absolutely safe and avoid race conditions where BG task runs in between:
    // We only clear if this is a "full" checkout (e.g. Logout) or if we are sure.
    // Given the logic in LocationScreen.tsx, handleCheckIn sets the key at the END of the process.
    // So clearing it here is correct to ensure no stale state remains.
    try {
        await AsyncStorage.removeItem('active_checkin_data');
        await AsyncStorage.removeItem('FIRST_OUTSIDE_TIMESTAMP');
    } catch (e) {
        console.log('Error clearing checkin data', e);
    }

    // Merge single exclude and array excludes
    const locationsToExclude = [
        ...(excludeLocation ? [excludeLocation] : []),
        ...(excludeLocations || [])
    ];

    for (const location of LOCATIONS) {
        // Skip excluded locations
        if (locationsToExclude.includes(location)) {
            continue;
        }

        const locationRef = doc(db, 'locations', location);
        const docSnap = await getDoc(locationRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // Check 'members' array
            const members: LocationMember[] = data.members || [];
            const userIndex = members.findIndex(m => m.uid === uid);

            if (userIndex !== -1) {
                const memberToRemove = members[userIndex];

                // Save state for Undo (Flame) if it's the current user
                if (currentProfile && currentProfile.uid === uid) {
                    undoService.setLastCheckedOut({
                        locationName: location,
                        memberData: memberToRemove,
                        index: userIndex,
                        memberType: 'members'
                    });
                }

                const updatedMembers = members.filter(m => m.uid !== uid);
                await updateDoc(locationRef, { members: updatedMembers });
            }

            // Special check for 'emiratesMembers' in 'Reptér'
            if (location === 'Reptér') {
                const emiratesMembers: LocationMember[] = data.emiratesMembers || [];
                const emiratesIndex = emiratesMembers.findIndex(m => m.uid === uid);

                if (emiratesIndex !== -1) {
                    const memberToRemove = emiratesMembers[emiratesIndex];

                    if (currentProfile && currentProfile.uid === uid) {
                        undoService.setLastCheckedOut({
                            locationName: 'Reptér',
                            memberData: memberToRemove,
                            index: emiratesIndex,
                            memberType: 'emiratesMembers'
                        });
                    }

                    const updatedEmiratesMembers = emiratesMembers.filter(m => m.uid !== uid);
                    await updateDoc(locationRef, { emiratesMembers: updatedEmiratesMembers });
                }
            }
        }
    }
};

/**
 * Checkout from a specific location
 * Used for Emirates ↔ Reptér queue swapping
 */
export const checkoutFromLocation = async (locationName: string, uid: string): Promise<void> => {
    if (!uid) return;

    const locationRef = doc(db, 'locations', locationName);
    const docSnap = await getDoc(locationRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        const members: LocationMember[] = data.members || [];
        const updatedMembers = members.filter(m => m.uid !== uid);
        await updateDoc(locationRef, { members: updatedMembers });
        console.log(`Checked out ${uid} from ${locationName}`);
    }
};

export const updateUserDisplayNameInAllLocations = async (uid: string, updatedProfile: any) => {
    if (!uid || !updatedProfile) return;

    const getDisplayName = (username: string, userType: string, licensePlate: string) => {
        let suffix = '';
        switch (userType) {
            case 'Taxi': suffix = 'S'; break;
            case 'Kombi Taxi': suffix = 'SK'; break;
            case 'V-Osztály': suffix = 'V'; break;
            case 'VIP': suffix = ''; break;
            case 'VIP Kombi': suffix = 'K'; break;
            default: suffix = ''; break;
        }
        return `${username}${suffix} - ${licensePlate}`;
    };

    for (const location of LOCATIONS) {
        const locationRef = doc(db, 'locations', location);
        const docSnap = await getDoc(locationRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            let needsUpdate = false;
            const updateData: any = {};

            // Update members
            const members: LocationMember[] = data.members || [];
            const updatedMembers = members.map(member => {
                if (member.uid === uid) {
                    needsUpdate = true;
                    return {
                        ...member,
                        userType: updatedProfile.userType,
                        licensePlate: updatedProfile.licensePlate,
                        displayName: getDisplayName(updatedProfile.username, updatedProfile.userType, updatedProfile.licensePlate)
                    };
                }
                return member;
            });

            if (needsUpdate) {
                updateData.members = updatedMembers;
            }

            // Update emiratesMembers for Reptér
            if (location === 'Reptér') {
                const emiratesMembers: LocationMember[] = data.emiratesMembers || [];
                let emiratesNeedsUpdate = false;
                const updatedEmiratesMembers = emiratesMembers.map(member => {
                    if (member.uid === uid) {
                        emiratesNeedsUpdate = true;
                        return {
                            ...member,
                            userType: updatedProfile.userType,
                            licensePlate: updatedProfile.licensePlate,
                            displayName: getDisplayName(updatedProfile.username, updatedProfile.userType, updatedProfile.licensePlate)
                        };
                    }
                    return member;
                });

                if (emiratesNeedsUpdate) {
                    updateData.emiratesMembers = updatedEmiratesMembers;
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                await updateDoc(locationRef, updateData);
            }
        }
    }
};
