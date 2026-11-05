# Tour guiado y manual de usuario

MenuPro usa Driver.js 1.10.2 (licencia MIT). La librería se importa bajo demanda en el navegador, después de cargar las cartas. Los estilos se cargan con el componente del panel; no requiere servicios externos ni credenciales.

## Recorridos

- Inicio: seis pasos para ubicar la carta, apariencia, publicación, suscripción y ayuda.
- Editor: hasta cinco pasos sobre secciones, platos, vista previa, QR/PDF y publicación. Los pasos sin un elemento disponible se omiten, por ejemplo cuando una carta no tiene secciones.
- Durante una demo activa se ofrece cada recorrido automáticamente una vez. El botón `Ver recorrido guiado` permite repetirlo, también con una suscripción activa.
- El estado está en `localStorage`, separado por usuario, negocio, versión y recorrido. Cerrar, omitir o terminar evita que vuelva a abrirse automáticamente. Otro navegador o borrar los datos del sitio permite verlo de nuevo. No se sincroniza entre dispositivos.
- Si el navegador bloquea el almacenamiento, se usa memoria durante esa visita. Un error al cargar la librería deja disponible el manual y permite reintentar.
- El tour no modifica cartas ni publica contenido. Se puede cerrar con X, Escape o el fondo. Respeta la preferencia de reducir movimiento y devuelve el foco al botón de ayuda.
- No se inicia sobre cartas pendientes de carga o con error, ni para administradores de plataforma o cuentas sin acceso de edición.

Los textos y marcadores `data-tour` están en `GuidedTour.jsx`, `Dashboard.jsx` y `MenuEditor.jsx`. Cambiar la versión de la clave vuelve a ofrecer los recorridos a quienes estén en demo.

## Manual y correo

El PDF público es `/manuales/menupro-guia-rapida.pdf`. También existe una copia entregable en `output/pdf/menupro-guia-rapida.pdf`. Tiene tres páginas A4, enlaces de acceso y contacto, y no contiene datos de usuarios.

El panel ofrece su descarga en Inicio y en el editor. Los correos de la cola de notificaciones incluyen enlaces al PDF y al Inicio del panel, en HTML y texto. Esto cubre la activación de la demo, su aprobación tras revisión y los recordatorios, sin generar un segundo correo. El PDF se enlaza; no se adjunta.

El envío mantiene la cola, frecuencia, configuración e idempotencia existentes. El aviso de activación se procesa en la siguiente ejecución del trabajador; no se añade un envío síncrono al formulario de demo. Los correos de autenticación, invitaciones y boletas mantienen sus plantillas existentes.

Para regenerar el documento con Python y ReportLab:

```sh
python scripts/build-user-manual.py
```

El script actualiza ambas copias. Revisar visualmente sus tres páginas después de cambiar textos o controles de la aplicación. La tipografía Segoe UI se incrusta cuando está disponible; en otros entornos usa Helvetica.

## Validación y publicación

```sh
pnpm typecheck
pnpm test
pnpm exec playwright test --config=playwright.auth.config.ts tests/auth/onboarding.spec.ts
pnpm run build
```

La suite de navegador usa el proveedor de autenticación local y respuestas de prueba. Comprueba la activación, navegación, cierre, repetición, persistencia, aislamiento entre usuarios/negocios, móvil, movimiento reducido, descarga del PDF y errores de carga. No crea cuentas ni envía correos reales.

El cambio requiere desplegar la aplicación y el PDF juntos. No requiere migraciones, cambios en InsForge ni variables de entorno nuevas. El servicio de notificaciones existente debe estar habilitado para enviar los correos de la demo.
