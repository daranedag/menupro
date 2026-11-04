import { Activity, Building2, ClipboardList, ListFilter, ReceiptText, SlidersHorizontal } from 'lucide-react';

export const adminHome = '/app/dashboard/admin';
export const adminLinks = [
  { href: adminHome, label: 'Planes disponibles', icon: SlidersHorizontal },
  { href: adminHome + '/alertas', label: 'Alertas operativas', icon: Activity },
  { href: adminHome + '/solicitudes', label: 'Solicitudes', icon: ClipboardList },
  { href: adminHome + '/transferencias', label: 'Transferencias y boletas', icon: ReceiptText },
  { href: adminHome + '/negocios', label: 'Negocios registrados', icon: Building2 },
  { href: adminHome + '/logs', label: 'Logs', icon: ListFilter },
];
