import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import Ionicons from '@expo/vector-icons/Ionicons';

interface Props {
    visible: boolean;
    onResponse: (response: 'yes' | 'no') => void;
}

export const HeartbeatDialog: React.FC<Props> = ({ visible, onResponse }) => {
    const { colors } = useTheme();

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={[styles.dialog, { backgroundColor: colors.card }]}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="warning" size={64} color="#f59e0b" />
                    </View>

                    <Text style={[styles.title, { color: colors.text }]}>
                        ⚠️ Inaktivitás Figyelmeztetés
                    </Text>

                    <Text style={[styles.message, { color: colors.textSecondary }]}>
                        Dolgozol még?{'\n'}
                        Válaszolj 4 percen belül, különben kijelentkezünk!
                    </Text>

                    <View style={styles.buttons}>
                        <TouchableOpacity
                            style={[styles.button, styles.yesButton]}
                            onPress={() => onResponse('yes')}
                        >
                            <Ionicons name="checkmark-circle" size={24} color="white" />
                            <Text style={styles.buttonText}>Igen, dolgozom</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.button, styles.noButton]}
                            onPress={() => onResponse('no')}
                        >
                            <Ionicons name="close-circle" size={24} color="white" />
                            <Text style={styles.buttonText}>Nem</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    dialog: {
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 12,
    },
    message: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    buttons: {
        gap: 12,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        gap: 8,
    },
    yesButton: {
        backgroundColor: '#10b981',
    },
    noButton: {
        backgroundColor: '#ef4444',
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
});
