import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Linking, Platform, AppState, Dimensions, NativeModules } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import { db, auth } from '../config/firebase';
import { checkoutFromAllLocations } from '../services/LocationService';
import { useAuth } from '../context/AuthContext';
import { logger } from '../utils/Logger';

const { BatteryOptimization, UnusedAppsModule } = NativeModules;

const SETTINGS_CONFIRMED_KEY = 'system_settings_confirmed_v5'; // Incremented version
const PERMISSIONS_COMPLETED_KEY = 'permissions_completed_v1';
const SCREEN_WIDTH = Dimensions.get('window').width;

type WizardStep = 'location' | 'notification' | 'unused_apps' | 'battery' | 'completed';

export default function PermissionGuard({ children }: { children: React.ReactNode }) {
    const { userProfile, loading } = useAuth();

    // Sync Admin status to Storage for background tasks
    useEffect(() => {
        if (userProfile?.role === 'admin') {
            AsyncStorage.setItem('IS_ADMIN', 'true');
        } else if (!loading) { // Only set false if loaded and not admin
            AsyncStorage.setItem('IS_ADMIN', 'false');
        }
    }, [userProfile, loading]);

    const [permissionsGranted, setPermissionsGranted] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [currentStep, setCurrentStep] = useState<WizardStep>('location');

    // Status states
    const [locationStatus, setLocationStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
    const [notificationStatus, setNotificationStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
    const [batteryOptimized, setBatteryOptimized] = useState(true); // Default true (rossz), cél a false (unrestricted)
    // Megjegyzés: isIgnoringBatteryOptimizations = true azt jelenti, hogy KIVÉTEL, tehát JÓ!
    const [isBatteryWhitelisted, setIsBatteryWhitelisted] = useState(false);

    // Unused Apps Auto-Revoke
    // true = whitelisted (switch OFF) = GOOD ✅
    // false = not whitelisted (switch ON) = BAD ❌
    const [isUnusedAppsWhitelisted, setIsUnusedAppsWhitelisted] = useState(false);

    const [systemSettingsConfirmed, setSystemSettingsConfirmed] = useState(false);
    const [permissionsCompleted, setPermissionsCompleted] = useState(false);
    const [isMocked, setIsMocked] = useState(false);
    const [mockLocked, setMockLocked] = useState(false);

    const appState = useRef(AppState.currentState);

    // Initial Load
    useEffect(() => {
        if (Platform.OS === 'web') {
            setPermissionsGranted(true);
            return;
        }
        loadSettings();
        checkPermissions();
    }, []);

    // Periodic Check - folyamatosan fut, hogy mock location-t is ellenőrizze!
    useEffect(() => {
        if (Platform.OS === 'web') return;

        const interval = setInterval(checkPermissions, 2000);
        return () => clearInterval(interval);
    }, [showModal]);

    const loadSettings = async () => {
        const val = await AsyncStorage.getItem(SETTINGS_CONFIRMED_KEY);
        if (val === 'true') setSystemSettingsConfirmed(true);

        const completed = await AsyncStorage.getItem(PERMISSIONS_COMPLETED_KEY);
        if (completed === 'true') setPermissionsCompleted(true);
    };

    const checkPermissions = useCallback(async () => {
        try {
            // 1. Location (Background - Critical)
            const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
            setLocationStatus(bgStatus === 'granted' ? 'granted' : 'denied');

            // 2. Notifications
            const { status: notifStatus } = await Notifications.getPermissionsAsync();
            setNotificationStatus(notifStatus === 'granted' ? 'granted' : 'denied');

            // 3. Mock Location - TEMPORARILY DISABLED
            // TODO: Re-implement mock location detection later
            /*
            if (Platform.OS === 'android') {
                const mockedValue = await AsyncStorage.getItem('IS_MOCKED_LOCATION');
                const mocked = mockedValue === 'true';
                setIsMocked(mocked);

                // --- ADMIN KIVÉTEL ---
                if (mocked) {
                    if (loading) {
                        console.log("Mock check waiting for profile load...");
                        return; // Wait
                    }

                    if (userProfile?.role === 'admin') {
                        // Ensure IS_ADMIN is set for background task
                        AsyncStorage.setItem('IS_ADMIN', 'true');
                        console.log("Mock detected but ignored for admin.");
                        setMockLocked(false);
                    } else {
                        // Ensure IS_ADMIN is false
                        AsyncStorage.setItem('IS_ADMIN', 'false');

                        // If no profile yet, don't lock immediately to avoid race condition during login
                        if (!userProfile) {
                            console.log("Mock check waiting for userProfile...");
                            return;
                        }

                        // CSAK AKKOR küldjünk értesítést, ha MOST váltott mock-ra (nem volt locked)
                        const wasLocked = mockLocked;
                        setMockLocked(true);

                        if (!wasLocked && auth.currentUser) {
                            console.log("🚨 Mock Location Detected! Performing auto-checkout NOW.");

                            // Send notification ONCE
                            Notifications.scheduleNotificationAsync({
                                content: {
                                    title: "Biztonsági rendszer",
                                    body: "Helyimitálás gyanúja miatt automatikusan kijelentkeztettünk.",
                                    sound: true,
                                    priority: Notifications.AndroidNotificationPriority.HIGH,
                                },
                                trigger: null,
                            });

                            // Checkout from all locations
                            checkoutFromAllLocations(auth.currentUser.uid).catch(err => console.error("Checkout failed:", err));
                        }
                    }
                } else {
                    // Mock location NINCS → töröljük a lock-ot
                    if (mockLocked) {
                        console.log("✅ Mock location cleared - unlocking app");
                        setMockLocked(false);
                        setIsMocked(false);
                    }
                }
            }
            */

            // 4. Battery Optimization Check (Native Module)
            if (Platform.OS === 'android' && BatteryOptimization) {
                try {
                    const isWhitelisted = await BatteryOptimization.isIgnoringBatteryOptimizations();
                    setIsBatteryWhitelisted(isWhitelisted);
                } catch (e) {
                    console.log('Battery check failed', e);
                    setIsBatteryWhitelisted(true); // Fallback to allow usage if check fails
                }
            } else {
                setIsBatteryWhitelisted(true); // iOS or no module
            }

            // 4. Unused Apps Auto-Revoke (Android 11+)
            if (Platform.OS === 'android') {
                try {
                    // Check if method exists (might be old native build in dev)
                    if (UnusedAppsModule && UnusedAppsModule.isWhitelisted) {
                        const isWhitelisted = await UnusedAppsModule.isWhitelisted();
                        setIsUnusedAppsWhitelisted(isWhitelisted);
                    } else {
                        // Fallback for older builds without this method
                        setIsUnusedAppsWhitelisted(true);
                    }
                } catch (e) {
                    console.log('Unused apps check failed', e);
                    setIsUnusedAppsWhitelisted(true);
                }
            } else {
                setIsUnusedAppsWhitelisted(true);
            }

            // If Mocked (and LOCKED) -> Block
            if (Platform.OS === 'android' && (mockLocked)) {
                logger.log('Permissions BLOCKED by Mock Lock');
                setPermissionsGranted(false);
                return;
            }

            // Check All Met
            const isIos = Platform.OS === 'ios';
            const allMet =
                bgStatus === 'granted' &&
                notifStatus === 'granted' &&
                (isIos || (isBatteryWhitelisted && systemSettingsConfirmed));

            if (allMet) {
                logger.log('Permissions Granted, entering app');
                setPermissionsGranted(true);
                setShowModal(false);
                if (!permissionsCompleted) {
                    await AsyncStorage.setItem(PERMISSIONS_COMPLETED_KEY, 'true');
                    setPermissionsCompleted(true);
                }
            } else {
                setPermissionsGranted(false);
                // Show modal logic
                if (!showModal && (!permissionsCompleted || (permissionsCompleted && (bgStatus !== 'granted' || notifStatus !== 'granted')))) {
                    setShowModal(true);
                }
            }
        } catch (error) {
            console.error("Permission check error:", error);
        }
    }, [systemSettingsConfirmed, mockLocked, showModal, permissionsCompleted, userProfile]);

    // AppState for auto-check on return
    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                checkPermissions();
                // "Unused Apps" - Mivel nincs egzakt API, feltételezzük, hogy megcsinálta, ha visszatér a beállításokból
                checkPermissions();
            }
            appState.current = nextAppState;
        });
        return () => subscription.remove();
    }, [checkPermissions]);

    // Auto-checkout on Mock Location Detection
    useEffect(() => {
        if (loading) return; // Wait for profile
        // Skip for Admins
        if (userProfile?.role === 'admin') return;

        if (mockLocked && auth.currentUser) {
            console.log("Mock Location Detected! Performing auto-checkout.");

            // Send notification to user so they know WHY they were kicked
            Notifications.scheduleNotificationAsync({
                content: {
                    title: "Biztonsági rendszer",
                    body: "Helyimitálás gyanúja miatt automatikusan kijelentkeztettünk.",
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                },
                trigger: null,
            });

            checkoutFromAllLocations(auth.currentUser.uid).catch(err => console.error("Checkout failed:", err));
        }
    }, [mockLocked, userProfile, loading]);

    const handleOpenSettings = async () => {
        if (Platform.OS === 'ios') {
            Linking.openURL('app-settings:');
        } else {
            Linking.openSettings();
        }
    };

    // --- STEP ACTIONS ---

    const handleLocationAction = async () => {
        // Try requesting
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus === 'granted') {
            const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
            if (bgStatus !== 'granted') handleOpenSettings();
        } else {
            handleOpenSettings();
        }
    };

    const handleNotificationAction = async () => {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') handleOpenSettings();
    };

    const handleBatteryAction = async () => {
        // A felhasználó kérése: "alkalmazásinformáció akkumulátor menübe vigye"
        // Ez általában a handleOpenSettings (App Info) -> Akkumulátor almenü manuális választása
        handleOpenSettings();
    };

    const advanceStep = () => {
        if (currentStep === 'location') setCurrentStep('notification');
        else if (currentStep === 'notification') {
            if (Platform.OS === 'ios') {
                setSystemSettingsConfirmed(true);
                AsyncStorage.setItem(SETTINGS_CONFIRMED_KEY, 'true');
                setCurrentStep('completed');
            } else {
                setCurrentStep('unused_apps');
            }
        }
        else if (currentStep === 'unused_apps') setCurrentStep('battery');
        else if (currentStep === 'battery') {
            setSystemSettingsConfirmed(true);
            AsyncStorage.setItem(SETTINGS_CONFIRMED_KEY, 'true');
            setCurrentStep('completed');
        }
    };

    const getManufacturerTip = () => {
        if (!Device.manufacturer) return "";
        const m = Device.manufacturer.toLowerCase();

        if (m.includes('samsung')) {
            return `\n\n📱 Samsung lépések:
1. Beállítások → Alkalmazások
2. Elitdroszt → Akkumulátor
3. Válaszd: "Nem korlátozott"`;
        }

        if (m.includes('huawei')) {
            return `\n\n📱 Huawei lépések:
1. Beállítások → Akkumulátor
2. Alkalmazásindítás → Elitdroszt
3. Kapcsold KI (Kézi kezelés)
4. Mind a 3 pipa legyen BE:
   ✓ Automatikus indítás
   ✓ Másodlagos indítás  
   ✓ Futtatás háttérben`;
        }

        if (m.includes('xiaomi') || m.includes('redmi') || m.includes('poco')) {
            return `\n\n📱 Xiaomi/Redmi/Poco lépések:
1. Beállítások → Alkalmazások
2. Alkalmazások kezelése → Elitdroszt
3. Akkumulátorkímélő → "Nincs korlátozás"
4. Engedélyek → Automatikus indítás → BE`;
        }

        if (m.includes('oppo') || m.includes('realme') || m.includes('oneplus')) {
            return `\n\n📱 Oppo/Realme/OnePlus lépések:
1. Beállítások → Alkalmazások → Elitdroszt
2. Akkumulátorhasználat
3. "Háttérben végzett tevékenység": BE`;
        }

        if (m.includes('sony')) {
            return `\n\n📱 Sony lépések:
1. Beállítások → Akkumulátor
2. STAMINA üzemmód → Kivételek
3. Add hozzá: Elitdroszt`;
        }

        if (m.includes('lg')) {
            return `\n\n📱 LG lépések:
1. Beállítások → Általános
2. Akkumulátor → Energiatakarékos kivételek
3. Add hozzá: Elitdroszt`;
        }

        if (m.includes('motorola')) {
            return `\n\n📱 Motorola lépések:
1. Beállítások → Akkumulátor
2. Akkumulátoroptimalizálás
3. Elitdroszt → "Nincs optimalizálás"`;
        }

        return `\n\n📱 Általános lépések:
1. Beállítások → Alkalmazások → Elitdroszt
2. Akkumulátor
3. Állítsd "Nem korlátozott" módra`;
    };

    const getUnusedAppsTip = () => {
        if (!Device.manufacturer) return "";
        const m = Device.manufacturer.toLowerCase();

        if (m.includes('samsung')) {
            return `\n\n📱 Samsung lépések:
1. Beállítások → Alkalmazások
2. Elitdroszt → Engedélyek
3. Jobb felső sarok: ⋮ (három pont)
4. "Nem haszn. alk. engedélyeinek eltáv." → KI`;
        }

        if (m.includes('xiaomi') || m.includes('redmi') || m.includes('poco')) {
            return `\n\n📱 Xiaomi/Redmi/Poco lépések:
1. Beállítások → Alkalmazások
2. Alkalmazások kezelése → Elitdroszt
3. Engedélyek
4. "Engedélyek eltávolítása, ha nincs használatban" → KI`;
        }

        if (m.includes('huawei')) {
            return `\n\n📱 Huawei megjegyzés:
Huawei készülékeken nincs külön "Unused Apps" beállítás.
Az "Alkalmazásindítás" beállítás (Battery step) elegendő.`;
        }

        if (m.includes('oppo') || m.includes('realme')) {
            return `\n\n📱 Oppo/Realme lépések:
1. Beállítások → Alkalmazások
2. Alkalmazáslista → Elitdroszt
3. "Szüneteltetés, ha nincs használatban" → KI`;
        }

        if (m.includes('oneplus')) {
            return `\n\n📱 OnePlus lépések:
1. Beállítások → Alkalmazások → Elitdroszt
2. "Szüneteltetés, ha nincs használatban" → KI`;
        }

        if (m.includes('motorola')) {
            return `\n\n📱 Motorola lépések:
1. Beállítások → Alkalmazások → Elitdroszt
2. Engedélyek
3. "Engedélyek eltávolítása, ha nincs használatban" → KI`;
        }

        if (m.includes('lg')) {
            return `\n\n📱 LG lépések:
1. Beállítások → Alkalmazások → Elitdroszt
2. Engedélyek
3. "Engedélyek eltávolítása, ha nincs használatban" → KI`;
        }

        if (m.includes('sony')) {
            return `\n\n📱 Sony lépések:
1. Beállítások → Alkalmazások → Elitdroszt
2. Engedélyek
3. "Engedélyek eltávolítása, ha nincs használatban" → KI`;
        }

        return `\n\n📱 Általános lépések:
1. Beállítások → Alkalmazások → Elitdroszt
2. Engedélyek
3. Keresd: "Engedélyek eltávolítása..." → KI`;
    };

    const handleUnlockMock = async () => {
        // NE töröljük a flag-et! Csak ellenőrizzük újra!
        // Ha a mock location tényleg ki van kapcsolva, a checkPermissions törli majd.
        console.log("🔍 Mock unlock requested - re-checking permissions...");
        await checkPermissions();
    };


    // --- RENDERING ---

    if (mockLocked) {
        return (
            <Modal visible={true} animationType="none">
                <View style={[styles.container, { justifyContent: 'center', backgroundColor: '#fee2e2', padding: 24, alignItems: 'center' }]}>
                    <Ionicons name="warning" size={100} color="#dc2626" />
                    <Text style={[styles.stepTitle, { color: '#dc2626', marginTop: 20 }]}>HELYIMITÁLÁS ÉSZLELVE!</Text>
                    <Text style={[styles.stepDesc, { color: '#7f1d1d' }]}>
                        Biztonsági okokból kérlek kapcsold ki a helyimitálást (Mock Location) a Fejlesztői Beállításokban!
                    </Text>
                    <TouchableOpacity style={[styles.mainButton, { backgroundColor: '#dc2626' }]} onPress={handleUnlockMock}>
                        <Text style={styles.mainButtonText}>Ellenőrzés</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        );
    }

    if (permissionsGranted) {
        return <>{children}</>;
    }

    const renderContent = () => {
        switch (currentStep) {
            case 'location':
                const locReady = locationStatus === 'granted';
                return (
                    <View style={styles.stepContainer}>
                        <Ionicons name="location" size={80} color="#f59e0b" />
                        <Text style={styles.bigText}>
                            Helymeghatározás{"\n"}
                            <Text style={styles.subText}>Az alkalmazás használata közben → Mindig engedélyezett</Text>
                        </Text>

                        <TouchableOpacity style={styles.mainButton} onPress={handleLocationAction}>
                            <Text style={styles.mainButtonText}>Beállítások megnyitása</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.nextButton, !locReady && styles.disabledButton]}
                            onPress={advanceStep}
                            disabled={!locReady}
                        >
                            <Text style={styles.nextButtonText}>Tovább</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 'notification':
                const notifReady = notificationStatus === 'granted';
                return (
                    <View style={styles.stepContainer}>
                        <Ionicons name="notifications" size={80} color="#ec4899" />
                        <Text style={styles.bigText}>
                            Értesítések{"\n"}
                            <Text style={styles.subText}>Kérlek engedélyezd az értesítést.</Text>
                        </Text>

                        <TouchableOpacity style={styles.mainButton} onPress={handleNotificationAction}>
                            <Text style={styles.mainButtonText}>Engedélyezés</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.nextButton, !notifReady && styles.disabledButton]}
                            onPress={advanceStep}
                            disabled={!notifReady}
                        >
                            <Text style={styles.nextButtonText}>Tovább</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 'unused_apps':
                return (
                    <View style={styles.stepContainer}>
                        <Ionicons name="apps" size={80} color="#6366f1" />
                        <Text style={styles.bigText}>
                            Jogosultságok megőrzése{"\n"}
                            <Text style={styles.subText}>{getUnusedAppsTip()}</Text>
                        </Text>

                        <TouchableOpacity
                            style={styles.mainButton}
                            onPress={() => UnusedAppsModule && UnusedAppsModule.openSettings()}
                        >
                            <Text style={styles.mainButtonText}>Beállítások megnyitása</Text>
                        </TouchableOpacity>

                        <View style={{ marginTop: 10, alignItems: 'center' }}>
                            {isUnusedAppsWhitelisted ? (
                                <Text style={{ color: '#10b981', fontWeight: 'bold' }}>✓ Kikapcsolva (Rendben)</Text>
                            ) : (
                                <Text style={{ color: '#ef4444', fontSize: 12 }}>❌ Bekapcsolva (Kapcsold ki!)</Text>
                            )}
                        </View>

                        <TouchableOpacity
                            style={[styles.nextButton, !isUnusedAppsWhitelisted && styles.disabledButton]}
                            onPress={advanceStep}
                            disabled={!isUnusedAppsWhitelisted}
                        >
                            <Text style={styles.nextButtonText}>Tovább</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 'battery':
                return (
                    <View style={styles.stepContainer}>
                        <Ionicons name="battery-dead" size={80} color="#ef4444" />
                        <Text style={styles.bigText}>
                            Akkumulátorhasználat{"\n"}
                            <Text style={styles.subText}>Kérlek állítsd nem korlátozott módba</Text>
                            <Text style={styles.tipText}>{getManufacturerTip()}</Text>
                        </Text>

                        <TouchableOpacity style={styles.mainButton} onPress={handleBatteryAction}>
                            <Text style={styles.mainButtonText}>Beállítások megnyitása</Text>
                        </TouchableOpacity>

                        <View style={{ marginTop: 10, alignItems: 'center' }}>
                            {isBatteryWhitelisted ? (
                                <Text style={{ color: '#10b981', fontWeight: 'bold' }}>✓ Rendszer szerint OK!</Text>
                            ) : (
                                <Text style={{ color: '#ef4444', fontSize: 12 }}>Rendszer szerint még korlátozva van</Text>
                            )}
                        </View>

                        <TouchableOpacity
                            style={[styles.nextButton, !isBatteryWhitelisted && styles.disabledButton]}
                            onPress={advanceStep}
                            disabled={!isBatteryWhitelisted}
                        >
                            <Text style={styles.nextButtonText}>Kész</Text>
                        </TouchableOpacity>
                    </View>
                );

            case 'completed':
                return (
                    <View style={styles.stepContainer}>
                        <Ionicons name="rocket" size={80} color="#10b981" />
                        <Text style={styles.bigText}>Minden Kész!</Text>
                        <TouchableOpacity style={styles.successButton} onPress={checkPermissions}>
                            <Text style={styles.successButtonText}>BELÉPÉS</Text>
                        </TouchableOpacity>
                    </View>
                );
        }
    };

    return (
        <Modal visible={showModal} animationType="slide" transparent={false}>
            <View style={styles.container}>
                <View style={styles.progressBar}>
                    <View style={[styles.progressFill, {
                        width:
                            currentStep === 'location' ? '25%' :
                                currentStep === 'notification' ? '50%' :
                                    currentStep === 'unused_apps' ? '75%' : '100%'
                    }]} />
                </View>
                <View style={styles.content}>
                    {renderContent()}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff' },
    progressBar: { height: 8, backgroundColor: '#f3f4f6', width: '100%', marginTop: Platform.OS === 'ios' ? 60 : 40 },
    progressFill: { height: '100%', backgroundColor: '#4f46e5' },
    content: { flex: 1, justifyContent: 'center', padding: 24, alignItems: 'center' },
    stepContainer: { alignItems: 'center', gap: 20, width: '100%' },
    bigText: { fontSize: 22, fontWeight: 'bold', color: '#111827', textAlign: 'center', lineHeight: 32 },
    subText: { fontSize: 18, color: '#4b5563', fontWeight: 'normal', display: 'flex' },
    tipText: { fontSize: 14, fontWeight: 'normal', fontStyle: 'italic', marginTop: 10, color: '#6b7280' },
    stepTitle: { fontSize: 24, fontWeight: 'bold' },
    stepDesc: { fontSize: 16, textAlign: 'center', marginVertical: 10 },
    mainButton: { backgroundColor: '#4f46e5', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, width: '100%', alignItems: 'center', elevation: 4 },
    mainButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
    nextButton: { backgroundColor: '#10b981', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12, width: '100%', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, elevation: 2 },
    nextButtonText: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
    disabledButton: { backgroundColor: '#d1d5db', elevation: 0 },
    successButton: { backgroundColor: '#10b981', paddingVertical: 18, paddingHorizontal: 32, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 6 },
    successButtonText: { color: '#ffffff', fontSize: 20, fontWeight: 'bold' },
    checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 10, gap: 10, padding: 10, backgroundColor: '#f9fafb', borderRadius: 8, width: '100%' },
    checkbox: { width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: '#4f46e5', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' },
    checkboxChecked: { backgroundColor: '#4f46e5' },
    checkboxLabel: { fontSize: 16, color: '#374151', fontWeight: '500' },
});
