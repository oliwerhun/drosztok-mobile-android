import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import LocationScreen from './LocationScreen';
import AirportOrdersTab from './AirportOrdersTab';

interface AirportScreenProps {
    gpsEnabled: boolean;
}

export default function AirportScreen({ gpsEnabled }: AirportScreenProps) {
    const [activeSubTab, setActiveSubTab] = useState<'sor' | 'rendelesek' | 'emirates'>('sor');

    return (
        <View style={styles.container}>
            <View style={styles.subTabContainer}>
                <TouchableOpacity
                    style={[styles.subTabButton, activeSubTab === 'sor' && styles.subTabButtonActive]}
                    onPress={() => setActiveSubTab('sor')}
                >
                    <Text style={[styles.subTabText, activeSubTab === 'sor' && styles.subTabTextActive]}>
                        Reptéri sor
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.subTabButton, activeSubTab === 'rendelesek' && styles.subTabButtonActive]}
                    onPress={() => setActiveSubTab('rendelesek')}
                >
                    <Text style={[styles.subTabText, activeSubTab === 'rendelesek' && styles.subTabTextActive]}>
                        Rendelések
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.subTabButton, activeSubTab === 'emirates' && styles.subTabButtonActive]}
                    onPress={() => setActiveSubTab('emirates')}
                >
                    <Text style={[styles.subTabText, activeSubTab === 'emirates' && styles.subTabTextActive]}>
                        Emirates
                    </Text>
                </TouchableOpacity>
            </View>

            {activeSubTab === 'sor' && (
                <LocationScreen locationName="Reptér" gpsEnabled={gpsEnabled} />
            )}

            {activeSubTab === 'rendelesek' && (
                <AirportOrdersTab />
            )}

            {activeSubTab === 'emirates' && (
                <LocationScreen
                    locationName="Emirates"
                    gpsEnabled={gpsEnabled}
                    firestorePath="locations/Reptér"
                    membersField="emiratesMembers"
                    geofenceName="Reptér"
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#ffffff' },
    subTabContainer: { flexDirection: 'row', backgroundColor: '#f3f4f6' },
    subTabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#ffffff' },
    subTabButtonActive: { backgroundColor: '#000000' },
    subTabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
    subTabTextActive: { color: '#ffffff' },
    placeholderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    placeholderTitle: { fontSize: 24, fontWeight: 'bold', color: '#1f2937', marginBottom: 8 },
    placeholderText: { fontSize: 16, color: '#6b7280' },
});
