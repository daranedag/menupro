import MarketingLayout from '@/components/MarketingLayout';
export const metadata = { title: "Quiénes somos" };
export default function Page() { return <MarketingLayout><div className="legacy-content">
  
  <section className="py-12 md:py-16 px-6 max-w-5xl mx-auto">
    
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight mb-6">
          MenuPro: cartas digitales pensadas para restaurantes
        </h1>
        <p className="text-lg md:text-xl text-muted leading-relaxed">
          MenuPro nace para simplificar la forma en que los restaurantes gestionan su carta.
          Creamos menús digitales claros, editables y profesionales, pensados para el día a día 
          de locales gastronómicos.
        </p>
      </div>
    
  </section>

  
  <section className="py-16 px-6 bg-[var(--color-bg-soft)]">
    <div className="max-w-4xl mx-auto">
      
        <h2 className="text-3xl md:text-4xl font-semibold mb-6 text-center">
          Por qué existe MenuPro
        </h2>
        
        <div className="prose prose-lg dark:prose-invert mx-auto">
          <p className="text-muted text-lg leading-relaxed mb-4">
            Muchos restaurantes siguen dependiendo de cartas impresas, PDFs desactualizados 
            o soluciones poco claras. Cambiar precios, corregir errores o adaptar la carta 
            a la temporada suele ser lento, caro y frustrante.
          </p>
          
          <p className="text-lg leading-relaxed font-medium">
            MenuPro existe para devolver el control al restaurante, sin complicaciones técnicas.
          </p>
        </div>
      
    </div>
  </section>

  
  <section className="py-16 px-6 max-w-6xl mx-auto">
    
      <h2 className="text-3xl md:text-4xl font-semibold mb-12 text-center">
        Pensado para
      </h2>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <div className="flex items-start gap-4 p-6 rounded-2xl border border-default bg-[var(--color-bg)] hover:bg-[var(--color-bg-soft)] transition">
          <span className="text-3xl">🍽️</span>
          <div>
            <h3 className="text-xl font-semibold mb-2">Restaurantes independientes</h3>
            <p className="text-muted text-sm">
              Locales con identidad propia que buscan profesionalizar su carta sin perder autenticidad.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-6 rounded-2xl border border-default bg-[var(--color-bg)] hover:bg-[var(--color-bg-soft)] transition">
          <span className="text-3xl">☕</span>
          <div>
            <h3 className="text-xl font-semibold mb-2">Cafeterías y bistrós</h3>
            <p className="text-muted text-sm">
              Espacios modernos que necesitan actualizar su oferta con frecuencia y rapidez.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-6 rounded-2xl border border-default bg-[var(--color-bg)] hover:bg-[var(--color-bg-soft)] transition">
          <span className="text-3xl">🍺</span>
          <div>
            <h3 className="text-xl font-semibold mb-2">Cervecerías y foodtrucks</h3>
            <p className="text-muted text-sm">
              Negocios dinámicos con ofertas cambiantes que requieren flexibilidad constante.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 p-6 rounded-2xl border border-default bg-[var(--color-bg)] hover:bg-[var(--color-bg-soft)] transition">
          <span className="text-3xl">✨</span>
          <div>
            <h3 className="text-xl font-semibold mb-2">Locales que quieren verse profesionales</h3>
            <p className="text-muted text-sm">
              Sin perder tiempo en diseño o impresiones, mantén tu carta siempre actualizada.
            </p>
          </div>
        </div>
      </div>
    
  </section>

  
  <section className="py-16 px-6 bg-[var(--color-bg-soft)]">
    <div className="max-w-4xl mx-auto">
      
        <h2 className="text-3xl md:text-4xl font-semibold mb-6 text-center">
          Cómo trabajamos
        </h2>

        <div className="prose prose-lg dark:prose-invert mx-auto text-center">
          <p className="text-muted text-lg leading-relaxed mb-4">
            No creemos en soluciones genéricas.<br />
            Acompañamos a cada restaurante para dejar su carta digital clara, ordenada 
            y lista para sus clientes.
          </p>

          <p className="text-lg leading-relaxed font-medium">
            MenuPro combina tecnología simple con una experiencia pensada desde 
            la operación real del restaurante.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--marketing-button)] text-white flex items-center justify-center text-2xl font-bold">
              1
            </div>
            <h3 className="font-semibold mb-2">Conversamos</h3>
            <p className="text-sm text-muted">
              Entendemos tu negocio, tu carta actual y lo que necesitas.
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--marketing-button)] text-white flex items-center justify-center text-2xl font-bold">
              2
            </div>
            <h3 className="font-semibold mb-2">Implementamos</h3>
            <p className="text-sm text-muted">
              Creamos tu menú digital con tu identidad y estructura.
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--marketing-button)] text-white flex items-center justify-center text-2xl font-bold">
              3
            </div>
            <h3 className="font-semibold mb-2">Acompañamos</h3>
            <p className="text-sm text-muted">
              Te enseñamos a gestionar y actualizar tu carta de forma autónoma.
            </p>
          </div>
        </div>
      
    </div>
  </section>

  
  <section className="py-16 px-6 max-w-4xl mx-auto">
    
      <div className="text-center">
        <h2 className="text-3xl md:text-4xl font-semibold mb-6">
          Dónde estamos
        </h2>

        <div className="bg-[var(--color-bg-soft)] rounded-3xl p-8 md:p-12 border border-default">
          <p className="text-lg md:text-xl text-muted leading-relaxed mb-6">
            MenuPro opera en <strong>Chile</strong> (por ahora) y está enfocado en restaurantes 
            de distintas ciudades del país.
          </p>

          <p className="text-lg leading-relaxed mb-8">
            Atendemos de forma remota y acompañamos a cada cliente durante la implementación.
          </p>

          <div className="flex flex-wrap justify-center gap-3 text-sm">
            <a 
              href="/menu-digital-restaurantes-valdivia"
              className="px-4 py-2 rounded-lg bg-[var(--color-bg)] border border-default hover:bg-[var(--color-bg-soft)] transition"
            >
              📍 Valdivia
            </a>
            <a 
              href="/menu-digital-restaurantes-santiago"
              className="px-4 py-2 rounded-lg bg-[var(--color-bg)] border border-default hover:bg-[var(--color-bg-soft)] transition"
            >
              📍 Santiago
            </a>
            <span className="px-4 py-2 rounded-lg bg-[var(--color-bg)] border border-default opacity-60">
              📍 Más ciudades en camino
            </span>
          </div>
        </div>
      </div>
    
  </section>

  
  <section className="py-16 md:py-20 px-6 max-w-3xl mx-auto">
    
      <div className="text-center bg-[var(--color-bg-soft)] rounded-3xl p-8 md:p-12 border border-default">
        <h2 className="text-2xl md:text-3xl font-semibold mb-4">
          ¿Quieres saber si MenuPro es adecuado para tu restaurante?
        </h2>

        <p className="text-muted mb-8">
          Conversemos sin compromiso sobre tu carta y cómo podríamos ayudarte.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <a
            href="https://wa.me/56967603803"
            className="px-8 py-4 rounded-xl font-medium bg-[var(--marketing-button)] text-white hover:opacity-90 transition"
          >
            Hablar con nosotros
          </a>

          <a
            href="/contacto"
            className="px-8 py-4 rounded-xl font-medium border border-default hover:bg-[var(--color-bg)] transition"
          >
            Solicitar demo
          </a>
        </div>
      </div>
    
  </section>
</div></MarketingLayout>; }
