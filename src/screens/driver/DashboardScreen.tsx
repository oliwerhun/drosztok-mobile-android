import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import LocationScreen from './LocationScreen';
import VClassScreen from './VClassScreen';
import * as Location from 'expo-location';

export default function DashboardScreen() {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('Akadémia');
  const [gpsEnabled, setGpsEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        console.log('GPS permission granted');
      }
    })();
  }, []);

  const getTabs = () => {
    let tabs = ['Akadémia', 'Belváros', 'Budai', 'Conti', 'Crowne', 'Kozmo', 'Reptér'];

    if (userProfile?.userType === 'V-Osztály' || userProfile?.role === 'admin') {
      tabs.push('V-Osztály');
    }

    if (userProfile?.userType === 'VIP' || 
        userProfile?.userType === 'VIP Kombi' || 
        userProfile?.role === 'admin' || 
        userProfile?.canSee213) {
      tabs.push('213');
    }

    if (userProfile?.role === 'admin') {
      tabs.push('Térkép', 'Admin', 'Címkiosztó');
    }

    tabs.push('Profil');

    return tabs;
  };

  const tabs = getTabs();

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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Akadémia':
        return <LocationScreen locationName="Akadémia" locationTitle="Akadémia Sor" gpsEnabled={gpsEnabled} />;
      case 'Belváros':
        return <LocationScreen locationName="Belváros" locationTitle="Belvárosi Sor" gpsEnabled={gpsEnabled} />;
      case 'Budai':
        return <LocationScreen locationName="Budai" locationTitle="Budai Sor" gpsEnabled={gpsEnabled} />;
      case 'Conti':
        return <LocationScreen locationName="Conti" locationTitle="Conti Sor" gpsEnabled={gpsEnabled} />;
      case 'Crowne':
        return <LocationScreen locationName="Crowne" locationTitle="Crowne Plaza Sor" gpsEnabled={gpsEnabled} />;
      case 'Kozmo':
        return <LocationScreen locationName="Kozmo" locationTitle="Kozmo Sor" gpsEnabled={gpsEnabled} />;
      case 'Reptér':
        return <LocationScreen locationName="Reptér" locationTitle="Reptéri Sor" gpsEnabled={gpsEnabled} />;
      case 'V-Osztály':
        return <VClassScreen gpsEnabled={gpsEnabled} />;
      case '213':
        return (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderTitle}>213-as Sor</Text>
            <Text style={styles.placeholderText}>Hamarosan...</Text>
          </View>
        );
      case 'Térkép':
        return (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderTitle}>Térkép</Text>
            <Text style={styles.placeholderText}>Hamarosan...</Text>
          </View>
        );
      case 'Admin':
        return (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderTitle}>Adminisztráció</Text>
            <Text style={styles.placeholderText}>Hamarosan...</Text>
          </View>
        );
      case 'Címkiosztó':
        return (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderTitle}>Címkiosztó</Text>
            <Text style={styles.placeholderText}>Hamarosan...</Text>
          </View>
        );
      case 'Profil':
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
      default:
        return (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderText}>Válassz egy tabot!</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>DROSZTOK</Text>
          <TouchableOpacity
            style={[
              styles.gpsToggle,
              gpsEnabled ? styles.gpsToggleOn : styles.gpsToggleOff
            ]}
            onPress={() => setGpsEnabled(!gpsEnabled)}
          >
            <Text style={styles.gpsToggleText}>
              GPS: {gpsEnabled ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.welcomeText}>Szia, {userProfile?.username}!</Text>
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logoutLink}>Kijelentkezés</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && styles.tabActive,
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.contentContainer}>
        {renderTabContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  gpsToggle: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 70,
  },
  gpsToggleOn: {
    backgroundColor: '#10b981',
  },
  gpsToggleOff: {
    backgroundColor: '#ef4444',
  },
  gpsToggleText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  welcomeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  logoutLink: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  tabBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    maxHeight: 50,
  },
  tabBarContent: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  tabActive: {
    backgroundColor: '#1f2937',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#fff',
  },
  contentContainer: {
    flex: 1,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  placeholderText: {
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
