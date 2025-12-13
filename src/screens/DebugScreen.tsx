import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { logger } from '../utils/Logger';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function DebugScreen({ navigation }: any) {
    const [logs, setLogs] = useState<string[]>(logger.getLogs());

    useEffect(() => {
        const updateLogs = (newLogs: string[]) => {
            setLogs([...newLogs]); // Create new array ref to trigger re-render
        };

        logger.on('new_log', updateLogs);
        return () => {
            logger.off('new_log', updateLogs);
        };
    }, []);

    const copyToClipboard = async () => {
        const text = logs.join('\n');
        await Clipboard.setStringAsync(text);
        Alert.alert('Másolva', 'A logok vágólapra másolva!');
    };

    const clearLogs = () => {
        logger.clear();
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.title}>System Logs</Text>
                <View style={styles.actions}>
                    <TouchableOpacity onPress={clearLogs} style={styles.iconButton}>
                        <Ionicons name="trash-outline" size={24} color="#ef4444" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={copyToClipboard} style={styles.iconButton}>
                        <Ionicons name="copy-outline" size={24} color="#4f46e5" />
                    </TouchableOpacity>
                </View>
            </View>
            <FlatList
                data={logs}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => <Text style={styles.logText}>{item}</Text>}
                contentContainerStyle={styles.list}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6', paddingTop: 40 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#ddd' },
    title: { fontSize: 18, fontWeight: 'bold' },
    actions: { flexDirection: 'row', gap: 15 },
    iconButton: { padding: 5 },
    list: { padding: 10 },
    logText: { fontSize: 11, fontFamily: 'monospace', marginBottom: 5, backgroundColor: '#fff', padding: 5, borderRadius: 4, color: '#333' }
});
