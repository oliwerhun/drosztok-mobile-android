import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import PermissionGuard from './src/components/PermissionGuard';
import { ThemeProvider } from './src/context/ThemeContext';
import { FontSizeProvider } from './src/context/FontSizeContext';
import GeofenceService from './src/services/GeofenceService';
import { registerHeartbeatTask, respondToHeartbeat } from './src/services/HeartbeatService';
import { HeartbeatDialog } from './src/components/HeartbeatDialog';
import * as Notifications from 'expo-notifications';

import ErrorBoundary from './src/components/ErrorBoundary';

export default function App() {
  const [showHeartbeatDialog, setShowHeartbeatDialog] = useState(false);

  // Initialize global GPS tracking service on app launch
  useEffect(() => {
    console.log('App: Starting GeofenceService');
    GeofenceService.startTracking();

    // Register heartbeat task
    registerHeartbeatTask();

    // Listen for heartbeat notifications
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      if (response.notification.request.content.data.type === 'heartbeat') {
        setShowHeartbeatDialog(true);
      }
    });

    return () => {
      console.log('App: Stopping GeofenceService');
      GeofenceService.stopTracking();
      subscription.remove();
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
