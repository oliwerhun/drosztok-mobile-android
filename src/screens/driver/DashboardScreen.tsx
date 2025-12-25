import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, ActivityIndicator, ActionSheetIOS, Platform, Vibration } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import LocationScreen from './LocationScreen';
import VClassScreen from './VClassScreen';
import AirportScreen from './AirportScreen';
import OrdersTab213 from './OrdersTab213';
import MapScreen from './MapScreen';
import AdminScreen from './AdminScreen';
import { checkoutFromAllLocations } from '../../services/LocationService';
import { AppState } from 'react-native';
import { updateUserDisplayNameInAllLocations } from '../../services/LocationService';
import { startLocationTracking, stopLocationTracking } from '../../services/LocationTrackingService';
import { useTheme } from '../../context/ThemeContext';
import { useFontSize } from '../../context/FontSizeContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { logger } from '../../utils/Logger';
import packageJson from '../../../package.json';

interface Tab {
  id: string;
  label: string;
}

const DEFAULT_TAB_ORDER: Tab[] = [
  { id: 'akademia', label: 'Akadémia' },
  { id: 'belvaros', label: 'Belváros' },
  { id: 'budai', label: 'Budai' },
  { id: 'conti', label: 'Conti' },
  { id: 'crowne', label: 'Crowne' },
  { id: 'kozmo', label: 'Kozmo' },
  { id: 'repter', label: 'Reptér' },
  { id: 'vclass', label: 'V-Osztály' },
  { id: '213', label: '213' },
  { id: 'csillag', label: 'Csillag' },
  { id: 'terkep', label: 'Térkép' },
  { id: 'admin', label: 'Admin' },
  { id: 'profil', label: 'Profil' },
];

const mergeTabOrders = (defaultOrder: Tab[], savedOrder: Tab[]): Tab[] => {
  const savedIds = new Set(savedOrder.map(t => t.id));
  const newTabs = defaultOrder.filter(t => !savedIds.has(t.id));
  return [...savedOrder, ...newTabs];
};

const loadTabOrder = async (uid: string): Promise<Tab[]> => {
  try {
    const saved = await AsyncStorage.getItem(`tab_order_${uid}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      return mergeTabOrders(DEFAULT_TAB_ORDER, parsed);
    }
  } catch (error) {
    console.error('Load tab order error:', error);
  }
  return DEFAULT_TAB_ORDER;
};

const saveTabOrder = async (uid: string, tabs: Tab[]) => {
  try {
    await AsyncStorage.setItem(`tab_order_${uid}`, JSON.stringify(tabs));
  } catch (error) {
    console.error('Save tab order error:', error);
  }
};

export default function DashboardScreen({ navigation }: any) {
  const { userProfile, refreshProfile } = useAuth();
  const { theme, toggleTheme, colors } = useTheme();
  const { increaseFontSize, decreaseFontSize } = useFontSize();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('Akadémia');
  const [tabs, setTabs] = useState<Tab[]>(DEFAULT_TAB_ORDER);
  const [isDragging, setIsDragging] = useState(false);

  // Profile Edit State
  const [editLicensePlate, setEditLicensePlate] = useState('');
  const [editUserType, setEditUserType] = useState('Taxi');
  const [savingProfile, setSavingProfile] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Set Csillag as active tab if user is 646 and tab is available
  useEffect(() => {
    if (userProfile) {
      setEditLicensePlate(userProfile.licensePlate || '');
      setEditUserType(userProfile.userType || 'Taxi');
      if (userProfile.username === '646' && activeTab !== 'Csillag' && activeTab === 'Akadémia') {
        setActiveTab('Csillag');
      }
    }
  }, [userProfile]);

  useEffect(() => {
    (async () => {
      logger.log('Dashboard mounted. Starting background location tracking...');
      try {
        const started = await startLocationTracking();
        if (started) {
          logger.log('Background location tracking started successfully');
        } else {
          logger.log('Failed to start background location tracking (permissions?)');
        }
      } catch (error) {
        logger.log('Error starting background location tracking:', error);
      }
    })();

    const subscription = AppState.addEventListener('change', nextAppState => {
      // logger.log('AppState changed', { state: nextAppState });
      if (nextAppState === 'active') {
        // updateDriverActivity();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleTypeSelection = () => {
    if (Platform.OS === 'ios') {
      const options = ['Mégse', 'Taxi', 'Kombi Taxi', 'VIP', 'VIP Kombi', 'V-Osztály'];
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 0,
          title: 'Válassz típust',
          userInterfaceStyle: theme === 'dark' ? 'dark' : 'light',
        },
        (buttonIndex) => {
          if (buttonIndex !== 0) {
            setEditUserType(options[buttonIndex]);
          }
        }
      );
    } else {
      setShowPicker(!showPicker);
    }
  };

  // Load and filter tabs based on user profile
  useEffect(() => {
    if (userProfile) {
      loadTabOrder(userProfile.uid).then(loadedTabs => {
        // Filter tabs based on user permissions
        const filteredTabs = loadedTabs.filter(tab => {
          if (tab.id === 'csillag') return userProfile.username === '646';
          if (tab.id === 'vclass') return userProfile.userType === 'V-Osztály' || userProfile.role === 'admin';
          if (tab.id === '213') return userProfile.userType === 'VIP' || userProfile.userType === 'VIP Kombi' || userProfile.role === 'admin' || userProfile.canSee213;
          if (tab.id === 'terkep' || tab.id === 'admin') return userProfile.role === 'admin';
          return true; // Show all other tabs
        });
        setTabs(filteredTabs);
      });
    }
  }, [userProfile]);

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
              // Checkout from all queues before logout
              if (userProfile?.uid) {
                console.log('Logout: Checking out from all locations');
                await checkoutFromAllLocations(userProfile.uid, userProfile);
              }

              // Remove USER_ID to stop background location updates
              await AsyncStorage.removeItem('USER_ID');

              await stopLocationTracking();
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

  const handleSaveProfile = async () => {
    if (!userProfile) return;

    const licensePlateRegex = /^[a-zA-Z0-9]{6,7}$/;
    const formattedLicensePlate = editLicensePlate.toUpperCase().replace(/\s/g, '');

    if (!licensePlateRegex.test(formattedLicensePlate)) {
      Alert.alert('Hiba', 'Érvénytelen rendszám formátum. Helyes formátumok: ABC123 vagy ABCD123.');
      return;
    }

    setSavingProfile(true);
    try {
      const canSee213Auto = (editUserType === 'VIP' || editUserType === 'VIP Kombi');

      const profileRef = doc(db, "profiles", userProfile.uid);
      const updatedData = {
        licensePlate: formattedLicensePlate,
        userType: editUserType,
        canSee213: canSee213Auto
      };

      await updateDoc(profileRef, updatedData);

      const fullUpdatedProfile = {
        ...userProfile,
        ...updatedData,
        username: userProfile.username
      };

      await updateUserDisplayNameInAllLocations(userProfile.uid, fullUpdatedProfile);
      await refreshProfile();

      Alert.alert('Siker', 'Profil sikeresen frissítve!');
    } catch (error) {
      console.error('Profil mentési hiba:', error);
      Alert.alert('Hiba', 'Nem sikerült menteni a profilt.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Render location content based on active tab
  const getLocationContent = () => {
    switch (activeTab) {
      case 'Csillag':
        return <LocationScreen locationName="Csillag" gpsEnabled={true} />;
      case 'Akadémia':
        return <LocationScreen locationName="Akadémia" gpsEnabled={true} />;
      case 'Belváros':
        return <LocationScreen locationName="Belváros" gpsEnabled={true} />;
      case 'Budai':
        return <LocationScreen locationName="Budai" gpsEnabled={true} />;
      case 'Conti':
        return <LocationScreen locationName="Conti" gpsEnabled={true} />;
      case 'Crowne':
        return <LocationScreen locationName="Crowne" gpsEnabled={true} />;
      case 'Kozmo':
        return <LocationScreen locationName="Kozmo" gpsEnabled={true} />;
      case 'Reptér':
        return <AirportScreen gpsEnabled={true} />;
      case 'V-Osztály':
        return <VClassScreen gpsEnabled={true} />;
      case '213':
        return <OrdersTab213 />;
      case 'Térkép':
        return <MapScreen />;
      case 'Admin':
        return <AdminScreen />;
      case 'Profil':
        return (
          <ScrollView style={styles.profileContainer}>
            <View style={styles.profileHeader}>
              <Text style={[styles.profileTitle, { color: colors.text }]}>Profil</Text>
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileLabel}>URH Szám</Text>
              <View style={[styles.readOnlyField, { backgroundColor: colors.memberItem, borderColor: colors.border }]}>
                <Text style={[styles.profileValue, { color: colors.text }]}>{userProfile?.username || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileLabel}>Email</Text>
              <View style={[styles.readOnlyField, { backgroundColor: colors.memberItem, borderColor: colors.border }]}>
                <Text style={[styles.profileValue, { color: colors.text }]}>{userProfile?.email || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileLabel}>Rendszám</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                value={editLicensePlate}
                onChangeText={setEditLicensePlate}
                placeholder="ABC123"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="characters"
              />
              <Text style={styles.helperText}>Formátum: ABC123 vagy ABCD123</Text>
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileLabel}>Típus</Text>
              <View>
                <TouchableOpacity
                  style={[styles.pickerButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={handleTypeSelection}
                >
                  <Text style={[styles.pickerButtonText, { color: colors.text }]}>
                    {editUserType}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.text} />
                </TouchableOpacity>

                {Platform.OS === 'android' && showPicker && (
                  <View style={[styles.pickerDropdown, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
                    {['Taxi', 'Kombi Taxi', 'VIP', 'VIP Kombi', 'V-Osztály'].map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.pickerItem,
                          editUserType === type && { backgroundColor: theme === 'dark' ? '#374151' : '#eef2ff' },
                          { borderBottomColor: colors.border }
                        ]}
                        onPress={() => {
                          setEditUserType(type);
                          setShowPicker(false);
                        }}
                      >
                        <Text style={[
                          styles.pickerItemText,
                          { color: colors.text },
                          editUserType === type && { color: colors.primary || '#4f46e5', fontWeight: 'bold' }
                        ]}>
                          {type}
                        </Text>
                        {editUserType === type && (
                          <Ionicons name="checkmark" size={20} color={colors.primary || '#4f46e5'} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileLabel}>Státusz</Text>
              <View style={[styles.readOnlyField, { backgroundColor: colors.memberItem, borderColor: colors.border }]}>
                <Text style={[styles.profileValue, { color: colors.text }]}>{userProfile?.status || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileLabel}>Jogosultság</Text>
              <View style={[styles.readOnlyField, { backgroundColor: colors.memberItem, borderColor: colors.border }]}>
                <Text style={[styles.profileValue, { color: colors.text }]}>{userProfile?.role || 'N/A'}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, savingProfile && styles.disabledButton]}
              onPress={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveButtonText}>Mentés</Text>
              )}
            </TouchableOpacity>

            <View style={styles.versionContainer}>
              <Text style={styles.versionText}>Verzió: {packageJson.version}</Text>
            </View>
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: colors.headerBackground }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>
            {userProfile?.username || 'N/A'}
          </Text>
        </View>

        <View style={styles.headerCenter}>
          <TouchableOpacity onPress={toggleTheme} style={styles.iconButton}>
            <Ionicons name={theme === 'light' ? 'moon' : 'sunny'} size={24} color={colors.headerText} />
          </TouchableOpacity>

          <View style={styles.fontControls}>
            <TouchableOpacity onPress={decreaseFontSize} style={styles.iconButton}>
              <Ionicons name="text" size={18} color={colors.headerText} />
            </TouchableOpacity>
            <TouchableOpacity onPress={increaseFontSize} style={styles.iconButton}>
              <Ionicons name="text" size={24} color={colors.headerText} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.navigate('Debug')} style={{ padding: 4, marginRight: 8 }}>
            <Ionicons name="bug-outline" size={24} color="#f59e0b" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <DraggableFlatList
        key="dashboard-tabs"
        data={tabs}
        horizontal
        onDragEnd={({ data }) => {
          setTabs(data);
          if (userProfile) {
            saveTabOrder(userProfile.uid, data);
          }
          setIsDragging(false);
        }}
        keyExtractor={(item) => item.id}
        renderItem={({ item, drag, isActive }: RenderItemParams<Tab>) => (
          <ScaleDecorator>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === item.label ? { backgroundColor: colors.tabActive } : { backgroundColor: colors.tabInactive },
                isActive && styles.draggingTab
              ]}
              onPress={() => !isDragging && setActiveTab(item.label)}
              onLongPress={() => {
                Vibration.vibrate(100);
                setIsDragging(true);
                drag();
              }}
              delayLongPress={5000}
              disabled={isActive}
            >
              <Text style={[
                styles.tabText,
                activeTab === item.label ? { color: colors.tabTextActive } : { color: colors.tabTextInactive }
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          </ScaleDecorator>
        )}
        showsHorizontalScrollIndicator={false}
        style={[styles.tabScrollView, { backgroundColor: colors.tabBarBackground, borderBottomColor: colors.border }]}
        contentContainerStyle={styles.tabScrollContent}
      />

      <View style={styles.content}>
        {getLocationContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { backgroundColor: '#1f2937', paddingHorizontal: 16, paddingVertical: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { minWidth: 60 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerRight: { minWidth: 40, alignItems: 'flex-end' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#ffffff' },
  gpsButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  gpsButtonOn: { backgroundColor: '#10b981' },
  gpsButtonOff: { backgroundColor: '#ef4444' },
  gpsButtonText: { fontSize: 12, fontWeight: 'bold', color: '#ffffff' },
  iconButton: { padding: 4 },
  fontControls: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
  logoutButton: { padding: 4 },
  welcomeText: { fontSize: 14, color: '#ffffff', fontWeight: '600' },
  logoutText: { fontSize: 12, color: '#ef4444', marginTop: 4 },
  tabScrollView: { maxHeight: 50, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tabScrollContent: { paddingHorizontal: 8 },
  tab: { paddingHorizontal: 20, paddingVertical: 12, marginHorizontal: 4, borderRadius: 8 },
  tabActive: { backgroundColor: '#000000' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#ffffff' },
  content: { flex: 1 },
  placeholderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  placeholderTitle: { fontSize: 24, fontWeight: 'bold', color: '#1f2937', marginBottom: 8 },
  placeholderText: { fontSize: 16, color: '#6b7280' },
  profileContainer: { flex: 1, padding: 16 },
  profileHeader: { marginBottom: 24 },
  profileTitle: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  profileSection: { marginBottom: 16 },
  profileLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' },
  profileValue: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  readOnlyField: { backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  input: { backgroundColor: '#ffffff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  helperText: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  pickerContainer: { backgroundColor: '#ffffff', borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', overflow: 'hidden' },
  picker: { height: 50, width: '100%' },
  saveButton: { marginTop: 16, backgroundColor: '#2563eb', paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  saveButtonText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
  disabledButton: { opacity: 0.7 },
  pickerButton: { padding: 12, borderRadius: 8, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerButtonText: { fontSize: 16, fontWeight: 'bold' },
  pickerDropdown: { marginTop: 8, borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  pickerItem: { padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
  pickerItemText: { fontSize: 16, fontWeight: 'bold' },
  draggingTab: {
    backgroundColor: '#6366f1',
    transform: [{ scale: 1.1 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  versionContainer: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '500',
  },
});
