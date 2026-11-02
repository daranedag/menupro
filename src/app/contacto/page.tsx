import MarketingLayout from '@/components/MarketingLayout';
import { MessageCircle, UtensilsCrossed } from 'lucide-react';
export const metadata = { title: 'Contacto' };
export default function Contact() {
  return <MarketingLayout><section className="content-width contact-layout"><div><h1>Hablemos de<br />tu próxima carta.</h1><p>¿Tienes una cafetería, un restaurante o un bar? Cuéntanos cómo es tu local y qué necesitas. Te ayudamos a comenzar con tu carta digital.</p><div className="mt-8 flex items-center gap-3 text-sm text-muted"><UtensilsCrossed size={20} aria-hidden="true" />Una conversación, de tu local al nuestro.</div></div><aside className="contact-help"><MessageCircle size={34} strokeWidth={1.5} aria-hidden="true" /><h2>Estamos al otro lado.</h2><p>Escríbenos por WhatsApp para resolver tus dudas sobre la carta, los planes o cómo empezar.</p><a className="button-primary" href="https://wa.me/56967603803" target="_blank" rel="noopener noreferrer">Contactar por WhatsApp</a><p className="!mb-0 !mt-5 text-xs">También puedes probar por tu cuenta durante 15 días, sin tarjeta.</p></aside></section></MarketingLayout>;
}
