import { db } from '../config/firebase';
import { doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { LocationMember } from '../screens/driver/LocationScreen';
import { undoService } from './UndoService';

export const LOCATIONS = ['Akadémia', 'Belváros', 'Budai', 'Conti', 'Crowne', 'Kozmo', 'Reptér', 'V-Osztály', '213'];

export const checkoutFromAllLocations = async (uid: string, currentProfile?: any) => {
    if (!uid) return;

    for (const location of LOCATIONS) {
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
