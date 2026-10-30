import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'http://localhost:3000'),
  title: { default: 'MenuPro | Carta digital para restaurantes con QR', template: '%s | MenuPro' },
  description: 'Crea, edita y comparte el menú de tu restaurante en minutos. Actualiza platos y precios sin reimprimir tu código QR.',
  icons: { icon: '/favicon.png' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
