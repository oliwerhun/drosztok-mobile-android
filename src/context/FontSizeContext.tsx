import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FontSizeContextType {
    fontSizeLevel: number;
    fontSize: number;
    increaseFontSize: () => void;
    decreaseFontSize: () => void;
}

const FONT_SIZES = [14, 16, 18, 20]; // 4 steps
const DEFAULT_LEVEL = 0; // Starts at 14

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

export const FontSizeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [fontSizeLevel, setFontSizeLevel] = useState(DEFAULT_LEVEL);

    useEffect(() => {
        AsyncStorage.getItem('font_size_level').then(savedLevel => {
            if (savedLevel !== null) {
                const level = parseInt(savedLevel, 10);
                if (!isNaN(level) && level >= 0 && level < FONT_SIZES.length) {
                    setFontSizeLevel(level);
                }
            }
        });
    }, []);

    const increaseFontSize = () => {
        if (fontSizeLevel < FONT_SIZES.length - 1) {
            const newLevel = fontSizeLevel + 1;
            setFontSizeLevel(newLevel);
            AsyncStorage.setItem('font_size_level', newLevel.toString());
        }
    };

    const decreaseFontSize = () => {
        if (fontSizeLevel > 0) {
            const newLevel = fontSizeLevel - 1;
            setFontSizeLevel(newLevel);
            AsyncStorage.setItem('font_size_level', newLevel.toString());
        }
    };

    return (
        <FontSizeContext.Provider value={{
            fontSizeLevel,
            fontSize: FONT_SIZES[fontSizeLevel],
            increaseFontSize,
            decreaseFontSize
        }}>
            {children}
        </FontSizeContext.Provider>
    );
};

export const useFontSize = () => {
    const context = useContext(FontSizeContext);
    if (!context) {
        throw new Error('useFontSize must be used within a FontSizeProvider');
    }
    return context;
};
