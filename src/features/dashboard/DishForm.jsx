'use client';
import { useState } from 'react';
import { useNavigate } from '@/lib/navigation';
import { useParams } from 'next/navigation';

import { useMenu } from '../../contexts/MenuContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button, Input, Card } from '../../components/ui';
import DishTag, { dishTagColors } from '@/components/menu/DishTag';
import { Check, X } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { ImagePicker } from './ImageLibrary';
import DishStatusSelect from '@/components/dashboard/DishStatusSelect';
import { dishStatusFields, getDishStatus } from '@/lib/menu.mjs';

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
    imageAssetId: existingDish?.imageAssetId || null,
    calories: existingDish?.calories || '',
    prepTime: existingDish?.prepTime || '',
    isVegetarian: existingDish?.isVegetarian || false,
    isSpicy: existingDish?.isSpicy || false,
    tags: existingDish?.tags || [],
    isActive: existingDish?.isActive !== false,
    isVisible: existingDish?.isVisible !== false,
  });

  const [newTag, setNewTag] = useState({ label: '', variant: 'default' });

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
      ...(e.target.name === 'image' ? { imageAssetId: null } : {}),
    });
  };

  const handleAddTag = () => {
    if (newTag.label.trim()) {
      setFormData({
        ...formData,
        tags: [...formData.tags, { ...newTag, label: newTag.label.trim() }],
      });
      setNewTag(previous => ({ ...previous, label: '' }));
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
          <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-ink'}`}>
            {isEditing ? 'Editar Plato' : 'Nuevo Plato'}
          </h2>
          <p className={`mt-1 ${isDark ? 'text-muted' : 'text-muted'}`}>
            {menu.icon} {menu.name} → {section.icon} {section.name}
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <section aria-labelledby="dish-status-heading" className="space-y-2">
              <h3 id="dish-status-heading" className="text-base font-semibold text-ink">Estado del plato</h3>
              <DishStatusSelect value={getDishStatus(formData)} disabled={saving}
                onChange={status => setFormData(previous => ({ ...previous, ...dishStatusFields(status) }))} />
              <p className="text-sm text-muted">Disponible: se muestra normalmente. No disponible: aparece atenuado y con un aviso. Oculto: no aparece en el menú.</p>
            </section>
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
                isDark ? 'text-muted' : 'text-ink'
              }`}>
                Descripción Larga (Opcional)
              </label>
              <textarea
                name="longDescription"
                value={formData.longDescription}
                onChange={handleChange}
                rows="3"
                placeholder="Descripción detallada del plato, ingredientes, preparación"
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent ${
                  isDark ? 'bg-elevated border-line text-white placeholder-muted' : 'bg-surface border-line text-ink placeholder-muted'
                }`}
              />
              <p className={`text-sm mt-1 ${
                isDark ? 'text-muted' : 'text-muted'
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

            <ImagePicker onSelect={asset => setFormData(previous => ({ ...previous, image: asset.url, imageAssetId: asset.id }))} />

            <Input
              label="URL de Imagen (Opcional)"
              name="image"
              type="url"
              placeholder="https://..."
              value={formData.image}
              onChange={handleChange}
              fullWidth
            />

            {formData.image && <Button variant="ghost" onClick={() => setFormData(previous => ({ ...previous, image: '', imageAssetId: null }))}>Quitar imagen</Button>}

            {formData.image && (
              <div className={`border rounded-lg p-4 ${
                isDark ? 'border-line' : 'border-line'
              }`}>
                <p className={`text-sm font-semibold tracking-tight mb-2 ${
                  isDark ? 'text-muted' : 'text-ink'
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
                isDark ? 'text-muted' : 'text-ink'
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
                    className="w-4 h-4 text-brand rounded"
                  />
                  <span className={`text-sm ${
                    isDark ? 'text-muted' : 'text-ink'
                  }`}>🥬 Vegetariano</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isSpicy"
                    checked={formData.isSpicy}
                    onChange={handleChange}
                    className="w-4 h-4 text-brand rounded"
                  />
                  <span className={`text-sm ${
                    isDark ? 'text-muted' : 'text-ink'
                  }`}>🌶️ Picante</span>
                </label>
              </div>
            </div>

            <section aria-labelledby="dish-tags-heading" className="space-y-4">
              <div><h3 id="dish-tags-heading" className="text-base font-semibold text-ink">Etiquetas del plato</h3>
                <p className="mt-1 text-sm text-muted">Destaca algo especial, como «Sin gluten» o «Recomendado».</p></div>
              {formData.tags.length > 0 && <ul aria-label="Etiquetas agregadas" className="flex flex-wrap gap-2">
                {formData.tags.map((tag, index) => (
                  <li key={index}><DishTag variant={tag.variant}>
                    <span className="min-w-0 break-words">{tag.label}</span>
                    <button
                      type="button"
                      aria-label={`Quitar etiqueta ${tag.label}`}
                      onClick={() => handleRemoveTag(index)}
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded hover:bg-black/15 focus-visible:outline-offset-0"
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </DishTag></li>
                ))}
              </ul>}
              <fieldset><legend className="mb-2 text-sm font-medium text-ink">Color de la etiqueta</legend>
                <div className="flex flex-wrap gap-3">{dishTagColors.map(color => <label key={color.value} className="relative cursor-pointer">
                  <input type="radio" name="tagColor" value={color.value} checked={newTag.variant === color.value} onChange={() => setNewTag(previous => ({ ...previous, variant: color.value }))} className="peer sr-only" />
                  <DishTag variant={color.value} className="min-h-10 gap-2 px-3 peer-checked:ring-2 peer-checked:ring-brand peer-checked:ring-offset-2 peer-checked:ring-offset-surface peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-brand">
                    {color.label}<Check size={14} aria-hidden="true" className={newTag.variant === color.value ? 'opacity-100' : 'opacity-0'} />
                  </DishTag>
                </label>)}</div>
              </fieldset>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
                <Input label="Nombre de la etiqueta" name="newTagLabel" value={newTag.label} maxLength={255} onChange={event => setNewTag(previous => ({ ...previous, label: event.target.value }))} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); handleAddTag(); } }} placeholder="Ej. Sin gluten" className="min-w-0 sm:flex-1" />
                <Button type="button" variant="outline" onClick={handleAddTag} disabled={!newTag.label.trim()}>Agregar etiqueta</Button>
              </div>
              {newTag.label.trim() && <div className="flex flex-wrap items-center gap-2 text-sm text-muted">Así se verá: <DishTag variant={newTag.variant}><span className="min-w-0 break-words">{newTag.label.trim()}</span></DishTag></div>}
            </section>

            <div className={`flex gap-3 pt-4 border-t ${
              isDark ? 'border-line' : 'border-line'
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
