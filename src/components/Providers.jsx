'use client';
import { AuthProvider } from '@/contexts/AuthContext';
import { MenuProvider } from '@/contexts/MenuContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import '@/i18n/config';
import ThemeSync from './ThemeSync';
import MenuFormGate from './MenuFormGate';

export default function Providers({ children }) {
  return <AuthProvider><ThemeProvider><ThemeSync /><MenuProvider><MenuFormGate>{children}</MenuFormGate></MenuProvider></ThemeProvider></AuthProvider>;
}
