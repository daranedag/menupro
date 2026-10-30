import Link from 'next/link';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white">
    <header className="border-b border-slate-100 bg-white">
      <nav aria-label="Navegación principal" className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight"><img src="/favicon.png" alt="" width="32" height="32" />MenuPro</Link>
        <div className="flex items-center gap-4 text-sm font-medium sm:gap-6">
          <Link className="hidden text-slate-600 hover:text-indigo-600 sm:block" href="/quienes-somos">Quiénes somos</Link>
          <Link className="hidden text-slate-600 hover:text-indigo-600 sm:block" href="/contacto">Contacto</Link>
          <Link href="/app/login" className="rounded-full bg-indigo-600 px-5 py-2.5 text-white hover:bg-indigo-700">Iniciar sesión</Link>
        </div>
      </nav>
    </header>
    <main>{children}</main>
    <footer className="border-t border-slate-100 bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-6 py-10 text-sm text-slate-500 sm:flex-row">
        <div><Link className="font-bold text-slate-900" href="/">MenuPro</Link><p className="mt-2">Tu carta digital, siempre actualizada.</p></div>
        <nav aria-label="Enlaces del pie de página" className="flex flex-wrap items-center gap-5">
          <Link href="/quienes-somos">Quiénes somos</Link><Link href="/contacto">Contacto</Link>
          <Link href="/privacidad">Privacidad</Link><Link href="/terminos">Términos de uso</Link>
        </nav>
      </div>
    </footer>
  </div>;
}
