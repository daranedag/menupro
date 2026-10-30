'use client';
import { useState } from 'react';
import { useNavigate } from '@/lib/navigation';
import { useParams } from 'next/navigation';

import { useMenu } from '../../contexts/MenuContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button, Input, Card } from '../../components/ui';
import DashboardLayout from '../../layouts/DashboardLayout';

function SectionForm() {
  const { menuId, sectionId } = useParams();
  const navigate = useNavigate();
  const { menus, createSection, updateSection } = useMenu();
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  
  const menu = menus.find(m => m.id === menuId);
  const isEditing = !!sectionId;
  const existingSection = isEditing 
    ? menu?.sections?.find(s => s.id === sectionId)
    : null;

  const [formData, setFormData] = useState({
    name: existingSection?.name || '',
    icon: existingSection?.icon || '📁',
    description: existingSection?.description || '',
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      if (isEditing) {
        await updateSection(menuId, sectionId, formData);
      } else {
        await createSection(menuId, formData);
      }
      navigate(`/app/dashboard/menus/${menuId}`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!menu) {
    return (
      <DashboardLayout>
        <Card><p className="text-center py-12">Carta no encontrada</p></Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
            {isEditing ? 'Editar Sección' : 'Nueva Sección'}
          </h2>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Sección de: {menu.icon} {menu.name}
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Nombre de la Sección"
              name="name"
              placeholder="Ej: Entradas, Platos Principales, Postres"
              value={formData.name}
              onChange={handleChange}
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Icono / Emoji
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  name="icon"
                  value={formData.icon}
                  onChange={handleChange}
                  className="w-20 px-4 py-2 text-center text-2xl border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  maxLength="2"
                />
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2">
                    {['📁', '🥗', '🍖', '🍰', '☕', '🍹', '🍕', '🍔', '🍜', '🥘'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setFormData({ ...formData, icon: emoji })}
                        className="text-2xl hover:bg-gray-100 p-2 rounded"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción (Opcional)
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="3"
                placeholder="Descripción de la sección"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" variant="primary" size="lg" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : (isEditing ? 'Guardar Cambios' : 'Crear Sección')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => navigate(`/app/dashboard/menus/${menuId}`)}
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

export default SectionForm;
