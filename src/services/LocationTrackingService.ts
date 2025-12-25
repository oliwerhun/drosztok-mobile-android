import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { doc, setDoc, deleteDoc, updateDoc, arrayRemove, getDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { undoService } from './UndoService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { isPointInPolygon, GEOFENCED_LOCATIONS } from './GeofenceService';
import { logger } from '../utils/Logger';

const LOCATION_TASK_NAME = 'background-location-task';
const ACTIVE_CHECKIN_KEY = 'active_checkin_data';
const GEOFENCE_VIOLATION_KEY = 'GEOFENCE_VIOLATION_COUNT';

// Helper for checkDriverActivity (placeholder if lost)
const checkDriverActivity = async () => {
    // Implement heartbeat logic here if needed
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
                    await checkDriverActivity();

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
                                let violationCount = parseInt(await AsyncStorage.getItem(GEOFENCE_VIOLATION_KEY) || '0', 10);
                                violationCount++;
                                await AsyncStorage.setItem(GEOFENCE_VIOLATION_KEY, violationCount.toString());
                                logger.log(`OUTSIDE Geofence! Count: ${violationCount}/10`, { geofence: geofenceName });

                                if (violationCount >= 10) {
                                    logger.log('!!! VIOLATION LIMIT REACHED -> AUTO CHECKOUT DISABLED (V-NO-TRACKING) !!!');

                                    // ITT VOLT A KIDOBÁS, DE MOST KIKAPCSOLJUK
                                    /*
                                    await AsyncStorage.removeItem(ACTIVE_CHECKIN_KEY);
                                    await AsyncStorage.removeItem(GEOFENCE_VIOLATION_KEY);
                                    undoService.clear();
                                    await Notifications.scheduleNotificationAsync({
                                        content: {
                                            title: "Automatikus Kijelentkezés",
                                            body: "Elhagytad a zónát, ezért a rendszer kijelentkeztetett.",
                                        },
                                        trigger: null,
                                    });
                                    // ... Firestore checkout logic ...
                                    */
                                }
                            } else {
                                // User is inside, reset counter
                                logger.log('Inside Geofence OK. Resetting counter.');
                                await AsyncStorage.removeItem(GEOFENCE_VIOLATION_KEY);
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

export const startLocationTracking = async () => {
    logger.log('Starting Tracking Service...');
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
        console.log('Foreground location permission denied');
        return false;
    }

    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
        console.log('Background location permission denied');
        return false;
    }

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
        distanceInterval: 10,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
            notificationTitle: "Helyzetkövetés Aktív",
            notificationBody: "A Droszt app figyeli a pozíciódat.",
        },
    });
    console.log('Background location tracking started');
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
    } catch (error) {
        console.error('Error stopping location tracking:', error);
    }
};

// Placeholder for checkoutFromAllLocations if needed by other parts of the code
// but since we removed the call, we don't strictly need it here unless exported used elsewhere.
