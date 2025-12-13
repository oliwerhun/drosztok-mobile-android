import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';

interface UserProfile {
    id: string;
    uid: string;
    username: string;
    email: string;
    role: 'user' | 'admin';
    status: 'pending' | 'approved' | 'suspended';
    userType: string;
    licensePlate: string;
    canSee213?: boolean;
}

export default function AdminScreen() {
    const { userProfile } = useAuth();
    const { colors } = useTheme();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const usersRef = collection(db, 'profiles');
            const q = query(usersRef);
            const querySnapshot = await getDocs(q);
            let fetchedUsers: UserProfile[] = [];

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Skip current user
                if (userProfile && doc.id === userProfile.uid) return;

                fetchedUsers.push({
                    id: doc.id,
                    uid: doc.id,
                    username: data.username || 'N/A',
                    email: data.email || 'N/A',
                    role: data.role || 'user',
                    status: data.status || 'pending',
                    userType: data.userType || 'N/A',
                    licensePlate: data.licensePlate || 'N/A',
                    canSee213: data.canSee213,
                });
            });

            // Sort by username (callsign)
            fetchedUsers.sort((a, b) => parseInt(a.username || '0') - parseInt(b.username || '0'));
            setUsers(fetchedUsers);
        } catch (error) {
            console.error('Error fetching users:', error);
            Alert.alert('Hiba', 'Nem sikerült betölteni a felhasználókat.');
        } finally {
            setLoading(false);
        }
    };

    const updateUserStatus = async (uid: string, status: 'approved' | 'pending') => {
        try {
            const profileRef = doc(db, 'profiles', uid);
            await updateDoc(profileRef, { status });
            fetchUsers(); // Refresh list
        } catch (error) {
            console.error('Error updating status:', error);
            Alert.alert('Hiba', 'Nem sikerült frissíteni a státuszt.');
        }
    };

    const updateUserRole = async (uid: string, role: 'user' | 'admin') => {
        try {
            const profileRef = doc(db, 'profiles', uid);
            await updateDoc(profileRef, { role });
            fetchUsers();
        } catch (error) {
            console.error('Error updating role:', error);
            Alert.alert('Hiba', 'Nem sikerült frissíteni a jogosultságot.');
        }
    };

    const toggle213Access = async (uid: string, currentAccess: boolean | undefined) => {
        try {
            const profileRef = doc(db, 'profiles', uid);
            await updateDoc(profileRef, { canSee213: !currentAccess });
            fetchUsers();
        } catch (error) {
            console.error('Error updating 213 access:', error);
            Alert.alert('Hiba', 'Nem sikerült módosítani a 213-as hozzáférést.');
        }
    };

    const removeUserFromAllLocations = async (uid: string) => {
        const batch = writeBatch(db);
        const locations = ['Akadémia', 'Belváros', 'Budai', 'Conti', 'Crowne', 'Kozmo', 'Reptér', 'V-Osztály', '213'];

        try {
            for (const locName of locations) {
                const locationRef = doc(db, "locations", locName);
                const docSnap = await getDoc(locationRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    let needsUpdate = false;
                    let updateData: any = {};

                    if (data.members && Array.isArray(data.members) && data.members.some((m: any) => m.uid === uid)) {
                        updateData.members = data.members.filter((m: any) => m.uid !== uid);
                        needsUpdate = true;
                    }

                    if (locName === 'Reptér' && data.emiratesMembers && Array.isArray(data.emiratesMembers) && data.emiratesMembers.some((m: any) => m.uid === uid)) {
                        updateData.emiratesMembers = data.emiratesMembers.filter((m: any) => m.uid !== uid);
                        needsUpdate = true;
                    }

                    if (needsUpdate) {
                        batch.update(locationRef, updateData);
                    }
                }
            }
            await batch.commit();
        } catch (error) {
            console.error('Error removing user from locations:', error);
            throw error;
        }
    };

    const handleDeleteUser = (uid: string, username: string) => {
        Alert.alert(
            'Felhasználó törlése',
            `Biztosan törölni szeretnéd ${username} felhasználót? Ez a művelet NEM vonható vissza!`,
            [
                { text: 'Mégsem', style: 'cancel' },
                {
                    text: 'Törlés',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            // 1. Remove from all locations
                            await removeUserFromAllLocations(uid);

                            // 2. Delete driver location
                            await deleteDoc(doc(db, 'driver_locations', uid)).catch(() => { });

                            // 3. Delete dispatch
                            await deleteDoc(doc(db, 'dispatches', uid)).catch(() => { });

                            // 4. Delete profile
                            await deleteDoc(doc(db, 'profiles', uid));

                            Alert.alert('Siker', 'Felhasználó sikeresen törölve.');
                            fetchUsers();
                        } catch (error) {
                            console.error('Error deleting user:', error);
                            Alert.alert('Hiba', 'Nem sikerült törölni a felhasználót.');
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const copyEmail = async (email: string) => {
        await Clipboard.setStringAsync(email);
        Alert.alert('Másolva', 'Email cím vágólapra másolva.');
    };

    const renderItem = ({ item }: { item: UserProfile }) => {
        const isPending = item.status === 'pending';
        const isAdmin = item.role === 'admin';
        const has213Access = item.canSee213 || item.role === 'admin' || item.userType === 'VIP' || item.userType === 'VIP Kombi';

        return (
            <View style={[
                styles.userCard,
                { backgroundColor: colors.card },
                isPending && { backgroundColor: colors.warningBackground, borderColor: colors.warningBorder, borderWidth: 1 }
            ]}>
                <View style={styles.userInfo}>
                    <View style={[styles.avatar, { backgroundColor: colors.background }]}>
                        <Text style={[styles.avatarText, { color: colors.text }]}>{item.username}</Text>
                    </View>
                    <View style={styles.userDetails}>
                        <Text style={[styles.userTitle, { color: colors.text }]}>{item.userType} - {item.licensePlate}</Text>
                        <TouchableOpacity onPress={() => copyEmail(item.email)}>
                            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{item.email} 📋</Text>
                        </TouchableOpacity>
                        <Text style={[styles.userStatus, { color: colors.textSecondary }]}>
                            {item.status} | {item.role} | 213: {has213Access ? '✅' : '❌'}
                        </Text>
                    </View>
                </View>

                <View style={styles.actions}>
                    {isPending ? (
                        <TouchableOpacity style={[styles.button, styles.approveBtn]} onPress={() => updateUserStatus(item.uid, 'approved')}>
                            <Text style={styles.btnText}>Jóváhagy</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={[styles.button, styles.suspendBtn]} onPress={() => updateUserStatus(item.uid, 'pending')}>
                            <Text style={styles.btnText}>Felfüggeszt</Text>
                        </TouchableOpacity>
                    )}

                    {isAdmin ? (
                        <TouchableOpacity style={[styles.button, styles.removeAdminBtn]} onPress={() => updateUserRole(item.uid, 'user')}>
                            <Text style={styles.btnText}>Admin elvét</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={[styles.button, styles.makeAdminBtn]} onPress={() => updateUserRole(item.uid, 'admin')}>
                            <Text style={styles.btnText}>Admin adás</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.button, styles.deleteBtn]}
                        onPress={() => handleDeleteUser(item.uid, item.username)}
                    >
                        <Ionicons name="trash-outline" size={18} color="white" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Adminisztráció</Text>
                <TouchableOpacity onPress={fetchUsers}>
                    <Ionicons name="refresh" size={24} color={colors.primary} />
                </TouchableOpacity>
            </View>
            <FlatList
                data={users}
                renderItem={renderItem}
                keyExtractor={(item) => item.uid}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nincsenek felhasználók.</Text>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    listContent: { padding: 16 },
    userCard: { borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
    userInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatarText: { fontSize: 16, fontWeight: 'bold' },
    userDetails: { flex: 1 },
    userTitle: { fontSize: 16, fontWeight: '600' },
    userEmail: { fontSize: 14, marginTop: 2 },
    userStatus: { fontSize: 12, marginTop: 4 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    button: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
    btnText: { color: 'white', fontSize: 12, fontWeight: '600' },
    approveBtn: { backgroundColor: '#10b981' },
    suspendBtn: { backgroundColor: '#f59e0b' },
    makeAdminBtn: { backgroundColor: '#3b82f6' },
    removeAdminBtn: { backgroundColor: '#6b7280' },
    deleteBtn: { backgroundColor: '#ef4444', paddingHorizontal: 10 },
    emptyText: { textAlign: 'center', marginTop: 20 },
});
