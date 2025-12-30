import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { doc, setDoc, deleteDoc, updateDoc, arrayRemove, getDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { undoService } from './UndoService';
import { checkoutFromLocation } from './LocationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { isPointInPolygon, GEOFENCED_LOCATIONS } from './GeofenceService';
import { logger } from '../utils/Logger';
import * as IntentLauncher from 'expo-intent-launcher';
import { Alert, Linking, Platform } from 'react-native';
import { GeofenceService } from './GeofenceService';


const LOCATION_TASK_NAME = 'background-location-task';
const ACTIVE_CHECKIN_KEY = 'active_checkin_data';
const GEOFENCE_VIOLATION_KEY = 'GEOFENCE_VIOLATION_COUNT';

// Helper for checkDriverActivity (heartbeat check)
const checkDriverActivity = async () => {
    const LAST_ACTIVITY_KEY = 'last_activity_timestamp';
    const HEARTBEAT_RESPONSE_KEY = 'heartbeat_pending';
    const HEARTBEAT_INTERVAL = 55 * 60 * 1000; // 55 minutes for production
    const HEARTBEAT_TIMEOUT = 4 * 60 * 1000; // 4 minutes

    const now = Date.now();

    // 1. Check if we have a pending heartbeat timeout
    const pending = await AsyncStorage.getItem(HEARTBEAT_RESPONSE_KEY);
    if (pending) {
        const pendingTime = parseInt(pending);
        const timeSinceNotification = now - pendingTime;

        if (timeSinceNotification >= HEARTBEAT_TIMEOUT) {
            console.log('⏱️ [HEARTBEAT] Timeout reached (polling) - logging out');
            const { handleHeartbeatTimeout } = require('./HeartbeatService');
            await handleHeartbeatTimeout();
            return; // Exit after handling timeout
        }
    }

    // 2. Check if we need to trigger a new heartbeat
    const lastActivity = await AsyncStorage.getItem(LAST_ACTIVITY_KEY);
    const elapsed = now - parseInt(lastActivity || '0');

    if (elapsed >= HEARTBEAT_INTERVAL) {
        const appState = AppState.currentState;
        console.log('⏰ [HEARTBEAT] 2 minutes elapsed, app state:', appState);

        // If app is in foreground, just reset timestamp and continue
        if (appState === 'active') {
            console.log('✅ [HEARTBEAT] App active, resetting timer without notification');
            await AsyncStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
            // Clear pending if it was somehow set
            if (pending) {
                await AsyncStorage.removeItem(HEARTBEAT_RESPONSE_KEY);
            }
            return;
        }

        // Only trigger if not already pending
        if (!pending) {
            console.log('📬 [HEARTBEAT] App in background, sending notification');
            // Store CURRENT TIME as the start of the pending period
            await AsyncStorage.setItem(HEARTBEAT_RESPONSE_KEY, now.toString());

            // Send notification
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: '⚠️ Inaktivitás Figyelmeztetés',
                    body: 'Dolgozol még? Válaszolj 4 percen belül!',
                    data: { type: 'heartbeat' },
                    sound: true,
                    priority: Notifications.AndroidNotificationPriority.HIGH,
                    vibrate: [0, 250, 250, 250],
                },
                trigger: null,
            });
        }
    }
};

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    console.log('🔵 [BG TASK] Callback triggered!');
    if (error) {
        console.log('🔴 [BG TASK] Error:', error);
        logger.log('Location task error:', error);
        return;
    }
    if (data) {
        const { locations } = data as { locations: Location.LocationObject[] };
        console.log('🟢 [BG TASK] Received locations:', locations?.length || 0);
        const location = locations[0];

        if (location) {
            console.log('📍 [BG TASK] Location:', {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
                mocked: location.mocked
            });
            // Check for Mock Location
            if (location.mocked) {
                const isAdmin = await AsyncStorage.getItem('IS_ADMIN');
                console.log('⚠️ [BG TASK] Mock detected! isAdmin:', isAdmin);
                if (isAdmin === 'true') {
                    console.log('✅ [BG TASK] Mock detected but user is ADMIN -> IGNORED');
                    logger.log('Mock detected but user is ADMIN -> IGNORED');
                } else {
                    console.log('🚨 [BG TASK] Mock detected! Setting flag -> BLOCK');
                    logger.log('Mock detected! Setting flag -> BLOCK');
                    await AsyncStorage.setItem('IS_MOCKED_LOCATION', 'true');
                }
            } else {
                const wasMocked = await AsyncStorage.getItem('IS_MOCKED_LOCATION');
                if (wasMocked === 'true') {
                    console.log('✅ [BG TASK] Mock cleared.');
                    logger.log('Mock cleared.');
                    await AsyncStorage.removeItem('IS_MOCKED_LOCATION');
                }
            }

            // Get user ID from AsyncStorage (more reliable than auth.currentUser in background)
            const userId = await AsyncStorage.getItem('USER_ID');

            console.log('🔐 [BG TASK] Auth check:', {
                hasUserId: !!userId,
                uid: userId || 'NO_USER'
            });

            if (userId) {
                try {
                    console.log('📤 [BG TASK] Updating Firebase...');
                    // 1. Update location in Firestore
                    const userRef = doc(db, 'driver_locations', userId);
                    await setDoc(userRef, {
                        lat: location.coords.latitude,
                        lng: location.coords.longitude,
                        timestamp: Date.now(),
                    }, { merge: true });
                    console.log('✅ [BG TASK] Firebase updated successfully!');

                    // 1.5 Check Driver Activity
                    try {
                        await checkDriverActivity();
                    } catch (error) {
                        console.log('⚠️ [BG TASK] checkDriverActivity error (non-fatal):', error);
                    }


                    // 2. Check Geofence if user is checked in
                    const checkInData = await AsyncStorage.getItem(ACTIVE_CHECKIN_KEY);
                    if (checkInData) {
                        const { locationName, geofenceName, uid, enforceGeofence } = JSON.parse(checkInData);

                        if (uid !== userId) return;
                        if (enforceGeofence === false) return;

                        const polygon = GEOFENCED_LOCATIONS[geofenceName]?.polygon;
                        if (polygon) {
                            const point = { lat: location.coords.latitude, lng: location.coords.longitude };
                            const isInside = isPointInPolygon(point, polygon);

                            if (!isInside) {
                                // Timestamp-based strict kickout logic
                                const firstOutsideTimestamp = await AsyncStorage.getItem('FIRST_OUTSIDE_TIMESTAMP');
                                const now = Date.now();

                                if (!firstOutsideTimestamp) {
                                    // First time seen outside
                                    await AsyncStorage.setItem('FIRST_OUTSIDE_TIMESTAMP', now.toString());
                                    console.log('⚠️ [GEOFENCE] First time outside zone. Timer started.');
                                } else {
                                    const elapsed = now - parseInt(firstOutsideTimestamp, 10);
                                    console.log(`⏱️ [GEOFENCE] Time outside: ${elapsed}ms`);

                                    // 3 seconds threshold
                                    if (elapsed > 3000) {
                                        logger.log('!!! GEOFENCE TIMEOUT (3s) -> AUTO CHECKOUT !!!');

                                        await AsyncStorage.removeItem(ACTIVE_CHECKIN_KEY);
                                        await AsyncStorage.removeItem('FIRST_OUTSIDE_TIMESTAMP');
                                        undoService.clear();

                                        await Notifications.scheduleNotificationAsync({
                                            content: {
                                                title: "Automatikus Kijelentkezés",
                                                body: "Elhagytad a zónát, ezért a rendszer kijelentkeztetett.",
                                            },
                                            trigger: null,
                                        });

                                        // Perform actual checkout
                                        await checkoutFromLocation(locationName, uid);
                                    }
                                }
                            } else {
                                // User is inside, clear timestamp
                                const firstOutsideTimestamp = await AsyncStorage.getItem('FIRST_OUTSIDE_TIMESTAMP');
                                if (firstOutsideTimestamp) {
                                    console.log('✅ [GEOFENCE] Back inside zone. Timer reset.');
                                    await AsyncStorage.removeItem('FIRST_OUTSIDE_TIMESTAMP');
                                }
                            }
                        }
                    }

                } catch (err) {
                    console.error('🔴 [BG TASK] Firebase Error:', err);
                }
            } else {
                console.log('⚠️ [BG TASK] No USER_ID in AsyncStorage - skipping Firebase update');
            }
        }
    }
});

const GEOFENCE_TASK_NAME = 'native-geofence-task';

TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
    const { eventType, region } = (data as any) || {};
    if (error) {
        console.error('🔴 [Native Geofence] Task Error:', error);
        return;
    }

    // We only care about EXIT events
    if (eventType === Location.GeofencingEventType.Exit) {
        console.log('☢️ [Native Geofence] EXIT EVENT TRIGGERED! (Nuclear Code)');

        try {
            const uid = await AsyncStorage.getItem('user_uid');
            const activeCheckinStr = await AsyncStorage.getItem(ACTIVE_CHECKIN_KEY);

            if (uid && activeCheckinStr) {
                const { locationName } = JSON.parse(activeCheckinStr);

                // Double check if region matches current location (optional safety)
                if (region.identifier === locationName) {
                    console.log(`☢️ [Native Geofence] Kicking out from ${locationName}`);

                    // Perform Kickout Sequence
                    await AsyncStorage.removeItem(ACTIVE_CHECKIN_KEY);
                    await AsyncStorage.removeItem('FIRST_OUTSIDE_TIMESTAMP');
                    await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME).catch(() => { });

                    undoService.clear();

                    await Notifications.scheduleNotificationAsync({
                        content: {
                            title: "Zóna Elhagyás (Háttér)",
                            body: "A rendszer érzékelte a távozást. Kijelentkezve.",
                        },
                        trigger: null,
                    });

                    await checkoutFromLocation(locationName, uid);
                }
            } else {
                console.log('☢️ [Native Geofence] Exit triggered but no user/checkin found.');
            }
        } catch (e) {
            console.error('☢️ [Native Geofence] Error executing checkout:', e);
        }
    }
});

// checkForBatteryOptimization removed as it is handled by PermissionGuard

export const startLocationTracking = async () => {
    logger.log('Starting Tracking Service...');

    // 0. Battery Check - REMOVED (Handled by PermissionGuard)
    // await checkForBatteryOptimization();

    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isRegistered) {
        console.log('Location tracking task already registered - STOPPING to force update options...');
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    // Initialize heartbeat timestamp only when starting NEW tracking
    // For restart logic, we keep or update it.
    await AsyncStorage.setItem('last_activity_timestamp', Date.now().toString());

    // Request permissions again just to be safe
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
        console.log('Foreground permission denied');
        return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
        console.log('Background permission denied');
        return false;
    }

    console.log('Starting location updates with AGGRESSIVE options (v1.6.12)...');
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 0, // Update on ANY movement
        deferredUpdatesInterval: 0, // Immediate delivery
        pausesUpdatesAutomatically: false, // Prevent OS pause
        showsBackgroundLocationIndicator: true,
        foregroundService: {
            notificationTitle: "Elitdroszt",
            notificationBody: "Be vagy jelentkezve (Aktív Követés).",
        },
    });

    // 2. Start Geofencing Fallback (if checked in)
    try {
        const activeCheckinStr = await AsyncStorage.getItem(ACTIVE_CHECKIN_KEY);
        if (activeCheckinStr) {
            const { locationName } = JSON.parse(activeCheckinStr);
            // Use the static method from the imported class
            const region = GeofenceService.getCircularRegion(locationName);

            if (region) {
                console.log(`Starting Fallback Geofence for: ${locationName}`, region);
                await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, [{
                    ...region,
                    identifier: locationName,
                    notifyOnEnter: false,
                    notifyOnExit: true,
                }]);
            }
        }
    } catch (e) {
        console.log('Error starting geofence fallback:', e);
    }

    console.log('Location tracking started successfully');
    return true;
};

export const stopLocationTracking = async () => {
    logger.log('Stopping Tracking Service...');
    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
        if (isRegistered) {
            await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
            console.log('Background location tracking stopped');
        }

        // Stop Geofencing too
        const isGeofenceRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK_NAME);
        if (isGeofenceRegistered) {
            await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
            console.log('Geofencing fallback stopped');
        }
    } catch (error) {
        console.error('Error stopping location tracking:', error);
    }
};

// Placeholder for checkoutFromAllLocations if needed by other parts of the code
// but since we removed the call, we don't strictly need it here unless exported used elsewhere.
