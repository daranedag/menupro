'use client';
import { useState } from 'react';
import { useNavigate } from '@/lib/navigation';
import { useParams } from 'next/navigation';

import { useMenu } from '../../contexts/MenuContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button, Input, Card } from '../../components/ui';
import DashboardLayout from '../../layouts/DashboardLayout';

function MenuForm() {
  const { menuId } = useParams();
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { menus, createMenu, updateMenu } = useMenu();
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  
  const isEditing = !!menuId;
  const existingMenu = isEditing ? menus.find(m => m.id === menuId) : null;

  const [formData, setFormData] = useState({
    name: existingMenu?.name || '',
    icon: existingMenu?.icon || '🍽️',
    description: existingMenu?.description || '',
    showCallToAction: existingMenu?.showCallToAction ?? true,
    ctaTitle: existingMenu?.ctaTitle || '¿Te gustó nuestro menú?',
    ctaDescription: existingMenu?.ctaDescription || 'Reserva tu mesa o haz tu pedido ahora',
    phoneNumber: existingMenu?.phoneNumber || '',
    deliveryUrl: existingMenu?.deliveryUrl || '',
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleCheckboxChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.checked,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
    if (isEditing) {
      await updateMenu(menuId, formData);
    } else {
      const created = await createMenu(formData);
      if (created?.id) {
        navigate(`/app/dashboard/menus/${created.id}`);
        return;
      }
    }

    navigate('/app/dashboard/menus');
    } catch { /* The shared provider displays the save error. */ }
    finally { setSaving(false); }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-ink'}`}>
            {isEditing ? 'Editar Carta' : 'Nueva Carta'}
          </h2>
          <p className={`mt-1 ${isDark ? 'text-muted' : 'text-muted'}`}>
            {isEditing ? 'Actualiza la información de tu carta' : 'Crea una nueva carta para tu menú'}
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Nombre de la Carta"
              name="name"
              placeholder="Ej: Desayuno, Almuerzo, Bebidas"
              value={formData.name}
              onChange={handleChange}
              required
              helperText="Nombre descriptivo de la carta"
            />

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-muted' : 'text-ink'}`}>
                Icono / Emoji
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="icon"
                  value={formData.icon}
                  onChange={handleChange}
                  className={`w-20 px-4 py-2 text-center text-2xl border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent ${
                    isDark ? 'bg-elevated border-line text-white' : 'bg-surface border-line text-ink'
                  }`}
                  maxLength="2"
                />
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2">
                    {['🍽️', '🌅', '🍹', '☕', '🍕', '🍔', '🥗', '🍰', '🍷', '🍜'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon: emoji })}
                        className={`text-2xl p-2 rounded transition-colors ${
                          isDark ? 'hover:bg-elevated' : 'hover:bg-canvas'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className={`text-sm mt-1 ${isDark ? 'text-muted' : 'text-muted'}`}>Selecciona un emoji o escribe uno</p>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-muted' : 'text-ink'}`}>
                Descripción (Opcional)
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                placeholder="Ej: 6:00 AM - 11:00 AM, Disponible todo el día"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent ${
                  isDark ? 'bg-elevated border-line text-white placeholder-muted' : 'bg-surface border-line text-ink placeholder-muted'
                }`}
              />
              <p className={`text-sm mt-1 ${isDark ? 'text-muted' : 'text-muted'}`}>
                Información adicional como horarios o disponibilidad
              </p>
            </div>

            {/* Call to Action Settings */}
            <div className={`border-t pt-6 ${isDark ? 'border-line' : 'border-line'}`}>
              <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-white' : 'text-ink'}`}>
                Llamado a la Acción (CTA)
              </h3>
              
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="showCallToAction"
                    checked={formData.showCallToAction}
                    onChange={handleCheckboxChange}
                    className="w-4 h-4 text-brand rounded"
                  />
                  <span className={`text-sm font-medium ${
                    isDark ? 'text-muted' : 'text-ink'
                  }`}>
                    Mostrar sección de contacto en el menú público
                  </span>
                </label>
                <p className={`text-sm mt-1 ml-6 ${
                  isDark ? 'text-muted' : 'text-muted'
                }`}>
                  Incluye botones de llamada y delivery al final del menú
                </p>
              </div>

              {formData.showCallToAction && (
                <div className="space-y-4 ml-6 pl-4 border-l-2 border-brand">
                  <Input
                    label="Título del CTA"
                    name="ctaTitle"
                    placeholder="¿Te gustó nuestro menú?"
                    value={formData.ctaTitle}
                    onChange={handleChange}
                  />

                  <Input
                    label="Descripción del CTA"
                    name="ctaDescription"
                    placeholder="Reserva tu mesa o haz tu pedido ahora"
                    value={formData.ctaDescription}
                    onChange={handleChange}
                  />

                  <Input
                    label="Número de Teléfono"
                    name="phoneNumber"
                    type="tel"
                    placeholder="+1234567890"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    helperText="Formato: +código país y número sin espacios"
                  />

                  <Input
                    label="URL de Delivery"
                    name="deliveryUrl"
                    type="url"
                    placeholder="https://delivery.com/tu-restaurante"
                    value={formData.deliveryUrl}
                    onChange={handleChange}
                    helperText="Link a tu plataforma de delivery (Uber Eats, Rappi, etc.)"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" variant="primary" size="lg" disabled={saving}>
                {isEditing ? 'Guardar Cambios' : 'Crear Carta'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => navigate('/app/dashboard/menus')}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default MenuForm;
