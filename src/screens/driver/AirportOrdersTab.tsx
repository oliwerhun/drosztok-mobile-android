import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Ionicons from '@expo/vector-icons/Ionicons';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useFontSize } from '../../context/FontSizeContext';

interface Note {
    id: string;
    text: string;
}

export default function AirportOrdersTab() {
    const { userProfile } = useAuth();
    const { colors } = useTheme();
    const { fontSize } = useFontSize();
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const notesRef = useRef<Note[]>([]);

    const isAdmin = userProfile?.role === 'admin';

    // Keep ref in sync with state for onSnapshot comparison
    useEffect(() => {
        notesRef.current = notes;
    }, [notes]);

    useEffect(() => {
        const locationRef = doc(db, 'locations', 'Reptér');

        const unsubscribe = onSnapshot(locationRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const notesData = data.notes || [];

                // Ensure we are working with string[]
                let incomingStrings: string[] = [];
                if (Array.isArray(notesData)) {
                    incomingStrings = notesData.map((n: any) =>
                        typeof n === 'string' ? n : (n?.text || '')
                    );
                }

                // Compare with current local state to avoid unnecessary re-renders (and focus loss)
                const currentStrings = notesRef.current.map(n => n.text);
                const isDifferent = JSON.stringify(incomingStrings) !== JSON.stringify(currentStrings);

                if (isDifferent) {
                    const parsedNotes: Note[] = incomingStrings.map((text: string, index: number) => {
                        const existingNote = notesRef.current[index];
                        return {
                            id: existingNote ? existingNote.id : `note-${Date.now()}-${index}-${Math.random()}`,
                            text
                        };
                    });
                    setNotes(parsedNotes);
                }
            } else {
                setNotes([]);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const saveToFirestore = async (updatedNotes: Note[]) => {
        try {
            const locationRef = doc(db, 'locations', 'Reptér');
            // Save as string[] to be compatible with web
            const notesStrings = updatedNotes.map(n => n.text);
            await updateDoc(locationRef, { notes: notesStrings });
        } catch (error) {
            console.error('Error saving notes:', error);
        }
    };

    const handleAddNote = async () => {
        const newNote: Note = {
            id: `note-${Date.now()}`,
            text: '',
        };
        const updatedNotes = [newNote, ...notes];
        setNotes(updatedNotes);
        await saveToFirestore(updatedNotes);
    };

    const handleChangeText = async (id: string, text: string) => {
        const updatedNotes = notes.map(note => note.id === id ? { ...note, text } : note);
        setNotes(updatedNotes);
        await saveToFirestore(updatedNotes);
    };

    const handleDeleteNote = (id: string) => {
        Alert.alert(
            'Törlés megerősítése',
            'Biztosan törölni szeretnéd ezt a rendelést?',
            [
                { text: 'Mégsem', style: 'cancel' },
                {
                    text: 'Törlés',
                    style: 'destructive',
                    onPress: async () => {
                        const updatedNotes = notes.filter(note => note.id !== id);
                        setNotes(updatedNotes);
                        await saveToFirestore(updatedNotes);
                    },
                },
            ]
        );
    };

    const renderItem = ({ item, drag, isActive }: RenderItemParams<Note>) => {
        return (
            <ScaleDecorator>
                <View style={[
                    styles.noteRow,
                    { backgroundColor: isActive ? colors.memberItem : colors.card }
                ]}>
                    {isAdmin && (
                        <TouchableOpacity
                            onLongPress={drag}
                            delayLongPress={100}
                            style={styles.dragHandle}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Text style={[styles.dragIcon, { color: colors.textSecondary }]}>☰</Text>
                        </TouchableOpacity>
                    )}

                    <TextInput
                        style={[styles.input, { color: colors.text, fontSize: fontSize }]}
                        value={item.text}
                        onChangeText={(text) => handleChangeText(item.id, text)}
                        placeholder="Rendelés..."
                        placeholderTextColor={colors.textSecondary}
                        editable={isAdmin}
                        multiline={false}
                        returnKeyType="done"
                        blurOnSubmit={true}
                    />

                    <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteNote(item.id)}>
                        <Ionicons name="trash" size={24} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            </ScaleDecorator>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4f46e5" />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.locationHeader }]}>
                <Text style={styles.headerText}>Reptéri Rendelések</Text>
                {isAdmin && (
                    <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.card }]} onPress={handleAddNote}>
                        <Text style={[styles.addButtonText, { color: colors.text }]}>+</Text>
                    </TouchableOpacity>
                )}
            </View>

            <DraggableFlatList
                data={notes}
                onDragEnd={({ data }) => {
                    if (isAdmin) {
                        setNotes(data);
                        saveToFirestore(data);
                    }
                }}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                containerStyle={styles.listContainer}
                contentContainerStyle={{ paddingBottom: 20 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { backgroundColor: '#4f46e5', paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', position: 'relative' },
    headerText: { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },
    addButton: { position: 'absolute', right: 16, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center' },
    addButtonText: { fontSize: 20, color: '#000000', fontWeight: 'bold' },
    listContainer: { flex: 1, padding: 8 },
    noteRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', marginBottom: 8, borderRadius: 8, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
    dragHandle: { paddingRight: 12, paddingVertical: 4 },
    dragIcon: { fontSize: 24, color: '#9ca3af' },
    input: { flex: 1, fontSize: 16, color: '#1f2937', paddingVertical: 4 },
    deleteButton: { paddingLeft: 12 },
});
