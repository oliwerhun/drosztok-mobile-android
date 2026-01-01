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

    // Search & Tracking State
    const [searchQuery, setSearchQuery] = useState('');
    const [trackedDriverUid, setTrackedDriverUid] = useState<string | null>(null);

    // Stopwatch State
    const [timer, setTimer] = useState(0);
    const [isRunning, setIsRunning] = useState(false);

    const mapRef = useRef<MapView>(null);
    const driverProfilesCache = useRef<{ [key: string]: { username: string; licensePlate: string } }>({});

    // Stopwatch Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isRunning) {
            interval = setInterval(() => {
                setTimer((prev) => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRunning]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const toggleStopwatch = () => setIsRunning(!isRunning);
    const resetStopwatch = () => {
        setIsRunning(false);
        setTimer(0);
    };

    // Data Loading Logic
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

    // Auto-follow Logic
    useEffect(() => {
        if (trackedDriverUid && mapRef.current) {
            const driver = drivers.find(d => d.uid === trackedDriverUid);
            if (driver) {
                mapRef.current.animateToRegion({
                    latitude: driver.lat,
                    longitude: driver.lng,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                }, 500);
            }
        }
    }, [drivers, trackedDriverUid]);


    const handleSearch = () => {
        if (trackedDriverUid) {
            // Stop tracking
            setTrackedDriverUid(null);
            setSearchQuery('');
            return;
        }

        if (!searchQuery.trim()) return;

        const foundDriver = drivers.find(d => d.username?.toLowerCase() === searchQuery.toLowerCase());
        if (foundDriver) {
            setTrackedDriverUid(foundDriver.uid);
            mapRef.current?.animateToRegion({
                latitude: foundDriver.lat,
                longitude: foundDriver.lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
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

    return (
        <View style={styles.container}>
            {/* Control Bar: Search + Stopwatch */}
            <View style={styles.controlBar}>
                {/* Search Section */}
                <View style={styles.searchSection}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="URH"
                        placeholderTextColor="#999"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onSubmitEditing={handleSearch}
                        keyboardType="numeric"
                        maxLength={3}
                    />
                    <TouchableOpacity
                        style={[styles.iconButton, trackedDriverUid ? styles.cancelButton : styles.searchButton]}
                        onPress={handleSearch}
                    >
                        <Ionicons name={trackedDriverUid ? "close" : "search"} size={20} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Stopwatch Section */}
                <View style={styles.stopwatchSection}>
                    <Text style={styles.timerText}>{formatTime(timer)}</Text>

                    <TouchableOpacity
                        style={[styles.iconButton, styles.stopwatchButton, isRunning ? styles.stopButton : styles.playButton]}
                        onPress={toggleStopwatch}
                    >
                        <Ionicons name={isRunning ? "square" : "play"} size={16} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.iconButton, styles.stopwatchButton, styles.resetButton]}
                        onPress={resetStopwatch}
                    >
                        <Ionicons name="close" size={18} color="white" />
                    </TouchableOpacity>
                </View>
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
                    const isTracked = driver.uid === trackedDriverUid;
                    return (
                        <Marker
                            key={driver.uid}
                            coordinate={{ latitude: driver.lat, longitude: driver.lng }}
                            title={driver.username}
                            description={driver.licensePlate}
                            pinColor={isSelf ? 'blue' : (isTracked ? 'green' : 'red')}
                            zIndex={isSelf || isTracked ? 1000 : 1}
                        >
                            <View style={[styles.markerContainer, isTracked && { borderColor: '#4f46e5', borderWidth: 2 }]}>
                                <Text style={[styles.markerText, (isSelf || isTracked) && { color: 'blue', fontWeight: 'bold' }]}>
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
    controlBar: {
        position: 'absolute',
        top: 5, // Directly under tabs (MapScreen is inside content view)
        left: 10,
        right: 10, // Or fix width
        zIndex: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    searchSection: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        alignItems: 'center',
    },
    stopwatchSection: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderRadius: 8,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        alignItems: 'center',
        marginLeft: 10,
    },
    searchInput: {
        width: 60,
        height: 36,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
        backgroundColor: '#f3f4f6',
        borderRadius: 4,
        marginRight: 4,
    },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchButton: {
        backgroundColor: '#4f46e5',
    },
    cancelButton: {
        backgroundColor: '#ef4444',
    },
    stopwatchButton: {
        marginLeft: 4,
    },
    playButton: {
        backgroundColor: '#10b981', // Green
    },
    stopButton: {
        backgroundColor: '#f59e0b', // Amber/Orange
    },
    resetButton: {
        backgroundColor: '#6b7280', // Gray
    },
    timerText: {
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontSize: 18,
        fontWeight: 'bold',
        marginHorizontal: 8,
        color: '#1f2937',
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
