'use client';
import { useState } from 'react';
import { useNavigate } from '@/lib/navigation';
import { useParams } from 'next/navigation';

import { useMenu } from '../../contexts/MenuContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button, Input, Card, Badge } from '../../components/ui';
import DashboardLayout from '../../layouts/DashboardLayout';

function DishForm() {
  const { menuId, sectionId, dishId } = useParams();
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { menus, createDish, updateDish } = useMenu();
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  
  const menu = menus.find(m => m.id === menuId);
  const section = menu?.sections?.find(s => s.id === sectionId);
  const isEditing = !!dishId;
  const existingDish = isEditing 
    ? section?.items?.find(d => d.id === dishId)
    : null;

  const [formData, setFormData] = useState({
    name: existingDish?.name || '',
    description: existingDish?.description || '',
    longDescription: existingDish?.longDescription || '',
    price: existingDish?.price || '',
    discount: existingDish?.discount || 0,
    image: existingDish?.image || '',
    calories: existingDish?.calories || '',
    prepTime: existingDish?.prepTime || '',
    isVegetarian: existingDish?.isVegetarian || false,
    isSpicy: existingDish?.isSpicy || false,
    tags: existingDish?.tags || [],
  });

  const [newTag, setNewTag] = useState({ label: '', variant: 'default' });

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  const handleAddTag = () => {
    if (newTag.label.trim()) {
      setFormData({
        ...formData,
        tags: [...formData.tags, { ...newTag }],
      });
      setNewTag({ label: '', variant: 'default' });
    }
  };

  const handleRemoveTag = (index) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
    
    const dishData = {
      ...formData,
      price: parseFloat(formData.price) || 0,
      discount: parseInt(formData.discount) || 0,
      calories: formData.calories ? parseInt(formData.calories) : null,
      prepTime: formData.prepTime ? parseInt(formData.prepTime) : null,
    };
    
    if (isEditing) {
      await updateDish(menuId, sectionId, dishId, dishData);
    } else {
      await createDish(menuId, sectionId, dishData);
    }
    
    navigate(`/app/dashboard/menus/${menuId}`);
    } catch { /* The shared provider displays the save error. */ }
    finally { setSaving(false); }
  };

  if (!menu || !section) {
    return (
      <DashboardLayout>
        <Card><p className="text-center py-12">Sección no encontrada</p></Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
            {isEditing ? 'Editar Plato' : 'Nuevo Plato'}
          </h2>
          <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {menu.icon} {menu.name} → {section.icon} {section.name}
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Nombre del Plato"
                name="name"
                placeholder="Ej: Pizza Margarita"
                value={formData.name}
                onChange={handleChange}
                required
                fullWidth
              />

              <Input
                label="Precio"
                name="price"
                type="number"
                step="0.01"
                placeholder="12.99"
                value={formData.price}
                onChange={handleChange}
                required
                fullWidth
                icon="$"
              />
            </div>

            <Input
              label="Descripción Corta"
              name="description"
              placeholder="Descripción breve del plato"
              value={formData.description}
              onChange={handleChange}
              required
              helperText="Se muestra en todas las vistas"
            />

            <div>
              <label className={`block text-sm font-semibold tracking-tight mb-2 ${
                isDark ? 'text-gray-100' : 'text-slate-800'
              }`}>
                Descripción Larga (Opcional)
              </label>
              <textarea
                name="longDescription"
                value={formData.longDescription}
                onChange={handleChange}
                rows="3"
                placeholder="Descripción detallada del plato, ingredientes, preparación"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                }`}
              />
              <p className={`text-sm mt-1 ${
                isDark ? 'text-gray-300' : 'text-slate-600'
              }`}>Se muestra solo en desktop</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Descuento %"
                name="discount"
                type="number"
                min="0"
                max="100"
                placeholder="0"
                value={formData.discount}
                onChange={handleChange}
                fullWidth
              />

              <Input
                label="Calorías"
                name="calories"
                type="number"
                placeholder="450"
                value={formData.calories}
                onChange={handleChange}
                fullWidth
              />

              <Input
                label="Tiempo (min)"
                name="prepTime"
                type="number"
                placeholder="15"
                value={formData.prepTime}
                onChange={handleChange}
                fullWidth
              />
            </div>

            <Input
              label="URL de Imagen (Opcional)"
              name="image"
              type="url"
              placeholder="https://..."
              value={formData.image}
              onChange={handleChange}
              fullWidth
            />

            {formData.image && (
              <div className={`border rounded-lg p-4 ${
                isDark ? 'border-gray-600' : 'border-gray-300'
              }`}>
                <p className={`text-sm font-semibold tracking-tight mb-2 ${
                  isDark ? 'text-gray-100' : 'text-slate-800'
                }`}>Vista Previa:</p>
                <img 
                  src={formData.image} 
                  alt="Preview" 
                  className="w-full h-48 object-cover rounded"
                  onError={(e) => e.target.src = 'https://via.placeholder.com/400x300?text=Error'}
                />
              </div>
            )}

            <div>
              <label className={`block text-sm font-semibold tracking-tight mb-3 ${
                isDark ? 'text-gray-100' : 'text-slate-800'
              }`}>
                Características
              </label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isVegetarian"
                    checked={formData.isVegetarian}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className={`text-sm ${
                    isDark ? 'text-gray-100' : 'text-slate-800'
                  }`}>🥬 Vegetariano</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isSpicy"
                    checked={formData.isSpicy}
                    onChange={handleChange}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className={`text-sm ${
                    isDark ? 'text-gray-100' : 'text-slate-800'
                  }`}>🌶️ Picante</span>
                </label>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-semibold tracking-tight mb-2 ${
                isDark ? 'text-gray-100' : 'text-slate-800'
              }`}>
                Tags / Etiquetas
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {formData.tags.map((tag, index) => (
                  <Badge key={index} variant={tag.variant}>
                    {tag.label}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(index)}
                      className="ml-2 text-xs hover:font-bold"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag.label}
                  onChange={(e) => setNewTag({ ...newTag, label: e.target.value })}
                  placeholder="Nombre del tag"
                  className={`flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                />
                <select
                  value={newTag.variant}
                  onChange={(e) => setNewTag({ ...newTag, variant: e.target.value })}
                  className={`px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'
                  }`}
                >
                  <option value="default">Default</option>
                  <option value="primary">Primary</option>
                  <option value="success">Success</option>
                  <option value="danger">Danger</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
                <Button type="button" variant="outline" onClick={handleAddTag}>
                  Agregar
                </Button>
              </div>
            </div>

            <div className={`flex gap-3 pt-4 border-t ${
              isDark ? 'border-gray-700' : 'border-gray-200'
            }`}>
              <Button type="submit" variant="primary" size="lg" disabled={saving}>
                {isEditing ? 'Guardar Cambios' : 'Crear Plato'}
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

export default DishForm;
