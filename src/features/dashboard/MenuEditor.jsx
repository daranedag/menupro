'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useNavigate } from '@/lib/navigation';
import { useParams } from 'next/navigation';

import { useMenu } from '../../contexts/MenuContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button, Badge, Card, Modal, Spinner } from '../../components/ui';
import { Plus, GripVertical, Edit, Pause, Play, Trash2, Power, PowerOff, Eye } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { MenuPreview, PDFGenerator, QRGenerator, MobilePreview } from '../../components/dashboard';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatPrice } from '@/lib/format-price';
import GuidedTour from '@/components/dashboard/GuidedTour';

// Componente para Sección Sortable
function SortableSection({ section, menuId, onDeleteSection, onToggleSection, onDeleteDish }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      padding="none"
      className={`${isDragging ? 'ring-2 ring-brand opacity-90' : ''}`}
    >
      {/* Section Header */}
      <div className={`p-6 border-b ${isDark ? 'bg-elevated border-line' : 'bg-canvas'}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <button
              aria-label={`Mover sección ${section.name}`}
              {...attributes}
              {...listeners}
              className={`cursor-grab active:cursor-grabbing ${
                isDark ? 'text-muted hover:text-muted' : 'text-muted hover:text-muted'
              }`}
            >
              <GripVertical size={20} />
            </button>
            {section.icon && <span className="text-2xl">{section.icon}</span>}
            <div>
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-ink'}`}>{section.name}</h3>
              {section.description && (
                <p className={`text-sm ${isDark ? 'text-muted' : 'text-muted'}`}>{section.description}</p>
              )}
            </div>
            <Badge variant={section.isActive ? 'success' : 'default'} size="sm">
              {section.isActive ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Link href={`/app/dashboard/menus/${menuId}/sections/${section.id}/dishes/new`}>
              <Button variant="primary" size="sm">
                <Plus size={16} className="inline mr-1" />
                Plato
              </Button>
            </Link>
            <Button
              variant={section.isActive ? 'warning' : 'success'}
              size="sm"
              onClick={() => onToggleSection(section.id)}
              title={section.isActive ? 'Pausar' : 'Activar'}
            >
              {section.isActive ? <Pause size={16} /> : <Play size={16} />}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => onDeleteSection(section.id, section.name)}
              title="Eliminar"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Dishes */}
      <div data-tour="tour-dishes" className="p-6">
        {section.items && section.items.length > 0 ? (
          <DishList
            dishes={section.items}
            menuId={menuId}
            sectionId={section.id}
            onDeleteDish={onDeleteDish}
          />
        ) : (
          <div className={`text-center py-8 ${isDark ? 'text-muted' : 'text-muted'}`}>
            <p className="mb-3">No hay platos en esta sección</p>
            <Link href={`/app/dashboard/menus/${menuId}/sections/${section.id}/dishes/new`}>
              <Button variant="outline" size="sm">Agregar Primer Plato</Button>
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}

// Componente para Lista de Platos con Drag & Drop
function DishList({ dishes, menuId, sectionId, onDeleteDish }) {
  const { reorderDishes } = useMenu();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = dishes.findIndex((d) => d.id === active.id);
      const newIndex = dishes.findIndex((d) => d.id === over.id);
      const reordered = arrayMove(dishes, oldIndex, newIndex);
      await reorderDishes(menuId, sectionId, reordered);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={dishes.map(d => d.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {dishes.map((dish) => (
            <SortableDish
              key={dish.id}
              dish={dish}
              menuId={menuId}
              sectionId={sectionId}
              onDelete={onDeleteDish}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// Componente para Plato Sortable
function SortableDish({ dish, menuId, sectionId, onDelete }) {
  const { toggleDishStatus } = useMenu();
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: dish.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Calcular precio con descuento
  const hasDiscount = dish.discount && dish.discount > 0;
  const finalPrice = hasDiscount 
    ? dish.price - (dish.price * dish.discount / 100)
    : dish.price;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`editor-dish flex items-center gap-4 p-4 border rounded-lg ${
        isDark ? 'bg-elevated border-line' : 'bg-surface border-line'
      }`}
    >
      <button
        aria-label={`Mover plato ${dish.name}`}
        {...attributes}
        {...listeners}
        className={`cursor-grab active:cursor-grabbing ${
          isDark ? 'text-muted hover:text-muted' : 'text-muted hover:text-muted'
        }`}
      >
        <GripVertical size={20} />
      </button>
      {dish.image && (
        <img
          src={dish.image}
          alt={dish.name}
          className="w-16 h-16 object-cover rounded"
        />
      )}
      <div className="min-w-0 flex-grow">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-ink'}`}>{dish.name}</h4>
          {dish.discount > 0 && (
            <Badge variant="discount" size="sm">-{dish.discount}%</Badge>
          )}
          <Badge variant={dish.isActive ? 'success' : 'default'} size="sm">
            {dish.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>
        <p className={`text-sm line-clamp-1 ${isDark ? 'text-muted' : 'text-muted'}`}>{dish.description}</p>
      </div>
      <div className="text-right">
        {hasDiscount ? (
          <div>
            <p className={`text-sm line-through mb-0.5 ${isDark ? 'text-muted' : 'text-muted'}`}>
              {formatPrice(dish.price)}
            </p>
            <p className="text-lg font-bold text-red-600">
              {formatPrice(finalPrice)}
            </p>
          </div>
        ) : (
          <p className="text-lg font-semibold text-ink">{formatPrice(dish.price)}</p>
        )}
      </div>
      <div className="flex gap-2">
        <Link href={`/app/dashboard/menus/${menuId}/sections/${sectionId}/dishes/${dish.id}`}>
          <Button variant="ghost" size="sm" title="Editar">
            <Edit size={16} />
          </Button>
        </Link>
        <Button
          variant={dish.isActive ? 'warning' : 'success'}
          size="sm"
          onClick={() => toggleDishStatus(menuId, sectionId, dish.id)}
          title={dish.isActive ? 'Desactivar plato' : 'Activar plato'}
        >
          {dish.isActive ? <PowerOff size={16} /> : <Power size={16} />}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => onDelete(sectionId, dish.id, dish.name)}
          title="Eliminar"
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </div>
  );
}

function MenuEditor() {
  const { menuId } = useParams();
  const navigate = useNavigate();
  const { menus, isLoading, deleteSection, deleteDish, toggleSectionStatus, reorderSections } = useMenu();
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const [showPreview, setShowPreview] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState(null);

  const menu = menus.find(m => m.id === menuId);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <Card>
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Spinner size="lg" label="Cargando carta..." />
            <p className={`text-sm ${isDark ? 'text-muted' : 'text-muted'}`}>
              Estamos preparando tu menú
            </p>
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  if (!menu) {
    return (
      <DashboardLayout>
        <Card>
          <div className="text-center py-12">
            <span className="text-6xl mb-4 block">❌</span>
            <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-ink'}`}>
              Carta no encontrada
            </h3>
            <Link href="/app/dashboard/menus">
              <Button variant="primary">Volver a Cartas</Button>
            </Link>
          </div>
        </Card>
      </DashboardLayout>
    );
  }

  const handleDragStart = (event) => {
    setActiveSectionId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over) {
      setActiveSectionId(null);
      return;
    }

    if (active.id !== over.id) {
      const oldIndex = menu.sections.findIndex((s) => s.id === active.id);
      const newIndex = menu.sections.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) {
        setActiveSectionId(null);
        return;
      }
      const reordered = arrayMove(menu.sections, oldIndex, newIndex);
      reorderSections(menuId, reordered);
    }

    setActiveSectionId(null);
  };

  const handleDragCancel = () => {
    setActiveSectionId(null);
  };

  const handleDeleteSection = (sectionId, sectionName) => {
    if (window.confirm(`¿Eliminar sección "${sectionName}"?`)) {
      deleteSection(menuId, sectionId);
    }
  };

  const handleDeleteDish = (sectionId, dishId, dishName) => {
    if (window.confirm(`¿Eliminar plato "${dishName}"?`)) {
      deleteDish(menuId, sectionId, dishId);
    }
  };

  return (
    <DashboardLayout>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link data-tour="tour-back" href="/app/dashboard/menus" className="text-brand hover:text-brand text-sm mb-2 inline-block">
              ← Volver a Cartas
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-4xl">{menu.icon}</span>
              <div>
                <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-ink'}`}>{menu.name}</h2>
                {menu.description && (
                  <p className={isDark ? 'text-muted' : 'text-muted'}>{menu.description}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <GuidedTour scope="editor" />
        <div className="flex flex-wrap gap-3 mb-6">
          <Link data-tour="tour-sections" href={`/app/dashboard/menus/${menuId}/sections/new`}>
            <Button variant="primary">
              <Plus size={18} className="inline mr-2" />
              Nueva Sección
            </Button>
          </Link>
          <Button data-tour="tour-preview" variant="outline" onClick={() => setShowPreview(true)}>
            <Eye size={18} className="inline mr-2" />
            Vista Previa
          </Button>
          <MobilePreview menuId={menuId} />
          <div data-tour="tour-share" className="flex flex-wrap gap-3"><PDFGenerator menu={menu} />
          <QRGenerator menuId={menuId} menuName={menu.name} /></div>
          <Link href={`/app/dashboard/menus/${menuId}/edit`}>
            <Button variant="outline">
              <Edit size={18} className="inline mr-2" />
              Editar Carta
            </Button>
          </Link>
        </div>

        {/* Sections List with Drag & Drop */}
        <div className="space-y-4">
          {menu.sections && menu.sections.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={menu.sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                {menu.sections.map((section) => (
                  <SortableSection
                    key={section.id}
                    section={section}
                    menuId={menuId}
                    onDeleteSection={handleDeleteSection}
                    onToggleSection={(sectionId) => toggleSectionStatus(menuId, sectionId)}
                    onDeleteDish={handleDeleteDish}
                  />
                ))}
              </SortableContext>
              <DragOverlay>
                {activeSectionId ? (
                  <Card padding="none" className="ring-2 ring-brand">
                    <div className="p-4 flex items-center gap-3">
                      <span className="text-2xl">{menu.sections.find(s => s.id === activeSectionId)?.icon}</span>
                      <div>
                        <div className="text-lg font-semibold">{menu.sections.find(s => s.id === activeSectionId)?.name}</div>
                        <div className="text-sm text-muted">Moviendo sección</div>
                      </div>
                    </div>
                  </Card>
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <Card>
              <div className="text-center py-12">
                <span className="text-6xl mb-4 block">📁</span>
                <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-ink'}`}>
                  No hay secciones
                </h3>
                <p className={`mb-6 ${isDark ? 'text-muted' : 'text-muted'}`}>
                  Crea tu primera sección para organizar tu menú
                </p>
                <Link href={`/app/dashboard/menus/${menuId}/sections/new`}>
                  <Button variant="primary">Crear Primera Sección</Button>
                </Link>
              </div>
            </Card>
          )}

          {/* Add Section Button */}
          {menu.sections && menu.sections.length > 0 && (
            <Link href={`/app/dashboard/menus/${menuId}/sections/new`}>
              <Button variant="outline" fullWidth>
                ➕ Agregar Nueva Sección
              </Button>
            </Link>
          )}
        </div>

        {/* Preview Modal */}
        <Modal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          title="Vista Previa del Menú"
          size="xl"
        >
          <MenuPreview menu={menu} />
        </Modal>
      </div>
    </DashboardLayout>
  );
}

export default MenuEditor;
