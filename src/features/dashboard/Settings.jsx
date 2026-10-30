'use client';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useTheme, colorPresets, fontPresets } from '../../contexts/ThemeContext';
import { Card, Button, Badge } from '../../components/ui';

function Settings() {
  const { theme, updateColors, updateFont, toggleMode, resetTheme } = useTheme();
  const isDark = theme.mode === 'dark';

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Configuración</h2>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Personaliza la apariencia de tu menú</p>
        </div>

        {/* Modo Claro/Oscuro */}
        <Card title="Tema" subtitle="Modo claro u oscuro" className="mb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <button
              onClick={() => toggleMode()}
              className={`flex-1 flex items-center gap-3 px-6 py-4 rounded-lg border-2 transition-all ${
                theme.mode === 'light'
                  ? 'border-blue-500 bg-blue-50'
                  : isDark 
                    ? 'border-gray-600 hover:border-gray-500 bg-gray-800' 
                    : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <span className="text-3xl">☀️</span>
              <div className="text-left">
                <div className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Modo Claro</div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Fondo blanco</div>
              </div>
            </button>

            <button
              onClick={() => toggleMode()}
              className={`flex-1 flex items-center gap-3 px-6 py-4 rounded-lg border-2 transition-all ${
                theme.mode === 'dark'
                  ? 'border-blue-500 bg-blue-900'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <span className="text-3xl">🌙</span>
              <div className="text-left">
                <div className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Modo Oscuro</div>
                <div className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Fondo oscuro</div>
              </div>
            </button>
          </div>
        </Card>

        {/* Paleta de Colores */}
        <Card title="Colores" subtitle="Elige la paleta de colores para tu menú" className="mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(colorPresets).map(([key, colors]) => (
              <button
                key={key}
                onClick={() => updateColors(key)}
                className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                  theme.colorPreset === key
                    ? 'border-blue-500 shadow-lg'
                    : isDark 
                      ? 'border-gray-600 hover:border-gray-500' 
                      : 'border-gray-200'
                }`}
              >
                <div className="flex gap-2 mb-3">
                  <div
                    className="w-8 h-8 rounded"
                    style={{ backgroundColor: colors.primary }}
                  />
                  <div
                    className="w-8 h-8 rounded"
                    style={{ backgroundColor: colors.secondary }}
                  />
                  <div
                    className="w-8 h-8 rounded"
                    style={{ backgroundColor: colors.accent }}
                  />
                </div>
                <div className={`font-semibold text-sm capitalize ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{key}</div>
                {theme.colorPreset === key && (
                  <Badge variant="primary" size="sm" className="mt-2">
                    Activo
                  </Badge>
                )}
              </button>
            ))}
          </div>

          <div className={`mt-6 p-4 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <h4 className={`font-semibold mb-3 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>Vista Previa</h4>
            <div className="flex flex-wrap gap-3">
              <button
                className="px-4 py-2 rounded-lg text-white font-medium"
                style={{ backgroundColor: theme.colors.primary }}
              >
                Color Primario
              </button>
              <button
                className="px-4 py-2 rounded-lg text-white font-medium"
                style={{ backgroundColor: theme.colors.secondary }}
              >
                Color Secundario
              </button>
              <button
                className="px-4 py-2 rounded-lg text-white font-medium"
                style={{ backgroundColor: theme.colors.accent }}
              >
                Color Acento
              </button>
            </div>
          </div>
        </Card>

        {/* Tipografía */}
        <Card title="Tipografía" subtitle="Elige la fuente para tu menú" className="mb-6">
          <div className="space-y-3">
            {Object.entries(fontPresets).map(([key, font]) => (
              <button
                key={key}
                onClick={() => updateFont(key)}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left hover:shadow-md ${
                  theme.fontPreset === key
                    ? isDark 
                      ? 'border-blue-500 bg-blue-900' 
                      : 'border-blue-500 bg-blue-50'
                    : isDark 
                      ? 'border-gray-600 hover:border-gray-500' 
                      : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`font-semibold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{font.name}</div>
                    <div
                      className={`text-lg ${isDark ? 'text-gray-300' : 'text-gray-800'}`}
                      style={{ fontFamily: font.fontFamily }}
                    >
                      The quick brown fox jumps over the lazy dog
                    </div>
                    <div
                      className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                      style={{ fontFamily: font.fontFamily }}
                    >
                      1234567890 - ¡Hola! ¿Cómo estás?
                    </div>
                  </div>
                  {theme.fontPreset === key && (
                    <Badge variant="primary">Activa</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Vista Previa del Menú */}
        <Card title="Vista Previa" className="mb-6">
          <div
            className="p-6 rounded-lg"
            style={{
              backgroundColor: theme.mode === 'dark' ? '#1f2937' : '#ffffff',
              color: theme.mode === 'dark' ? '#ffffff' : '#000000',
              fontFamily: theme.font.fontFamily,
            }}
          >
            <h3
              className="text-2xl font-bold mb-4"
              style={{ color: theme.colors.primary }}
            >
              Nombre del Restaurante
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded border">
                <div>
                  <h4 className="font-semibold mb-1">Pizza Margarita</h4>
                  <p className="text-sm opacity-75">
                    Tomate, mozzarella, albahaca fresca
                  </p>
                </div>
                <span
                  className="text-xl font-bold"
                  style={{ color: theme.colors.accent }}
                >
                  $12.99
                </span>
              </div>
              <div className="flex items-center justify-between p-4 rounded border">
                <div>
                  <h4 className="font-semibold mb-1">Hamburguesa Clásica</h4>
                  <p className="text-sm opacity-75">
                    Carne, lechuga, tomate, queso cheddar
                  </p>
                </div>
                <span
                  className="text-xl font-bold"
                  style={{ color: theme.colors.accent }}
                >
                  $15.99
                </span>
              </div>
            </div>
            <button
              className="mt-6 w-full py-3 rounded-lg text-white font-semibold"
              style={{ backgroundColor: theme.colors.secondary }}
            >
              Ver Menú Completo
            </button>
          </div>
        </Card>

        {/* Acciones */}
        <div className="flex gap-3">
          <Button variant="danger" onClick={resetTheme}>
            Restaurar Valores Predeterminados
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default Settings;
