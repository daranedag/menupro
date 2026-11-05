"""Build the public quick-start guide with ReportLab; no account data is used."""
from pathlib import Path
from shutil import copyfile

from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "output/pdf/menupro-guia-rapida.pdf"
PUBLIC = ROOT / "public/manuales/menupro-guia-rapida.pdf"
W, H = A4
M = 46
WIDTH = W - 2 * M
GREEN = HexColor("#234D3C")
INK = HexColor("#20382E")
MUTED = HexColor("#52655A")
PALE = HexColor("#EFF4ED")
LINE = HexColor("#DCE5DA")
AMBER = HexColor("#F4E6BC")

font_dir = Path("C:/Windows/Fonts")
if (font_dir / "segoeui.ttf").exists():
    pdfmetrics.registerFont(TTFont("Guide", str(font_dir / "segoeui.ttf")))
    pdfmetrics.registerFont(TTFont("GuideBold", str(font_dir / "segoeuib.ttf")))
    pdfmetrics.registerFontFamily("Guide", normal="Guide", bold="GuideBold")
    FONT, BOLD = "Guide", "GuideBold"
else:
    FONT, BOLD = "Helvetica", "Helvetica-Bold"

OUT.parent.mkdir(parents=True, exist_ok=True)
PUBLIC.parent.mkdir(parents=True, exist_ok=True)
c = canvas.Canvas(str(OUT), pagesize=A4, pageCompression=1)
c.setTitle("MenuPro | Guía rápida para tu demo")
c.setAuthor("MenuPro")
c.setSubject("Manual de usuario: editar, publicar y compartir la carta digital")
c.setKeywords("MenuPro, manual, demo, carta digital, QR")
c.setViewerPreference("DisplayDocTitle", "true")


def text(value, x, y, size=10.5, color=INK, bold=False):
    c.setFillColor(color)
    c.setFont(BOLD if bold else FONT, size)
    c.drawString(x, y, value)


def para(value, x, y, width=WIDTH, size=10.5, color=INK, leading=16):
    style = ParagraphStyle("body", fontName=FONT, fontSize=size, leading=leading,
                           textColor=color, spaceAfter=0)
    p = Paragraph(value, style)
    _, height = p.wrap(width, 1000)
    p.drawOn(c, x, y - height)
    return y - height


def box(x, top, width, height, color=PALE):
    c.setFillColor(color)
    c.roundRect(x, top - height, width, height, 12, fill=1, stroke=0)


def chrome(page, chapter):
    c.setFillColor(HexColor("#FBFCF9"))
    c.rect(0, 0, W, H, fill=1, stroke=0)
    text("MenuPro", M, H - 43, 20, GREEN, True)
    text("GUÍA RÁPIDA  /  DEMO", W - M - 144, H - 40, 9, MUTED, True)
    c.setStrokeColor(LINE)
    c.line(M, 51, W - M, 51)
    text("menupro.cl", M, 33, 9, GREEN, True)
    c.linkURL("https://www.menupro.cl", (M, 29, M + 67, 45), relative=0)
    text("Noviembre 2026", M + 88, 33, 8, MUTED)
    text(f"{chapter}   /   {page} de 3", W - M - 144, 33, 8.5, MUTED)


def heading(kicker, title, subtitle):
    text(kicker, M, H - 95, 9, GREEN, True)
    text(title, M, H - 134, 30, INK, True)
    return para(subtitle, M, H - 153, size=11.5, color=MUTED, leading=18)


def step(number, title, body, top):
    c.setFillColor(GREEN)
    c.circle(M + 13, top - 12, 13, fill=1, stroke=0)
    text(str(number), M + 9.5, top - 16, 10, white, True)
    text(title, M + 40, top - 16, 14, INK, True)
    bottom = para(body, M + 40, top - 29, WIDTH - 40)
    return bottom - 23


chrome(1, "Comenzar")
c.bookmarkPage("comenzar")
c.addOutlineEntry("1. Comienza tu demo", "comenzar", 0)
y = heading("01  /  COMIENZA AQUÍ", "Tu primera carta digital", "De la demo a una carta lista para tus clientes. Sigue estos pasos a tu ritmo, desde tu computador o teléfono.")
box(M, y - 23, WIDTH, 87, GREEN)
text("15 días para probar MenuPro", M + 20, y - 51, 16, white, True)
para("Sin tarjeta. La demo incluye una carta de ejemplo editable, publicación, código QR y descarga de la carta en PDF.", M + 20, y - 64, WIDTH - 40, 10.5, white)
y -= 138
y = step(1, "Entra y activa tu demo", 'Ingresa en <link href="https://www.menupro.cl/app/login" color="#234D3C"><b>menupro.cl/app/login</b></link>. Completa los datos del restaurante, acepta los términos y pulsa <b>Activar demo gratis</b>. Si aparece una revisión pendiente, espera su aprobación: el plazo aún no comienza.', y)
y = step(2, "Ubícate en el panel", 'En <b>Inicio</b>, abre <b>Ver recorrido guiado</b> para conocer los controles. La guía aparece la primera vez durante tu demo y puedes cerrarla con la X o Escape. En el editor encontrarás un segundo recorrido.', y)
text("DÓNDE ENCONTRAR CADA COSA", M, y - 5, 9, GREEN, True)
rows = [
    ("Mis cartas", "Crear, editar y publicar tus cartas."),
    ("Apariencia", "Elegir los colores y la tipografía del restaurante."),
    ("Mi negocio", "Consultar el negocio y gestionar el equipo según tu rol."),
    ("Suscripción", "Revisar las fechas de tu demo y las opciones para continuar."),
]
y -= 21
for label, desc in rows:
    c.setStrokeColor(LINE)
    c.line(M, y - 35, W - M, y - 35)
    text(label, M, y - 15, 11, INK, True)
    para(desc, M + 112, y - 3, WIDTH - 112, 10, MUTED, 15)
    y -= 43
box(M, y - 8, WIDTH, 58, AMBER)
para('<b>En el teléfono:</b> toca <b>Abrir menú</b> en la parte superior para ver las secciones del panel. Si tienes varios locales, revisa cuál está seleccionado antes de editar.', M + 15, y - 20, WIDTH - 30, 10, leading=15)
c.showPage()

chrome(2, "Preparar")
c.bookmarkPage("preparar")
c.addOutlineEntry("2. Prepara tu carta", "preparar", 0)
y = heading("02  /  HAZLA TUYA", "Platos, precios y estilo", "Empieza con la carta de ejemplo. No necesitas cargar imágenes para publicar una carta clara y completa.")
y = step(3, "Abre la carta de ejemplo", 'Desde <b>Inicio</b>, pulsa <b>Editar mi carta</b>. También puedes entrar a <b>Mis cartas</b> y elegir <b>Editar</b>. Para empezar desde cero, usa <b>Nueva carta</b>, completa su nombre y pulsa <b>Crear Carta</b>.', y - 26)
y = step(4, "Organiza secciones y platos", 'En el editor, pulsa <b>Nueva Sección</b> para crear categorías como Entradas, Fondos o Bebidas. Dentro de una sección, usa <b>Plato</b> para agregar uno. Arrastra los controles junto a secciones o platos para cambiar su orden.', y)
y = step(5, "Actualiza la ficha de cada plato", 'Pulsa el <b>lápiz</b> junto al plato. Revisa <b>Nombre del Plato</b>, <b>Precio</b> y <b>Descripción Corta</b>. Puedes añadir descuento, etiquetas y una URL de imagen. Termina con <b>Guardar Cambios</b> o <b>Crear Plato</b>.', y)
box(M + 40, y + 7, WIDTH - 40, 74)
text("UN EJEMPLO SENCILLO", M + 56, y - 12, 8, GREEN, True)
text("Limonada de la casa", M + 56, y - 34, 13, INK, True)
text("$3.500", W - M - 70, y - 34, 12, GREEN, True)
text("Limón natural, menta y hielo.", M + 56, y - 54, 10, MUTED)
y -= 88
y = step(6, "Elige el aspecto de tu carta", 'Abre <b>Apariencia</b>, elige colores y tipografía y pulsa <b>Guardar apariencia del restaurante</b>. Vuelve al editor para revisar <b>Vista Previa</b> y la vista de teléfono.', y)
box(M, y + 3, WIDTH, 76, AMBER)
para('<b>Antes de seguir:</b> revisa los precios y las descripciones de ejemplo. Para un plato agotado, usa el botón de activación junto al plato. Evita eliminar contenido que quieras recuperar más adelante.', M + 16, y - 12, WIDTH - 32, 10, leading=16)
para('La biblioteca de imágenes conectada es opcional y requiere una suscripción pagada vigente. Durante la demo puedes usar una URL de imagen en la ficha del plato.', M, y - 92, size=9, color=MUTED, leading=14)
c.showPage()

chrome(3, "Compartir")
c.bookmarkPage("compartir")
c.addOutlineEntry("3. Publica y comparte", "compartir", 0)
y = heading("03  /  PONLA EN MARCHA", "Publica y comparte", "Haz una última revisión y prueba la carta como la verá un cliente antes de imprimir tu código QR.")
y = step(7, "Publica desde Mis cartas", 'Vuelve a <b>Mis cartas</b> y pulsa <b>Publicar</b> en tu carta. Comprueba que esté <b>activa</b> y <b>visible</b>, y que las secciones y los platos que deseas mostrar estén activos.', y - 25)
y = step(8, "Comparte el enlace y el QR", 'Entra a <b>Editar</b> y pulsa <b>Generar QR</b>. Usa <b>Copiar</b> para compartir el enlace o <b>Descargar QR</b> para guardar la imagen. Abre el enlace sin iniciar sesión y escanea el QR con otro teléfono antes de imprimirlo.', y)
y = step(9, "Descarga una copia de tu carta", 'En el editor, pulsa <b>Descargar PDF</b>. El archivo conserva los datos del momento de la descarga: vuelve a generarlo y enviarlo si cambias los platos o precios.', y)
box(M, y + 5, WIDTH, 77, GREEN)
text("Una comprobación que vale la pena", M + 18, y - 21, 14, white, True)
para("¿Abre el QR sin iniciar sesión? ¿Se ven los precios correctos? ¿Aparecen solo los platos disponibles? Si todo está bien, tu carta está lista para compartir.", M + 18, y - 33, WIDTH - 36, 10.5, white, 16)
y -= 98
text("SI NECESITAS AYUDA", M, y, 9, GREEN, True)
y -= 17
for title, body in [
    ("El QR no abre la carta", "Revisa que esté publicada, activa y visible, y que tu demo o suscripción tenga acceso vigente."),
    ("No puedo editar", "Confirma tu acceso y el restaurante seleccionado. Algunas acciones dependen del rol que te asignó el propietario."),
    ("¿Qué pasa al terminar la demo?", "Consulta Suscripción para ver fechas y planes. La demo no genera cobros automáticos. Al vencer el acceso, la carta deja de estar disponible al público."),
]:
    text(title, M, y - 12, 11, INK, True)
    y = para(body, M, y - 21, size=10, color=MUTED, leading=15) - 14
para('Repite <b>Ver recorrido guiado</b> desde Inicio o el editor. Para contactarnos, visita <link href="https://www.menupro.cl/contacto" color="#234D3C"><b>menupro.cl/contacto</b></link>.', M, y - 2, size=10, leading=16)
c.save()
copyfile(OUT, PUBLIC)
print(f"Created {OUT} ({OUT.stat().st_size:,} bytes); copied to public/manuales.")
