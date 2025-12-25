import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import PermissionGuard from './src/components/PermissionGuard';
import { ThemeProvider } from './src/context/ThemeContext';
import { FontSizeProvider } from './src/context/FontSizeContext';
import GeofenceService from './src/services/GeofenceService';
import { respondToHeartbeat } from './src/services/HeartbeatService';
import { HeartbeatDialog } from './src/components/HeartbeatDialog';
import * as Notifications from 'expo-notifications';

import ErrorBoundary from './src/components/ErrorBoundary';

export default function App() {
  const [showHeartbeatDialog, setShowHeartbeatDialog] = useState(false);

  // Initialize global GPS tracking service on app launch
  useEffect(() => {
    console.log('App: Starting GeofenceService');
    GeofenceService.startTracking();

    // Unregister legacy heartbeat task (integrated into location service now)
    const { unregisterHeartbeatTask } = require('./src/services/HeartbeatService');
    unregisterHeartbeatTask();

    // Listen for heartbeat notifications
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      if (response.notification.request.content.data.type === 'heartbeat') {
        setShowHeartbeatDialog(true);
      }
    });

    // Check for pending heartbeat when coming to foreground
    const appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        const pending = await AsyncStorage.getItem('heartbeat_pending');
        if (pending) {
          console.log('👀 [APP] Resumed with pending heartbeat -> Showing Dialog');
          setShowHeartbeatDialog(true);
        }
      }
    });

    return () => {
      console.log('App: Stopping GeofenceService');
      GeofenceService.stopTracking();
      subscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  const handleHeartbeatResponse = async (response: 'yes' | 'no') => {
    setShowHeartbeatDialog(false);
    await respondToHeartbeat(response);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <FontSizeProvider>
            <ThemeProvider>
              <AuthProvider>
                <PermissionGuard>
                  <AppNavigator />
                  <HeartbeatDialog
                    visible={showHeartbeatDialog}
                    onResponse={handleHeartbeatResponse}
                  />
                </PermissionGuard>
              </AuthProvider>
            </ThemeProvider>
          </FontSizeProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
