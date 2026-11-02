# Identidad de MenuPro

Carta digital para restaurantes independientes de Chile. Su trabajo principal es mantener platos y precios al día y compartirlos desde un QR estable.

## Sistema

- Verde botella #234D3C: marca y acciones principales.
- Blanco #FFFFFF: superficie de lectura y trabajo.
- Verde suave #EFF5F0: secciones y navegación.
- Tinta #20382E: texto principal.
- Gris #617168: texto secundario.
- Amarillo mantel #F2D675: escenario de la carta de ejemplo, sin extenderlo al panel.
- Bricolage Grotesque: títulos y marca, con formas amables de rótulo de local.
- DM Sans: navegación, formularios y lectura. Fuentes de sistema como alternativa.

## Composición y revisión

Se comparó una portada centrada con teléfono flotante y una composición que permite recorrer la carta directamente. Se eligió la segunda: muestra el producto, permite cambiar secciones y evita repetir el teléfono sobre un halo de color. La ilustración de platos usa CSS y no requiere fotos externas ni recursos nuevos.

```text
Landing                         Panel
+-------------------------+    +--------+-----------------------+
| Marca    Enlaces Acceso  |    | Marca  | Local activo   Tema   |
|                         |    |        +-----------------------+
| Mensaje      Carta      |    | Inicio | Título       Acción   |
| Acciones     navegable  |    | Cartas | Resumen / contenido   |
|                         |    | Equipo |                       |
+-------------------------+    | Ajustes| Área de trabajo       |
| Locales y capacidades   |    |        |                       |
| Pasos y prueba gratuita |    +--------+-----------------------+
+-------------------------+
```

Alineación izquierda para mensajes y trabajo; centrado reservado al nombre del restaurante. La carta de ejemplo es el gesto memorable. El resto usa espacios generosos, iconos consistentes, bordes funcionales y jerarquía de acciones. En móvil, una sola columna y navegación desplegable. El modo oscuro conserva los tonos actuales para mantener continuidad con la preferencia guardada.

La revisión eliminó tarjetas de problemas repetitivas, promesas genéricas y animaciones al pasar el cursor. No se introducen estadísticas, testimonios ni fotografías de restaurantes ficticios. Casa Oliva se identifica explícitamente como ejemplo.
