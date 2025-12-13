import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import PermissionGuard from './src/components/PermissionGuard';
import { ThemeProvider } from './src/context/ThemeContext';
import { FontSizeProvider } from './src/context/FontSizeContext';
import GeofenceService from './src/services/GeofenceService';

import ErrorBoundary from './src/components/ErrorBoundary';

export default function App() {
  // Initialize global GPS tracking service on app launch
  useEffect(() => {
    console.log('App: Starting GeofenceService');
    GeofenceService.startTracking();

    return () => {
      console.log('App: Stopping GeofenceService');
      GeofenceService.stopTracking();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <FontSizeProvider>
            <ThemeProvider>
              <AuthProvider>
                <PermissionGuard>
                  <AppNavigator />
                </PermissionGuard>
              </AuthProvider>
            </ThemeProvider>
          </FontSizeProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
