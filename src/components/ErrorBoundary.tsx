import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ScrollView, Platform } from 'react-native';
import { addDoc, collection } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
// Note: We avoid heavy imports here to ensure the boundary renders reliably

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error, errorInfo: null };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // You can also log the error to an error reporting service
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });

        // Automatikus mentés a Firestore-ba
        this.logErrorToFirestore(error, errorInfo);
    }

    logErrorToFirestore = async (error: Error, errorInfo: ErrorInfo) => {
        try {
            const user = auth.currentUser;
            await addDoc(collection(db, 'system_errors'), {
                error: error.toString(),
                stackTrace: errorInfo.componentStack,
                timestamp: new Date(),
                platform: Platform.OS,
                userId: user ? user.uid : 'anonymous',
                userEmail: user ? user.email : 'N/A',
                deviceInfo: Platform.select({ ios: 'iOS', android: 'Android' })
            });
            console.log('Hiba automatikusan rögzítve a Firestore-ban.');
        } catch (dbError) {
            console.error('Nem sikerült menteni a hibát a Firestore-ba:', dbError);
        }
    };

    handleReportError = () => {
        const { error, errorInfo } = this.state;
        const subject = 'Elitdroszt App Hiba Jelentés';
        const body = `
Hiba részletei:
${error?.toString()}

Stack Trace:
${errorInfo?.componentStack}

Platform: ${Platform.OS}
Időpont: ${new Date().toLocaleString()}
User: ${auth.currentUser?.email || 'Nem bejelentkezett'}
    `;

        const url = `mailto:bader.oli@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        Linking.canOpenURL(url).then(supported => {
            if (supported) {
                Linking.openURL(url);
            } else {
                alert("Nem sikerült megnyitni a levelezőt. Kérlek írj a bader.oli@gmail.com címre!");
            }
        });
    };

    handleRestart = () => {
        // Simple state reset, might not clear native crashes but good for JS errors
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <ScrollView contentContainerStyle={styles.content}>
                        <Text style={styles.icon}>⚠️</Text>
                        <Text style={styles.title}>Váratlan hiba történt!</Text>
                        <Text style={styles.subtitle}>
                            Sajnáljuk, az alkalmazás hibába ütközött.
                        </Text>

                        <View style={styles.errorBox}>
                            <Text style={styles.errorText}>
                                {this.state.error?.toString()}
                            </Text>
                        </View>

                        <TouchableOpacity style={styles.button} onPress={this.handleReportError}>
                            <Text style={styles.buttonText}>Hiba jelentése Emailben</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={this.handleRestart}>
                            <Text style={[styles.buttonText, styles.secondaryButtonText]}>Próbáld újra</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        justifyContent: 'center',
        padding: 20,
        marginTop: 50
    },
    content: {
        alignItems: 'center',
    },
    icon: {
        fontSize: 48,
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#1f2937',
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#6b7280',
        marginBottom: 30,
        textAlign: 'center',
    },
    errorBox: {
        backgroundColor: '#fee2e2',
        padding: 15,
        borderRadius: 8,
        width: '100%',
        marginBottom: 30,
        maxHeight: 200,
    },
    errorText: {
        color: '#991b1b',
        fontSize: 14,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    button: {
        backgroundColor: '#ef4444',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        width: '100%',
        alignItems: 'center',
        marginBottom: 12,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#ef4444',
    },
    secondaryButtonText: {
        color: '#ef4444',
    },
});
