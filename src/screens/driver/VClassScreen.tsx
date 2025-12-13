import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import LocationScreen from './LocationScreen';
import VClassOrdersTab from './VClassOrdersTab';

interface VClassScreenProps {
  gpsEnabled: boolean;
}

export default function VClassScreen({ gpsEnabled }: VClassScreenProps) {
  const [activeSubTab, setActiveSubTab] = useState<'sor' | 'rendelesek'>('sor');

  return (
    <View style={styles.container}>
      <View style={styles.subTabContainer}>
        <TouchableOpacity
          style={[styles.subTabButton, activeSubTab === 'sor' && styles.subTabButtonActive]}
          onPress={() => setActiveSubTab('sor')}
        >
          <Text style={[styles.subTabText, activeSubTab === 'sor' && styles.subTabTextActive]}>
            V-Osztály Sor
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
      </View>

      {activeSubTab === 'sor' ? (
        <LocationScreen locationName="V-Osztály" gpsEnabled={gpsEnabled} />
      ) : (
        <VClassOrdersTab />
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
});
