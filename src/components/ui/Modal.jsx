'use client';
import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, footer, size = 'md', closeOnOverlay = true }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; dialog.close(); };
  }, [isOpen]);
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-full' };
  function containFocus(event) {
    if (event.key !== 'Tab') return;
    const controls = Array.from(ref.current.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(element => element.getClientRects().length && !element.closest('[inert]'));
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return <dialog ref={ref} aria-labelledby={title ? titleId : undefined} aria-label={title ? undefined : 'Ventana de MenuPro'} onKeyDown={containFocus} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (closeOnOverlay && event.target === event.currentTarget) { const rect = ref.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }} className={`ui-dialog bg-surface text-ink ${sizes[size] || sizes.md}`}>
    <div className="flex items-center justify-between gap-4 border-b border-line p-5 sm:px-7"><h3 id={titleId} className="text-xl font-semibold">{title}</h3><button type="button" aria-label="Cerrar ventana" onClick={onClose} className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-canvas"><X size={20} aria-hidden="true" /></button></div>
    <div className="overflow-y-auto p-5 sm:p-7">{children}</div>
    {footer && <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line bg-canvas p-5 sm:px-7">{footer}</div>}
  </dialog>;
}
