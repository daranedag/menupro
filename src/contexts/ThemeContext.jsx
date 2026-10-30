'use client';
import { createContext, useContext, useState, useEffect } from 'react';

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

export const ThemeProvider = ({ children, initialTheme }) => {
  // The initial appearance comes from the restaurant, including during SSR.
  const [theme, setTheme] = useState(() => {
    if (initialTheme) return initialTheme;
    return {
      mode: 'light',
      colors: colorPresets.default,
      colorPreset: 'default',
      font: fontPresets.default,
      fontPreset: 'default',
    };
  });

  // Apply the selected appearance. Settings saves it through the BFF.
  useEffect(() => {
    
    // Aplicar variables CSS globales
    const root = document.documentElement;
    root.style.setProperty('--color-primary', theme.colors.primary);
    root.style.setProperty('--color-secondary', theme.colors.secondary);
    root.style.setProperty('--color-accent', theme.colors.accent);
    root.style.setProperty('--font-family', theme.font.fontFamily);
    
    // Aplicar modo oscuro/claro
    if (theme.mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const updateColors = (colorPresetName) => {
    setTheme({
      ...theme,
      colors: colorPresets[colorPresetName],
      colorPreset: colorPresetName,
    });
  };

  const updateFont = (fontPresetName) => {
    setTheme({
      ...theme,
      font: fontPresets[fontPresetName],
      fontPreset: fontPresetName,
    });
  };

  const toggleMode = () => {
    setTheme({
      ...theme,
      mode: theme.mode === 'light' ? 'dark' : 'light',
    });
  };

  const setMode = (mode) => {
    setTheme({
      ...theme,
      mode,
    });
  };

  const resetTheme = () => {
    setTheme({
      mode: 'light',
      colors: colorPresets.default,
      colorPreset: 'default',
      font: fontPresets.default,
      fontPreset: 'default',
    });
  };

  const value = {
    theme,
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
