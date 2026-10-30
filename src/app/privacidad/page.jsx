import MarketingLayout from '@/components/MarketingLayout';
export const metadata = { title: "Política de privacidad" };
export default function Page() { return <MarketingLayout><div className="legacy-content">
  
  <section className="relative pt-24 pb-16 bg-[var(--color-bg-soft)]">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      
        <h1 className="text-4xl sm:text-5xl font-bold mb-6">
          Política de Privacidad
        </h1>
        <p className="text-xl text-muted">
          Última actualización: Diciembre 2025
        </p>
      
    </div>
  </section>

  
  <section className="py-16">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      
      
        <div className="mb-12">
          
          
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-4">
              1. Información que recopilamos
            </h2>
            <p className="text-muted leading-relaxed mb-4">
              MenuPro recopila información cuando el usuario:
            </p>
            <ul className="space-y-2 text-muted list-disc list-inside ml-4 mb-4">
              <li>Completa formularios de contacto o demo</li>
              <li>Utiliza la plataforma</li>
              <li>Se comunica vía correo o WhatsApp</li>
            </ul>
            <p className="text-muted font-semibold mb-3">
              La información puede incluir:
            </p>
            <ul className="space-y-2 text-muted list-disc list-inside ml-4">
              <li>Nombre</li>
              <li>Correo electrónico</li>
              <li>Nombre del restaurante</li>
              <li>Ciudad</li>
              <li>Mensajes o consultas enviadas</li>
            </ul>
          </div>

          
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-4">
              2. Uso de la información
            </h2>
            <p className="text-muted leading-relaxed mb-4">
              La información recopilada se utiliza para:
            </p>
            <ul className="space-y-2 text-muted list-disc list-inside ml-4 mb-4">
              <li>Contactar al usuario</li>
              <li>Prestar y mejorar el servicio</li>
              <li>Enviar información relacionada con MenuPro</li>
              <li>Análisis interno y métricas de uso</li>
            </ul>
            <p className="text-muted leading-relaxed font-semibold">
              MenuPro no vende ni arrienda datos personales a terceros.
            </p>
          </div>

          
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-4">
              3. Almacenamiento y seguridad
            </h2>
            <p className="text-muted leading-relaxed mb-4">
              MenuPro adopta medidas razonables para proteger la información personal contra accesos no autorizados, 
              pérdida o divulgación.
            </p>
            <p className="text-muted leading-relaxed">
              Sin embargo, ningún sistema es completamente seguro y no se puede garantizar seguridad absoluta.
            </p>
          </div>

          
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-4">
              4. Cookies y tecnologías similares
            </h2>
            <p className="text-muted leading-relaxed mb-4">
              El sitio puede utilizar cookies u otras tecnologías para:
            </p>
            <ul className="space-y-2 text-muted list-disc list-inside ml-4 mb-4">
              <li>Analizar tráfico</li>
              <li>Mejorar la experiencia del usuario</li>
              <li>Medir conversiones y campañas</li>
            </ul>
            <p className="text-muted leading-relaxed">
              El usuario puede configurar su navegador para rechazar cookies.
            </p>
          </div>

          
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-4">
              5. Servicios de terceros
            </h2>
            <p className="text-muted leading-relaxed mb-4">
              MenuPro puede utilizar servicios de terceros (por ejemplo, analytics, hosting, formularios o mensajería).
            </p>
            <p className="text-muted leading-relaxed">
              Estos servicios gestionan datos bajo sus propias políticas de privacidad.
            </p>
          </div>

          
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-4">
              6. Derechos del usuario
            </h2>
            <p className="text-muted leading-relaxed mb-4">
              El usuario puede solicitar:
            </p>
            <ul className="space-y-2 text-muted list-disc list-inside ml-4 mb-4">
              <li>Acceso a sus datos</li>
              <li>Corrección o eliminación</li>
              <li>Dejar de recibir comunicaciones</li>
            </ul>
            <p className="text-muted leading-relaxed">
              Para ello, puede escribir a: <a href="mailto:contacto@menupro.cl" className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] underline">contacto@menupro.cl</a>
            </p>
          </div>

          
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-4">
              7. Cambios en esta política
            </h2>
            <p className="text-muted leading-relaxed mb-4">
              MenuPro se reserva el derecho de actualizar esta Política de Privacidad.
            </p>
            <p className="text-muted leading-relaxed">
              Los cambios se publicarán en esta página.
            </p>
          </div>

        </div>
      

      
      
        <div className="mt-16 p-8 bg-[var(--color-bg-soft)] rounded-2xl border border-default text-center">
          <h3 className="text-2xl font-bold mb-4">
            ¿Necesitas ejercer tus derechos de privacidad?
          </h3>
          <p className="text-muted mb-6">
            Estamos comprometidos con la protección de tus datos. Contáctanos para cualquier consulta sobre privacidad.
          </p>
          <a
            href="/contacto"
            className="inline-block px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors"
          >
            Contáctanos
          </a>
        </div>
      

    </div>
  </section>
</div></MarketingLayout>; }
