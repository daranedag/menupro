import Link from 'next/link';
import { Check, PencilLine, QrCode, Palette, Printer, Smartphone, MessageCircle, BookOpen } from 'lucide-react';
import MarketingLayout from '@/components/MarketingLayout';
import MenuDemo from '@/components/marketing/MenuDemo';

const features = [
  { icon: PencilLine, title: 'Un cambio y listo.', text: 'Edita precios, agrega el plato del día o pausa lo que se agotó. Tú tienes el control.' },
  { icon: QrCode, title: 'El mismo QR. Siempre.', text: 'Imprímelo una vez. Tus clientes encuentran la carta actualizada cada vez que lo escanean.' },
  { icon: Palette, title: 'Con el sello de tu local.', text: 'Elige colores y tipografía, suma fotos y organiza tus platos a tu manera.' },
  { icon: Smartphone, title: 'Hecha para abrir el apetito.', text: 'Una carta que se lee cómodamente en el celular. Sin descargas y sin hacer zoom.' },
  { icon: Printer, title: 'También sobre la mesa.', text: 'Descarga tu carta en PDF cuando necesites una versión para imprimir.' },
  { icon: BookOpen, title: 'Cada carta en su lugar.', text: 'Separa almuerzo, bebidas y especialidades. Administra todo desde un solo panel.' },
];

export default function Home() {
  return <MarketingLayout>
    <section className="home-hero content-width">
      <div className="hero-copy">
        <span className="trial-note"><span aria-hidden="true" />15 días para probar con tu propia carta</span>
        <h1>Tu cocina cambia.<br />Tu carta también.</h1>
        <p>El plato del día, los nuevos precios, tu próxima creación. Pon tu carta al día y compártela con un solo QR.</p>
        <div className="hero-actions"><Link href="/app/register" className="button-primary">Crear mi carta gratis</Link><a href="#demo" className="button-secondary">Explorar un ejemplo</a></div>
        <div className="hero-assurances"><span><Check size={15} /> Sin tarjeta</span><span><Check size={15} /> Sin instalar apps</span><span><Check size={15} /> Hecho en Chile</span></div>
      </div>
      <MenuDemo />
    </section>
    <div className="audience-strip"><div className="content-width"><p>Tu lugar tiene su propia receta.</p><div><span>Restaurantes</span><span>Cafeterías</span><span>Bares</span><span>Foodtrucks</span></div></div></div>
    <section id="features" className="home-features content-width">
      <div className="section-intro"><h2>Menos tiempo en la carta.<br />Más tiempo en tu cocina.</h2><p>Todo lo que necesitas para mantener tu menú al día, sin depender de nadie.</p></div>
      <div className="feature-grid">{features.map(({ icon: Icon, title, text }) => <article key={title}><span className="feature-icon"><Icon size={23} strokeWidth={1.7} aria-hidden="true" /></span><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>
    <section id="como-funciona" className="how-section"><div className="content-width how-layout"><div><h2>De tu cocina<br />a su celular.</h2><p>Empieza con lo que ya tienes. Tu carta puede crecer contigo.</p><Link href="/app/register" className="text-link">Comenzar mis 15 días gratis</Link></div><ol>{[
      ['Dale un lugar a cada plato', 'Crea tu cuenta, agrega tu restaurante y organiza tu carta por secciones.'],
      ['Hazla tuya', 'Agrega platos, precios y fotos. Elige la apariencia que mejor represente a tu local.'],
      ['Pon el QR sobre la mesa', 'Publica tu carta y comparte tu QR. Cuando cambie el menú, actualízalo desde el panel.'],
    ].map(([title, text], i) => <li key={title}><span>{i + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></div></section>
    <section className="home-invitation content-width"><div><h2>La próxima carta<br />puede ser la tuya.</h2><p>Prueba MenuPro durante 15 días con tus platos y tu QR. Si continúas, conservas todo lo que creaste.</p><Link href="/app/register" className="button-primary">Crear mi carta gratis</Link><Link href="/precios" className="text-link">Consultar planes y precios</Link></div><div className="help-note"><MessageCircle size={30} strokeWidth={1.5} /><h3>¿Lo vemos juntos?</h3><p>Cuéntanos sobre tu local y te ayudamos a dar el primer paso.</p><a href="https://wa.me/56967603803" target="_blank" rel="noopener noreferrer" className="text-link">Conversar por WhatsApp</a></div></section>
  </MarketingLayout>;
}
