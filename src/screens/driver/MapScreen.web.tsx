import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../../context/ThemeContext';

export default function MapScreen() {
    // Mivel a useTheme hook-ot használjuk, gondoskodni kell róla, hogy a ThemeProvider elérhető legyen.
    // De itt csak azt feltételezzük.
    // Ha weben vagyunk, a ThemeContext is működik elvileg (AsyncStorage shim van).

    // Egyszerűsített téma kezelés, ha a hook esetleg nem menne (de mennie kell)
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <View style={[styles.center, { backgroundColor: isDark ? '#1f2937' : '#f5f5f5' }]}>
            <Ionicons name="map-outline" size={64} color={isDark ? '#fff' : '#333'} />
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginTop: 20, color: isDark ? '#fff' : '#000' }}>
                Térkép nézet
            </Text>
            <Text style={{ marginTop: 10, color: '#666', textAlign: 'center', paddingHorizontal: 20 }}>
                A térkép funkció asztali alkalmazásban nem támogatott.{'\n'}
                Kérlek használd a mobil verziót a GPS követéshez.
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
