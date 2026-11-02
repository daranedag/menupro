import Link from 'next/link';
import MarketingHeader from './marketing/MarketingHeader';
import Brand from './Brand';
import { MessageCircle } from 'lucide-react';

const footerGroups = [
  { title: 'Navegación', links: [['/', 'Inicio'], ['/quienes-somos', 'Quiénes Somos'], ['/contacto', 'Contacto'], ['/menu-digital-restaurantes', 'Menú Digital']] },
  { title: 'Ciudades', links: [['/menu-digital-restaurantes-santiago', 'Santiago'], ['/menu-digital-restaurantes-valdivia', 'Valdivia'], ['/menu-digital-restaurantes', 'Ver todas']] },
  { title: 'Legal', links: [['/terminos', 'Términos de Uso'], ['/privacidad', 'Política de Privacidad']] },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="marketing-site min-h-screen">
    <MarketingHeader />
    <main id="contenido">{children}</main>
    <footer className="marketing-footer">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <Brand />
            <p className="mb-4 mt-4 max-w-60 text-sm text-muted">Tu cocina tiene identidad. Tu carta también puede tenerla.</p>
            <a href="https://wa.me/56967603803" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-muted transition hover:text-[var(--color-accent)]"><MessageCircle size={16} aria-hidden="true" /> Escríbenos</a>
          </div>
          {footerGroups.map(group => <nav key={group.title} aria-label={group.title}>
            <h3 className="mb-3 font-semibold">{group.title}</h3>
            <ul className="space-y-2 text-sm">{group.links.map(([href, label]) => <li key={href}><Link href={href} className="text-muted transition hover:text-[var(--color-accent)]">{label}</Link></li>)}</ul>
          </nav>)}
        </div>
        <div className="flex flex-col items-center justify-between gap-4 border-t border-default pt-6 text-sm text-muted md:flex-row">
          <p>© {new Date().getFullYear()} MenuPro. Todos los derechos reservados.</p>
          <p className="text-xs">Hecho en Chile, para tu mesa.</p>
        </div>
      </div>
    </footer>
  </div>;
}
