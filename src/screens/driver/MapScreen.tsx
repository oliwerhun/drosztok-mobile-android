import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Ionicons from '@expo/vector-icons/Ionicons';

interface DriverLocation {
    uid: string;
    lat: number;
    lng: number;
    username?: string;
    licensePlate?: string;
}

export default function MapScreen() {
    const { userProfile } = useAuth();
    const { theme } = useTheme();
    const [drivers, setDrivers] = useState<DriverLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const mapRef = useRef<MapView>(null);
    const driverProfilesCache = useRef<{ [key: string]: { username: string; licensePlate: string } }>({});

    useEffect(() => {
        if (userProfile?.role !== 'admin') return;

        const locationsRef = collection(db, 'driver_locations');
        const unsubscribe = onSnapshot(locationsRef, async (snapshot) => {
            const updatedDrivers: DriverLocation[] = [];

            for (const docChange of snapshot.docChanges()) {
                const uid = docChange.doc.id;
                const data = docChange.doc.data();

                if (docChange.type === 'removed') {
                    setDrivers(prev => prev.filter(d => d.uid !== uid));
                    continue;
                }

                let profile = driverProfilesCache.current[uid];
                if (!profile) {
                    try {
                        const profileSnap = await getDoc(doc(db, 'profiles', uid));
                        if (profileSnap.exists()) {
                            const pData = profileSnap.data();
                            profile = {
                                username: pData.username || '?',
                                licensePlate: pData.licensePlate || 'N/A'
                            };
                            driverProfilesCache.current[uid] = profile;
                        }
                    } catch (error) {
                        console.error('Error fetching profile for map:', error);
                    }
                }

                updatedDrivers.push({
                    uid,
                    lat: data.lat,
                    lng: data.lng,
                    username: profile?.username || '?',
                    licensePlate: profile?.licensePlate || 'N/A'
                });
            }

            setDrivers(prev => {
                const newDrivers = [...prev];
                updatedDrivers.forEach(updated => {
                    const index = newDrivers.findIndex(d => d.uid === updated.uid);
                    if (index !== -1) {
                        newDrivers[index] = updated;
                    } else {
                        newDrivers.push(updated);
                    }
                });
                return newDrivers;
            });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userProfile]);

    const handleSearch = () => {
        if (!searchQuery.trim()) return;

        const foundDriver = drivers.find(d => d.username?.toLowerCase() === searchQuery.toLowerCase());
        if (foundDriver && mapRef.current) {
            mapRef.current.animateToRegion({
                latitude: foundDriver.lat,
                longitude: foundDriver.lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            });
        }
    };

    if (userProfile?.role !== 'admin') {
        return (
            <View style={styles.center}>
                <Text>Nincs jogosultságod a térkép megtekintéséhez.</Text>
            </View>
        );
    }

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#4f46e5" />
            </View>
        );
    }

    if (Platform.OS === 'web') {
        return (
            <View style={styles.center}>
                <Ionicons name="map-outline" size={64} color={theme === 'dark' ? '#fff' : '#333'} />
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 20, color: theme === 'dark' ? '#fff' : '#000' }}>
                    Térkép nézet
                </Text>
                <Text style={{ marginTop: 10, color: '#666', textAlign: 'center' }}>
                    A térkép funkció jelenleg csak a mobilalkalmazásban érhető el.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Sofőr keresése (URH)..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={handleSearch}
                />
                <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
                    <Ionicons name="search" size={20} color="white" />
                </TouchableOpacity>
            </View>

            <MapView
                ref={mapRef}
                style={styles.map}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                userInterfaceStyle={theme}
                customMapStyle={theme === 'dark' ? darkMapStyle : []}
                initialRegion={{
                    latitude: 47.4979,
                    longitude: 19.0402,
                    latitudeDelta: 0.1,
                    longitudeDelta: 0.1,
                }}
            >
                {drivers.map(driver => {
                    const isSelf = driver.uid === userProfile?.uid;
                    return (
                        <Marker
                            key={driver.uid}
                            coordinate={{ latitude: driver.lat, longitude: driver.lng }}
                            title={driver.username}
                            description={driver.licensePlate}
                            pinColor={isSelf ? 'blue' : 'red'}
                            zIndex={isSelf ? 1000 : 1}
                        >
                            <View style={styles.markerContainer}>
                                <Text style={[styles.markerText, isSelf && { color: 'blue', fontWeight: 'bold' }]}>
                                    {driver.username}
                                </Text>
                            </View>
                        </Marker>
                    );
                })}
            </MapView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    map: {
        width: '100%',
        height: '100%',
    },
    markerContainer: {
        backgroundColor: 'white',
        padding: 5,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#ccc',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    markerText: {
        fontWeight: 'bold',
        fontSize: 12,
    },
    searchContainer: {
        position: 'absolute',
        top: 10,
        left: 10,
        right: 10,
        zIndex: 1,
        flexDirection: 'row',
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    searchInput: {
        flex: 1,
        paddingHorizontal: 10,
        height: 40,
    },
    searchButton: {
        backgroundColor: '#4f46e5',
        width: 40,
        height: 40,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

const darkMapStyle = [
    {
        "elementType": "geometry",
        "stylers": [
            {
                "color": "#242f3e"
            }
        ]
    },
    {
        "elementType": "labels.text.fill",
        "stylers": [
            {
                "color": "#746855"
            }
        ]
    },
    {
        "elementType": "labels.text.stroke",
        "stylers": [
            {
                "color": "#242f3e"
            }
        ]
    },
    {
        "featureType": "administrative.locality",
        "elementType": "labels.text.fill",
        "stylers": [
            {
                "color": "#d59563"
            }
        ]
    },
    {
        "featureType": "poi",
        "elementType": "labels.text.fill",
        "stylers": [
            {
                "color": "#d59563"
            }
        ]
    },
    {
        "featureType": "poi.park",
        "elementType": "geometry",
        "stylers": [
            {
                "color": "#263c3f"
            }
        ]
    },
    {
        "featureType": "poi.park",
        "elementType": "labels.text.fill",
        "stylers": [
            {
                "color": "#6b9a76"
            }
        ]
    },
    {
        "featureType": "road",
        "elementType": "geometry",
        "stylers": [
            {
                "color": "#38414e"
            }
        ]
    },
    {
        "featureType": "road",
        "elementType": "geometry.stroke",
        "stylers": [
            {
                "color": "#212a37"
            }
        ]
    },
    {
        "featureType": "road",
        "elementType": "labels.text.fill",
        "stylers": [
            {
                "color": "#9ca5b3"
            }
        ]
    },
    {
        "featureType": "road.highway",
        "elementType": "geometry",
        "stylers": [
            {
                "color": "#746855"
            }
        ]
    },
    {
        "featureType": "road.highway",
        "elementType": "geometry.stroke",
        "stylers": [
            {
                "color": "#1f2835"
            }
        ]
    },
    {
        "featureType": "road.highway",
        "elementType": "labels.text.fill",
        "stylers": [
            {
                "color": "#f3d19c"
            }
        ]
    },
    {
        "featureType": "transit",
        "elementType": "geometry",
        "stylers": [
            {
                "color": "#2f3948"
            }
        ]
    },
    {
        "featureType": "transit.station",
        "elementType": "labels.text.fill",
        "stylers": [
            {
                "color": "#d59563"
            }
        ]
    },
    {
        "featureType": "water",
        "elementType": "geometry",
        "stylers": [
            {
                "color": "#17263c"
            }
        ]
    },
    {
        "featureType": "water",
        "elementType": "labels.text.fill",
        "stylers": [
            {
                "color": "#515c6d"
            }
        ]
    },
    {
        "featureType": "water",
        "elementType": "labels.text.stroke",
        "stylers": [
            {
                "color": "#17263c"
            }
        ]
    }
];
