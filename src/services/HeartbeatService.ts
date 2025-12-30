import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

const HEARTBEAT_TASK = 'heartbeat-check';
const LAST_ACTIVITY_KEY = 'last_activity_timestamp';
const HEARTBEAT_RESPONSE_KEY = 'heartbeat_pending';
const HEARTBEAT_TIMEOUT = 4 * 60 * 1000; // 4 minutes

let heartbeatTimeoutId: NodeJS.Timeout | null = null;

// Define background task
TaskManager.defineTask(HEARTBEAT_TASK, async () => {
    console.log('🔔 [HEARTBEAT] Background task triggered');

    const lastActivity = await AsyncStorage.getItem(LAST_ACTIVITY_KEY);
    const now = Date.now();
    const elapsed = now - parseInt(lastActivity || '0');

    // 55 minutes = 3,300,000 ms (for testing: 2 minutes = 120,000 ms)
    const HEARTBEAT_INTERVAL = 2 * 60 * 1000; // TODO: Change to 55 * 60 * 1000 for production

    if (elapsed >= HEARTBEAT_INTERVAL) {
        console.log('⏰ [HEARTBEAT] 55 minutes elapsed, triggering check');
        await triggerHeartbeatCheck();
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
});

export const registerHeartbeatTask = async () => {
    try {
        await BackgroundFetch.registerTaskAsync(HEARTBEAT_TASK, {
            minimumInterval: 2 * 60, // 2 minutes for testing, change to 55 * 60 for production
            stopOnTerminate: false,
            startOnBoot: true,
        });

        // Initialize last activity timestamp
        await resetHeartbeat();
        console.log('✅ [HEARTBEAT] Task registered');
    } catch (error) {
        console.error('❌ [HEARTBEAT] Failed to register task:', error);
    }
};

export const unregisterHeartbeatTask = async () => {
    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(HEARTBEAT_TASK);
        if (isRegistered) {
            await BackgroundFetch.unregisterTaskAsync(HEARTBEAT_TASK);
            console.log('✅ [HEARTBEAT] Task unregistered');
        } else {
            console.log('ℹ️ [HEARTBEAT] Task was not registered, skipping unregister');
        }
    } catch (error) {
        // Suppress "Task not found" errors as they are expected if task wasn't running
        console.log('⚠️ [HEARTBEAT] Warning during unregister (non-fatal):', error);
    }
};

const triggerHeartbeatCheck = async () => {
    const appState = AppState.currentState;
    console.log('📱 [HEARTBEAT] App state:', appState);

    // Set pending flag with timestamp
    await AsyncStorage.setItem(HEARTBEAT_RESPONSE_KEY, Date.now().toString());

    if (appState === 'active') {
        // App in foreground - do nothing, already working
        console.log('✅ [HEARTBEAT] App active, resetting timer');
        await resetHeartbeat();
        return;
    }

    // Send push notification (works for both background and locked screen)
    await sendHeartbeatNotification();

    // Start 4-minute timeout
    if (heartbeatTimeoutId) {
        clearTimeout(heartbeatTimeoutId);
    }
    heartbeatTimeoutId = setTimeout(checkHeartbeatResponse, HEARTBEAT_TIMEOUT);
};

const sendHeartbeatNotification = async () => {
    console.log('📬 [HEARTBEAT] Sending notification');

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
};

const checkHeartbeatResponse = async () => {
    const pending = await AsyncStorage.getItem(HEARTBEAT_RESPONSE_KEY);

    if (pending) {
        console.log('⏱️ [HEARTBEAT] Timeout - no response');
        await handleHeartbeatTimeout();
    } else {
        console.log('✅ [HEARTBEAT] Response received in time');
    }
};

export const respondToHeartbeat = async (response: 'yes' | 'no') => {
    console.log('💬 [HEARTBEAT] Response:', response);

    // Clear pending flag
    await AsyncStorage.removeItem(HEARTBEAT_RESPONSE_KEY);

    // Clear timeout
    if (heartbeatTimeoutId) {
        clearTimeout(heartbeatTimeoutId);
        heartbeatTimeoutId = null;
    }

    if (response === 'yes') {
        await resetHeartbeat();
    } else {
        await handleHeartbeatTimeout();
    }
};

export const resetHeartbeat = async () => {
    await AsyncStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    await AsyncStorage.removeItem(HEARTBEAT_RESPONSE_KEY);
    console.log('🔄 [HEARTBEAT] Timer reset');
};

export const handleHeartbeatTimeout = async () => {
    console.log('🚨 [HEARTBEAT] Handling timeout - logging out');

    try {
        const userId = await AsyncStorage.getItem('USER_ID');

        // Send notification about timeout
        await Notifications.scheduleNotificationAsync({
            content: {
                title: '⚠️ Automatikus Kijelentkezés',
                body: 'Nem válaszoltál, ezért a rendszer kiléptetett!',
                sound: true,
                priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: null,
        });

        // Wait a bit for notification to be seen
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 1. Clear undo stack (disable Flame)
        await AsyncStorage.removeItem('undo_stack');
        console.log('🔥 [HEARTBEAT] Undo stack cleared (Flame disabled)');

        // 2. Delete driver location
        if (userId) {
            const locationRef = doc(db, 'driver_locations', userId);
            await deleteDoc(locationRef);
            console.log('📍 [HEARTBEAT] Driver location deleted');
        }

        // 3. Remove USER_ID
        await AsyncStorage.removeItem('USER_ID');

        // 4. Clear heartbeat state
        await AsyncStorage.removeItem(HEARTBEAT_RESPONSE_KEY);
        await AsyncStorage.removeItem(LAST_ACTIVITY_KEY);

        // 5. Sign out
        await signOut(auth);
        console.log('👋 [HEARTBEAT] User signed out');

        // Note: Checkout from locations will be handled by existing logout flow
    } catch (error) {
        console.error('❌ [HEARTBEAT] Error during timeout handling:', error);
    }
};
