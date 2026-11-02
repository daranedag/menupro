# Biblioteca opcional de imágenes

Cada negocio puede conectar una biblioteca desde **Imágenes** en el panel. No se
exige conexión ni foto para crear, editar o publicar platos. La conexión y la
selección de nuevas imágenes requieren un período pagado vigente y un pago
aprobado sin devolución total. La prueba, cortesía y período de gracia no habilitan
esta función. Cancelar la renovación conserva la función hasta finalizar el
período pagado. Propietarios y encargados configuran la conexión; los editores
pueden elegir imágenes.

## ImageKit

Configurar la dirección pública de entrega, una carpeta opcional (`/` por defecto)
y una clave privada restringida a lectura de medios. Se prueba el acceso antes
de guardar. El catálogo consulta 48 archivos por página y permite filtrar por
nombre en la página actual. Solo se ofrecen imágenes públicas con enlaces
permanentes dentro de la dirección conectada. Los archivos privados y los enlaces
firmados que caducan requieren otra estrategia y no se admiten en esta etapa.

Referencia oficial: [claves y permisos](https://imagekit.io/docs/api-keys) y
[listado de archivos](https://imagekit.io/docs/api-reference/digital-asset-management-dam/list-and-search-assets).

## Otros servidores

La opción de servidor público admite un prefijo HTTPS de Cloudinary, S3 o un CDN
propio. Desde el plato se ingresa una ruta relativa o un enlace dentro de ese
prefijo. Estos servicios no tienen exploración automática en esta versión.
MenuPro no consulta URLs arbitrarias desde su servidor, ni sube, modifica o
elimina archivos en las cuentas externas.

## Configuración y permisos

Definir `MENUPRO_IMAGE_ENCRYPTION_KEY` en la configuración privada del servidor:
32 bytes aleatorios expresados como 64 caracteres hexadecimales. Conservar una
copia segura: cambiarla sin recifrar las claves existentes obliga a reconectar
ImageKit. La misma clave debe estar disponible en todas las instancias del
servidor. No usar un prefijo `NEXT_PUBLIC_`. Las claves de clientes se guardan
cifradas con AES-256-GCM y vinculadas al negocio; la API del panel nunca las
devuelve. Las llamadas a ImageKit solo usan su dominio API fijo.

Aplicar la migración con `pnpm db:migrate`. Las tablas y funciones tienen el
prefijo `menupro_`. RLS y las funciones comprueban la pertenencia al negocio y el
derecho de acceso, también cuando se llama directamente al backend.

Desconectar borra la conexión y la clave cifrada, pero conserva las imágenes
asignadas. Cambiar servidor no reescribe enlaces de platos anteriores. Las URLs
manuales que ya ofrecía el editor siguen disponibles como hasta ahora.

## Futuro almacenamiento de MenuPro

`menupro_image_assets` conserva un identificador estable, negocio, origen,
`original_url`, `url`, `storage_provider` y `storage_key`. Los platos enlazan el
activo mediante `image_asset_id` y conservan `image_url` para la carta pública.
Esto permite una migración posterior por activo: copiar y verificar el archivo,
guardar URL y key de MenuPro, actualizar el activo y los enlaces de todos sus
platos en una transacción. Mantener el enlace externo hasta verificar la copia.
La herramienta de transferencia y la gestión de archivos propios quedan para
esa siguiente etapa; esta versión no copia ni cobra almacenamiento.
