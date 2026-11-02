'use client';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function SubscriptionBanner() {
  const { user } = useAuth();
  const s = user?.subscription;
  if (!s) return null;
  let message;
  if (s.effective_status === 'trial') {
    const days = Math.max(0, Math.ceil((Date.parse(s.trial_ends_at) - Date.now()) / 86400000));
    message = `Demo gratuita: ${days} ${days === 1 ? 'día restante' : 'días restantes'}.`;
  } else if (s.effective_status === 'expired') message = 'Tu acceso ha vencido. Puedes consultar tus cartas y descargar tus datos. Reactiva para editar y publicar.';
  else if (s.effective_status === 'review') message = 'La activación de tu demo está pendiente de verificación.';
  else if (s.effective_status === 'past_due') message = 'Revisa tu pago. El período de gracia termina el ' + new Date(s.grace_until).toLocaleDateString('es-CL') + '.';
  else if (s.cancel_at_period_end && s.current_period_end) message = 'Renovación cancelada. Acceso hasta el ' + new Date(s.current_period_end).toLocaleDateString('es-CL') + '.';
  else if (s.courtesy_until && Date.parse(s.courtesy_until) > Date.now()) message = 'Tienes una cortesía hasta el ' + new Date(s.courtesy_until).toLocaleDateString('es-CL') + '.';
  if (!message) return null;
  return <aside className="border-b border-brand bg-brand-soft px-4 py-3 text-sm text-brand" aria-label="Estado de tu suscripción">
    <div className="container mx-auto flex flex-wrap items-center justify-between gap-3"><p>{message}</p>
      <Link href="/app/dashboard/billing" className="font-semibold underline">Ver mi suscripción</Link></div>
  </aside>;
}
