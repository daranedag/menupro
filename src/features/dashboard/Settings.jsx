'use client';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useTheme, colorPresets, fontPresets } from '../../contexts/ThemeContext';
import { Card, Button, Badge } from '../../components/ui';

function Settings() {
  const { menuTheme: theme, updateColors, updateFont, resetTheme } = useTheme();

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-ink">Configuración</h2>
          <p className="mt-1 text-muted">Personaliza la apariencia de tu menú. Los colores y la tipografía se aplican a tu carta pública.</p>
        </div>

        {/* Paleta de Colores */}
        <Card title="Colores" subtitle="Elige la paleta de colores para tu menú" className="mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(colorPresets).map(([key, colors]) => (
              <button
                key={key}
                aria-pressed={theme.colorPreset === key}
                onClick={() => updateColors(key)}
                className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                  theme.colorPreset === key
                    ? 'border-brand shadow-lg'
                    : 'border-line hover:border-brand'
                }`}
              >
                <div className="flex gap-2 mb-3" aria-hidden="true">
                  <div
                    className="h-8 min-w-0 flex-1 rounded"
                    style={{ backgroundColor: colors.primary }}
                  />
                  <div
                    className="h-8 min-w-0 flex-1 rounded"
                    style={{ backgroundColor: colors.secondary }}
                  />
                  <div
                    className="h-8 min-w-0 flex-1 rounded"
                    style={{ backgroundColor: colors.accent }}
                  />
                </div>
                <div className="font-semibold text-sm capitalize text-ink">{key}</div>
                {theme.colorPreset === key && (
                  <Badge variant="primary" size="sm" className="mt-2">
                    Activo
                  </Badge>
                )}
              </button>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-lg bg-canvas">
            <h4 className="font-semibold mb-3 text-ink">Vista Previa</h4>
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {Object.entries(fontPresets).map(([key, font]) => (
              <button
                key={key}
                aria-pressed={theme.fontPreset === key}
                onClick={() => updateFont(key)}
                className={`w-full min-w-0 break-words p-4 rounded-lg border-2 transition-all text-left hover:shadow-md ${
                  theme.fontPreset === key
                    ? 'border-brand bg-brand-soft'
                    : 'border-line hover:border-brand'
                }`}
              >
                <div className="flex h-full flex-col items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold mb-1 text-ink">{font.name}</div>
                    <div
                      className="text-lg text-ink"
                      style={{ fontFamily: font.fontFamily }}
                    >
                      El sabor de nuestra cocina
                    </div>
                    <div
                      className="text-sm text-muted"
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
