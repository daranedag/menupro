import Link from 'next/link';
import MarketingHeader from './marketing/MarketingHeader';

const footerGroups = [
  { title: 'Navegación', links: [['/', 'Inicio'], ['/quienes-somos', 'Quiénes Somos'], ['/contacto', 'Contacto'], ['/menu-digital-restaurantes', 'Menú Digital']] },
  { title: 'Ciudades', links: [['/menu-digital-restaurantes-santiago', 'Santiago'], ['/menu-digital-restaurantes-valdivia', 'Valdivia'], ['/menu-digital-restaurantes', 'Ver todas →']] },
  { title: 'Legal', links: [['/terminos', 'Términos de Uso'], ['/privacidad', 'Política de Privacidad']] },
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="marketing-site min-h-screen">
    <MarketingHeader />
    <main>{children}</main>
    <footer className="border-t border-default bg-[var(--color-bg-soft)]">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <Link href="/" className="mb-3 block text-lg font-semibold transition hover:text-[var(--color-accent)]">MenuPro</Link>
            <p className="mb-4 text-sm text-muted">Carta digital para restaurantes. Simple, profesional y siempre actualizada.</p>
            <a href="https://wa.me/56967603803" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-muted transition hover:text-[var(--color-accent)]"><span aria-hidden="true" className="text-lg">💬</span> Escríbenos</a>
          </div>
          {footerGroups.map(group => <nav key={group.title} aria-label={group.title}>
            <h3 className="mb-3 font-semibold">{group.title}</h3>
            <ul className="space-y-2 text-sm">{group.links.map(([href, label]) => <li key={href}><Link href={href} className="text-muted transition hover:text-[var(--color-accent)]">{label}</Link></li>)}</ul>
          </nav>)}
        </div>
        <div className="flex flex-col items-center justify-between gap-4 border-t border-default pt-6 text-sm text-muted md:flex-row">
          <p>© {new Date().getFullYear()} MenuPro. Todos los derechos reservados.</p>
          <p className="text-xs">Hecho con ❤️ en Chile</p>
        </div>
      </div>
    </footer>
  </div>;
}
