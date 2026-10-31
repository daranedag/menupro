import MarketingLayout from '@/components/MarketingLayout';
import CommercialTerms from '@/components/business/CommercialTerms';
export const metadata = { title: "Términos de uso" };
export default function Page() { return <MarketingLayout><div className="legacy-content">
  
  <section className="relative pt-24 pb-16 bg-[var(--color-bg-soft)]">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      
        <h1 className="text-4xl sm:text-5xl font-bold mb-6">
          Términos de Uso
        </h1>
        <p className="text-xl text-muted">
          Última actualización: 31 de octubre de 2026
        </p>
      
    </div>
  </section>

  
  <section className="py-16">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      
      
        <div className="mb-12">
          
          
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-4">
              1. Aceptación de los términos
            </h2>
            <p className="text-muted leading-relaxed">
              Al acceder y utilizar el sitio web y los servicios de MenuPro, usted acepta cumplir estos Términos de Uso.
              Si no está de acuerdo con alguno de ellos, le recomendamos no utilizar nuestros servicios.
            </p>
          </div>

          
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-4">
              2. Descripción del servicio
            </h2>
            <p className="text-muted leading-relaxed mb-4">
              MenuPro es una plataforma digital que permite a restaurantes crear, administrar y publicar cartas digitales 
              accesibles mediante códigos QR u otros medios digitales.
            </p>
            <p className="text-muted leading-relaxed">
              MenuPro se reserva el derecho de modificar, actualizar o descontinuar partes del servicio en cualquier momento.
            </p>
          </div>

          
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-4">
              3. Uso permitido
            </h2>
            <p className="text-muted leading-relaxed mb-4">
              El usuario se compromete a utilizar MenuPro únicamente para fines legales y relacionados con la gestión 
              de su negocio gastronómico.
            </p>
            <p className="text-muted font-semibold mb-3">
              Queda prohibido:
            </p>
            <ul className="space-y-2 text-muted list-disc list-inside ml-4">
              <li>Usar el servicio para actividades ilícitas</li>
              <li>Publicar contenido ofensivo, engañoso o fraudulento</li>
              <li>Intentar acceder sin autorización a sistemas o datos</li>
              <li>Copiar, revender o explotar el servicio sin autorización</li>
            </ul>
          </div>

          
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-4">
              4. Responsabilidad del contenido
            </h2>
            <p className="text-muted leading-relaxed mb-4">
              El usuario es único responsable del contenido que cargue en su carta digital (precios, descripciones, 
              imágenes, alérgenos, etc.).
            </p>
            <p className="text-muted font-semibold mb-3">
              MenuPro no se hace responsable por:
            </p>
            <ul className="space-y-2 text-muted list-disc list-inside ml-4">
              <li>Errores en precios o información</li>
              <li>Incumplimientos normativos del restaurante</li>
              <li>Daños derivados del uso incorrecto del servicio</li>
            </ul>
          </div>

          
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-4">
              5. Disponibilidad del servicio
            </h2>
            <p className="text-muted leading-relaxed mb-4">
              MenuPro busca mantener el servicio disponible de forma continua, pero no garantiza disponibilidad ininterrumpida.
            </p>
            <p className="text-muted leading-relaxed">
              Pueden existir interrupciones por mantenimiento, mejoras o causas externas.
            </p>
          </div>

          
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-4">
              6. Propiedad intelectual
            </h2>
            <p className="text-muted leading-relaxed mb-4">
              Todo el contenido del sitio (marca, logotipo, diseño, textos, código) es propiedad de MenuPro o se 
              utiliza con licencia.
            </p>
            <p className="text-muted leading-relaxed">
              El usuario conserva la propiedad de su contenido, pero otorga a MenuPro una licencia limitada para 
              mostrarlo dentro de la plataforma.
            </p>
          </div>

          
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-4">
              7. Modificaciones
            </h2>
            <p className="text-muted leading-relaxed mb-4">
              MenuPro puede modificar estos Términos de Uso en cualquier momento.
            </p>
            <p className="text-muted leading-relaxed">
              Las modificaciones serán efectivas desde su publicación en el sitio web.
            </p>
          </div>

          
          <div className="mb-10">
            <h2 className="text-2xl font-bold mb-4">
              8. Legislación aplicable
            </h2>
            <p className="text-muted leading-relaxed">
              Estos términos se rigen por las leyes vigentes de la <strong>República de Chile</strong>.
            </p>
          </div>

        </div>
      

      
      
        <div className="mt-16 p-8 bg-[var(--color-bg-soft)] rounded-2xl border border-default text-center">
          <h3 className="text-2xl font-bold mb-4">
            ¿Tienes dudas sobre estos términos?
          </h3>
          <p className="text-muted mb-6">
            Nuestro equipo está disponible para aclarar cualquier consulta legal sobre el uso de MenuPro.
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
  <CommercialTerms />
</div></MarketingLayout>; }
