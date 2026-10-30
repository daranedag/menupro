import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  es: {
    translation: {
      // Navigation
      "nav.menu": "Menú",
      "nav.login": "Iniciar Sesión",
      "nav.dashboard": "Dashboard",
      "nav.logout": "Cerrar Sesión",
      
      // Auth
      "auth.login": "Iniciar Sesión",
      "auth.register": "Registrarse",
      "auth.email": "Correo Electrónico",
      "auth.password": "Contraseña",
      "auth.name": "Nombre",
      "auth.restaurantName": "Nombre del Restaurante",
      "auth.noAccount": "¿No tienes cuenta?",
      "auth.hasAccount": "¿Ya tienes cuenta?",
      
      // Dashboard
      "dashboard.welcome": "Bienvenido",
      "dashboard.menus": "Mis Cartas",
      "dashboard.settings": "Configuración",
      "dashboard.newMenu": "Nueva Carta",
      "dashboard.editMenu": "Editar Carta",
      "dashboard.deleteMenu": "Eliminar Carta",
      
      // Menu
      "menu.sections": "Secciones",
      "menu.dishes": "Platos",
      "menu.newSection": "Nueva Sección",
      "menu.newDish": "Nuevo Plato",
      "menu.name": "Nombre",
      "menu.description": "Descripción",
      "menu.price": "Precio",
      "menu.discount": "Descuento",
      "menu.image": "Imagen",
      "menu.active": "Activo",
      "menu.inactive": "Inactivo",
      
      // Actions
      "action.save": "Guardar",
      "action.cancel": "Cancelar",
      "action.edit": "Editar",
      "action.delete": "Eliminar",
      "action.create": "Crear",
      "action.close": "Cerrar",
      "action.download": "Descargar",
      "action.copy": "Copiar",
      "action.preview": "Vista Previa",
      
      // Settings
      "settings.theme": "Tema",
      "settings.colors": "Colores",
      "settings.fonts": "Tipografía",
      "settings.darkMode": "Modo Oscuro",
      "settings.language": "Idioma",
      
      // PDF & QR
      "pdf.download": "Descargar PDF",
      "pdf.generating": "Generando PDF...",
      "qr.generate": "Generar QR",
      "qr.download": "Descargar QR",
      "qr.title": "Código QR del Menú",
      "qr.scan": "Escanea este código QR para acceder al menú digital",
      "qr.link": "Link del menú",
      "qr.copied": "¡Link copiado al portapapeles!",
      
      // Mobile Preview
      "preview.mobile": "Preview Móvil",
      "preview.title": "Vista Previa Móvil",
      
      // Messages
      "msg.noMenus": "No hay cartas",
      "msg.noSections": "No hay secciones",
      "msg.noDishes": "No hay platos",
      "msg.createFirst": "Crea tu primera",
      "msg.loading": "Cargando...",
      "msg.error": "Error",
      "msg.success": "Éxito",
    }
  },
  en: {
    translation: {
      // Navigation
      "nav.menu": "Menu",
      "nav.login": "Login",
      "nav.dashboard": "Dashboard",
      "nav.logout": "Logout",
      
      // Auth
      "auth.login": "Login",
      "auth.register": "Register",
      "auth.email": "Email",
      "auth.password": "Password",
      "auth.name": "Name",
      "auth.restaurantName": "Restaurant Name",
      "auth.noAccount": "Don't have an account?",
      "auth.hasAccount": "Already have an account?",
      
      // Dashboard
      "dashboard.welcome": "Welcome",
      "dashboard.menus": "My Menus",
      "dashboard.settings": "Settings",
      "dashboard.newMenu": "New Menu",
      "dashboard.editMenu": "Edit Menu",
      "dashboard.deleteMenu": "Delete Menu",
      
      // Menu
      "menu.sections": "Sections",
      "menu.dishes": "Dishes",
      "menu.newSection": "New Section",
      "menu.newDish": "New Dish",
      "menu.name": "Name",
      "menu.description": "Description",
      "menu.price": "Price",
      "menu.discount": "Discount",
      "menu.image": "Image",
      "menu.active": "Active",
      "menu.inactive": "Inactive",
      
      // Actions
      "action.save": "Save",
      "action.cancel": "Cancel",
      "action.edit": "Edit",
      "action.delete": "Delete",
      "action.create": "Create",
      "action.close": "Close",
      "action.download": "Download",
      "action.copy": "Copy",
      "action.preview": "Preview",
      
      // Settings
      "settings.theme": "Theme",
      "settings.colors": "Colors",
      "settings.fonts": "Typography",
      "settings.darkMode": "Dark Mode",
      "settings.language": "Language",
      
      // PDF & QR
      "pdf.download": "Download PDF",
      "pdf.generating": "Generating PDF...",
      "qr.generate": "Generate QR",
      "qr.download": "Download QR",
      "qr.title": "Menu QR Code",
      "qr.scan": "Scan this QR code to access the digital menu",
      "qr.link": "Menu link",
      "qr.copied": "Link copied to clipboard!",
      
      // Mobile Preview
      "preview.mobile": "Mobile Preview",
      "preview.title": "Mobile Preview",
      
      // Messages
      "msg.noMenus": "No menus",
      "msg.noSections": "No sections",
      "msg.noDishes": "No dishes",
      "msg.createFirst": "Create your first",
      "msg.loading": "Loading...",
      "msg.error": "Error",
      "msg.success": "Success",
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'es',
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
