import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import LocationScreen from './LocationScreen';

const Tab = createBottomTabNavigator();

// ========================================
// LOCATION SCREEN WRAPPER KOMPONENSEK
// ========================================

const AkademiaScreen = () => (
  <LocationScreen locationName="Akadémia" locationTitle="Akadémia Sor" />
);

const BelvarosScreen = () => (
  <LocationScreen locationName="Belváros" locationTitle="Belvárosi Sor" />
);

const BudaiScreen = () => (
  <LocationScreen locationName="Budai" locationTitle="Budai Sor" />
);

const ContiScreen = () => (
  <LocationScreen locationName="Conti" locationTitle="Conti Sor" />
);

const CrowneScreen = () => (
  <LocationScreen locationName="Crowne" locationTitle="Crowne Plaza Sor" />
);

const KozmoScreen = () => (
  <LocationScreen locationName="Kozmo" locationTitle="Kozmo Sor" />
);

const RepterScreen = () => (
  <LocationScreen locationName="Reptér" locationTitle="Reptéri Sor" />
);

// ========================================
// PLACEHOLDER SCREEN-EK (még nem kész)
// ========================================

const VClassScreen = () => (
  <View style={styles.tabContent}>
    <Text style={styles.tabTitle}>V-Osztály Sor</Text>
    <Text style={styles.comingSoon}>Hamarosan...</Text>
  </View>
);

const P213Screen = () => (
  <View style={styles.tabContent}>
    <Text style={styles.tabTitle}>213-as Sor</Text>
    <Text style={styles.comingSoon}>Hamarosan...</Text>
  </View>
);

const MapScreen = () => (
  <View style={styles.tabContent}>
    <Text style={styles.tabTitle}>Térkép</Text>
    <Text style={styles.comingSoon}>Hamarosan...</Text>
  </View>
);

const AdminScreen = () => (
  <View style={styles.tabContent}>
    <Text style={styles.tabTitle}>Adminisztráció</Text>
    <Text style={styles.comingSoon}>Hamarosan...</Text>
  </View>
);

const DispatchScreen = () => (
  <View style={styles.tabContent}>
    <Text style={styles.tabTitle}>Címkiosztó</Text>
    <Text style={styles.comingSoon}>Hamarosan...</Text>
  </View>
);

// ========================================
// PROFIL SCREEN
// ========================================

const ProfileScreen = () => {
  const { userProfile } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      'Kijelentkezés',
      'Biztosan ki szeretnél jelentkezni?',
      [
        { text: 'Mégse', style: 'cancel' },
        {
          text: 'Igen',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (error) {
              console.error('Kijelentkezési hiba:', error);
              Alert.alert('Hiba', 'Nem sikerült kijelentkezni.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.profileContainer}>
      <View style={styles.profileHeader}>
        <Text style={styles.profileTitle}>Profil</Text>
      </View>

      <View style={styles.profileSection}>
        <Text style={styles.profileLabel}>URH Szám</Text>
        <Text style={styles.profileValue}>{userProfile?.username || 'N/A'}</Text>
      </View>

      <View style={styles.profileSection}>
        <Text style={styles.profileLabel}>Email</Text>
        <Text style={styles.profileValue}>{userProfile?.email || 'N/A'}</Text>
      </View>

      <View style={styles.profileSection}>
        <Text style={styles.profileLabel}>Rendszám</Text>
        <Text style={styles.profileValue}>{userProfile?.licensePlate || 'N/A'}</Text>
      </View>

      <View style={styles.profileSection}>
        <Text style={styles.profileLabel}>Típus</Text>
        <Text style={styles.profileValue}>{userProfile?.userType || 'N/A'}</Text>
      </View>

      <View style={styles.profileSection}>
        <Text style={styles.profileLabel}>Státusz</Text>
        <Text style={styles.profileValue}>{userProfile?.status || 'N/A'}</Text>
      </View>

      <View style={styles.profileSection}>
        <Text style={styles.profileLabel}>Jogosultság</Text>
        <Text style={styles.profileValue}>
          {userProfile?.role === 'admin' ? 'Admin' : 'Felhasználó'}
        </Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Kijelentkezés</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

// ========================================
// DASHBOARD (TAB NAVIGATOR)
// ========================================

export default function DashboardScreen() {
  const { userProfile } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerShown: false,
      }}
    >
      {/* 7 FŐ TAXIÁLLOMÁS */}
      <Tab.Screen 
        name="Akadémia" 
        component={AkademiaScreen}
        options={{ tabBarLabel: 'Akadémia' }}
      />
      <Tab.Screen 
        name="Belváros" 
        component={BelvarosScreen}
        options={{ tabBarLabel: 'Belváros' }}
      />
      <Tab.Screen 
        name="Budai" 
        component={BudaiScreen}
        options={{ tabBarLabel: 'Budai' }}
      />
      <Tab.Screen 
        name="Conti" 
        component={ContiScreen}
        options={{ tabBarLabel: 'Conti' }}
      />
      <Tab.Screen 
        name="Crowne" 
        component={CrowneScreen}
        options={{ tabBarLabel: 'Crowne' }}
      />
      <Tab.Screen 
        name="Kozmo" 
        component={KozmoScreen}
        options={{ tabBarLabel: 'Kozmo' }}
      />
      <Tab.Screen 
        name="Reptér" 
        component={RepterScreen}
        options={{ tabBarLabel: 'Reptér' }}
      />

      {/* V-OSZTÁLY TAB (ha V-Osztály típus VAGY admin) */}
      {(userProfile?.userType === 'V-Osztály' || userProfile?.role === 'admin') && (
        <Tab.Screen 
          name="V-Osztály" 
          component={VClassScreen}
          options={{ tabBarLabel: 'V-Osztály' }}
        />
      )}

      {/* 213-AS TAB (ha VIP/VIP Kombi VAGY admin VAGY canSee213) */}
      {(userProfile?.userType === 'VIP' || 
        userProfile?.userType === 'VIP Kombi' || 
        userProfile?.role === 'admin' || 
        userProfile?.canSee213) && (
        <Tab.Screen 
          name="213" 
          component={P213Screen}
          options={{ tabBarLabel: '213' }}
        />
      )}

      {/* ADMIN TABOK (csak admin) */}
      {userProfile?.role === 'admin' && (
        <>
          <Tab.Screen 
            name="Térkép" 
            component={MapScreen}
            options={{ tabBarLabel: 'Térkép' }}
          />
          <Tab.Screen 
            name="Admin" 
            component={AdminScreen}
            options={{ tabBarLabel: 'Admin' }}
          />
          <Tab.Screen 
            name="Címkiosztó" 
            component={DispatchScreen}
            options={{ tabBarLabel: 'Címkiosztó' }}
          />
        </>
      )}

      {/* PROFIL TAB (mindenki) */}
      <Tab.Screen 
        name="Profil" 
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profil' }}
      />
    </Tab.Navigator>
  );
}

// ========================================
// STÍLUSOK
// ========================================

const styles = StyleSheet.create({
  tabContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  tabTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  comingSoon: {
    fontSize: 16,
    color: '#6b7280',
  },
  profileContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  profileHeader: {
    backgroundColor: '#4f46e5',
    padding: 20,
    alignItems: 'center',
  },
  profileTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileSection: {
    backgroundColor: '#fff',
    padding: 16,
    marginVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  profileLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  profileValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#ef4444',
    padding: 16,
    margin: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
