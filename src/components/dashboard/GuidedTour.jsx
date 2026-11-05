'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, Compass } from 'lucide-react';
import 'driver.js/dist/driver.css';
import './guided-tour.css';

const stepsByScope = {
  home: [
    ['tour-welcome', 'Tu demo ya está lista', 'Te mostramos dónde empezar. Puedes cerrar esta guía con la X o con Escape y repetirla cuando quieras.'],
    ['tour-menu', 'Empieza por tu carta', 'Abre tu carta de ejemplo para cambiar sus platos y precios, o crea una nueva. Dentro del editor encontrarás otro recorrido con los pasos para prepararla.'],
    ['tour-appearance', 'Dale tu estilo', 'En Apariencia puedes elegir los colores y la tipografía de la carta de tu restaurante.'],
    ['tour-publish', 'Publica cuando esté lista', 'En Mis cartas, usa Publicar. Mantén la carta activa y visible para que tus clientes puedan consultarla.'],
    ['tour-subscription', 'Consulta tu demo', 'En Suscripción verás las fechas y las opciones para continuar. La demo no realiza cobros automáticos.'],
    ['tour-help', 'Tu ayuda, siempre a mano', 'Repite el recorrido o descarga el manual PDF. Tu siguiente paso: abrir la carta y editar tu primer plato.'],
  ],
  editor: [
    ['tour-sections', 'Organiza tu carta', 'Las secciones agrupan los platos, por ejemplo Entradas, Fondos y Bebidas. Usa Nueva Sección para agregar otra categoría.'],
    ['tour-dishes', 'Edita platos y precios', 'El lápiz junto a cada plato abre su ficha. Cambia el nombre, precio y descripción, y pulsa Guardar Cambios. El botón Plato agrega uno nuevo.'],
    ['tour-preview', 'Revisa antes de compartir', 'Vista Previa te permite comprobar el contenido. También puedes revisar cómo se verá en un teléfono.'],
    ['tour-share', 'Comparte con QR o PDF', 'Generar QR permite copiar el enlace y descargar el código. Publica primero desde Mis cartas. Descargar PDF crea una copia que debes volver a generar cuando cambies la carta.'],
    ['tour-back', 'El último paso: publicar', 'Vuelve a Mis cartas y pulsa Publicar cuando hayas revisado todo. El tour solo explica los controles; tú decides qué editar y cuándo publicar.'],
  ],
};

// Storage is scoped to the person and business, never shared across accounts.
// The in-memory fallback also prevents repeated prompts when storage is blocked.
const seenThisVisit = new Set();

export default function GuidedTour({ scope, ready = true }) {
  const { user } = useAuth();
  const active = useRef(null);
  const generation = useRef(0);
  const launcher = useRef(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const key = user?.id && user?.businessId ? `menupro:tour:v1:${user.id}:${user.businessId}:${scope}` : null;
  const eligible = !!key && !user?.isAdmin && user?.canEdit && user?.subscription?.has_access;

  const start = useCallback(async (automatic = false) => {
    if (!eligible || !ready || active.current?.isActive()) return;
    if (automatic) {
      if (seenThisVisit.has(key)) return;
      try { if (localStorage.getItem(key)) return; } catch { /* Use memory. */ }
    }
    const ticket = ++generation.current;
    setBusy(true); setError('');
    try {
      const { driver } = await import('driver.js');
      if (ticket !== generation.current) return;
      const steps = stepsByScope[scope].flatMap(([id, title, description]) => {
        const element = document.querySelector(`[data-tour="${id}"]`);
        return element && element.getClientRects().length ? [{ element, popover: { title, description } }] : [];
      });
      if (!steps.length) return;
      const tour = driver({
        steps, showProgress: true, progressText: '{{current}} de {{total}}',
        nextBtnText: 'Siguiente', prevBtnText: 'Anterior', doneBtnText: 'Terminar', closeBtnLabel: 'Cerrar recorrido',
        animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        allowClose: true, overlayClickBehavior: 'close', disableActiveInteraction: true,
        popoverClass: 'menupro-tour', stagePadding: 6,
        // Driver.js can close before its first highlight animation completes.
        // Its onDestroyed hook is skipped in that case; always release our ref.
        onDestroyStarted: (_element, _step, { driver: instance }) => {
          instance.destroy();
          active.current = null;
          launcher.current?.focus({ preventScroll: true });
        },
        onDestroyed: () => {
          active.current = null;
          launcher.current?.focus({ preventScroll: true });
        },
      });
      active.current = tour;
      tour.drive();
      // Once offered, do not interrupt this user again, even if they skip it.
      seenThisVisit.add(key);
      try { localStorage.setItem(key, 'seen'); } catch { /* Use memory. */ }
    } catch {
      if (ticket === generation.current) setError('No pudimos abrir el recorrido. Puedes reintentarlo o consultar el manual PDF.');
    } finally { if (ticket === generation.current) setBusy(false); }
  }, [eligible, ready, key, scope]);

  useEffect(() => {
    setBusy(false);
    if (user?.subscription?.effective_status === 'trial' && eligible && ready) void start(true);
    return () => { generation.current++; active.current?.destroy(); active.current = null; };
  }, [start, eligible, ready, user?.subscription?.effective_status]);

  if (user?.isAdmin) return null;
  return <div data-tour="tour-help" className="menupro-help">
    <div className="flex flex-wrap items-center gap-3">
      {eligible && <button ref={launcher} type="button" disabled={!ready || busy} onClick={() => start()} className="ui-button inline-flex items-center gap-2 border border-line px-4 py-2 text-sm"><Compass size={17} aria-hidden="true" />{busy ? 'Preparando recorrido…' : 'Ver recorrido guiado'}</button>}
      <a href="/manuales/menupro-guia-rapida.pdf" download className="inline-flex items-center gap-2 text-sm font-semibold text-brand underline underline-offset-4"><BookOpen size={17} aria-hidden="true" />Manual de usuario (PDF)</a>
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-muted">{error}</p>}
  </div>;
}
