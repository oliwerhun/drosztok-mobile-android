import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    colors: typeof lightColors;
}

const lightColors = {
    background: '#f9fafb',
    card: '#ffffff',
    text: '#1f2937',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    headerBackground: '#1f2937',
    headerText: '#ffffff',
    tabBarBackground: '#ffffff',
    tabActive: '#000000',
    tabInactive: '#ffffff',
    tabTextActive: '#ffffff',
    tabTextInactive: '#6b7280',
    locationHeader: '#4f46e5',
    inputBackground: '#ffffff',
    memberItem: '#f3f4f6',
    memberItemSelf: '#dbeafe',
    memberItemSelfBorder: '#3b82f6',
    memberItemSelfText: '#1e40af',
    actionButtonsBackground: '#f9fafb',
    primary: '#4f46e5',
    warningBackground: '#fffbeb',
    warningBorder: '#fcd34d',
    footerBackground: '#ffffff',
};

const darkColors = {
    background: '#111827',
    card: '#1f2937',
    text: '#f9fafb',
    textSecondary: '#9ca3af',
    border: '#374151',
    headerBackground: '#000000',
    headerText: '#ffffff',
    tabBarBackground: '#1f2937',
    tabActive: '#ffffff',
    tabInactive: '#374151',
    tabTextActive: '#000000',
    tabTextInactive: '#9ca3af',
    locationHeader: '#3730a3',
    inputBackground: '#374151',
    memberItem: '#374151',
    memberItemSelf: '#1e3a8a',
    memberItemSelfBorder: '#60a5fa',
    memberItemSelfText: '#bfdbfe',
    actionButtonsBackground: '#111827',
    primary: '#6366f1',
    warningBackground: '#451a03',
    warningBorder: '#78350f',
    footerBackground: '#1f2937',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const systemScheme = useColorScheme();
    const [theme, setTheme] = useState<Theme>('light');

    useEffect(() => {
        // Load saved theme or default to system
        AsyncStorage.getItem('app_theme').then(savedTheme => {
            if (savedTheme) {
                setTheme(savedTheme as Theme);
            } else if (systemScheme) {
                setTheme(systemScheme);
            }
        });
    }, []);

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        AsyncStorage.setItem('app_theme', newTheme);
    };

    const colors = theme === 'light' ? lightColors : darkColors;

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
