'use client';
import { createContext, useContext, useState } from 'react';
import { setAppearance, useAppearance } from '@/lib/appearance';

const ThemeContext = createContext(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Paletas de colores predefinidas
export const colorPresets = {
  default: {
    primary: '#3b82f6', // blue-500
    secondary: '#8b5cf6', // purple-500
    accent: '#10b981', // green-500
  },
  elegant: {
    primary: '#1f2937', // gray-800
    secondary: '#6b7280', // gray-500
    accent: '#d97706', // amber-600
  },
  ocean: {
    primary: '#0891b2', // cyan-600
    secondary: '#06b6d4', // cyan-500
    accent: '#0284c7', // sky-600
  },
  sunset: {
    primary: '#dc2626', // red-600
    secondary: '#f97316', // orange-500
    accent: '#facc15', // yellow-400
  },
  forest: {
    primary: '#059669', // emerald-600
    secondary: '#10b981', // emerald-500
    accent: '#84cc16', // lime-500
  },
  royal: {
    primary: '#7c3aed', // violet-600
    secondary: '#a855f7', // purple-500
    accent: '#ec4899', // pink-500
  },
};

// Tipografías disponibles
export const fontPresets = {
  default: {
    name: 'Sistema',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  modern: {
    name: 'Modern',
    fontFamily: '"Inter", system-ui, sans-serif',
  },
  classic: {
    name: 'Classic',
    fontFamily: '"Georgia", serif',
  },
  elegant: {
    name: 'Elegant',
    fontFamily: '"Playfair Display", serif',
  },
  casual: {
    name: 'Casual',
    fontFamily: '"Comic Sans MS", cursive',
  },
};

const defaultMenuTheme = {
  mode: 'light',
  colors: colorPresets.default,
  colorPreset: 'default',
  font: fontPresets.default,
  fontPreset: 'default',
};

export const ThemeProvider = ({ children, initialTheme }) => {
  const mode = useAppearance();
  const [menuTheme, setTheme] = useState(() => initialTheme || defaultMenuTheme);
  // Restaurant appearance stays local. Only the shared browser preference controls the app.
  const theme = initialTheme ? menuTheme : { ...menuTheme, mode };

  const updateColors = (colorPresetName) => {
    setTheme(previous => ({
      ...previous,
      colors: colorPresets[colorPresetName],
      colorPreset: colorPresetName,
    }));
  };

  const updateFont = (fontPresetName) => {
    setTheme(previous => ({
      ...previous,
      font: fontPresets[fontPresetName],
      fontPreset: fontPresetName,
    }));
  };

  const toggleMode = () => {
    setAppearance(mode === 'light' ? 'dark' : 'light');
  };

  const setMode = (mode) => {
    setAppearance(mode);
  };

  const resetTheme = () => {
    setTheme(defaultMenuTheme);
  };

  const value = {
    theme,
    menuTheme,
    setTheme,
    updateColors,
    updateFont,
    toggleMode,
    setMode,
    resetTheme,
    colorPresets,
    fontPresets,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
