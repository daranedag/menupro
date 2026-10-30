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
      className={`${isDragging ? 'ring-2 ring-blue-400 opacity-90' : ''}`}
    >
      {/* Section Header */}
      <div className={`p-6 border-b ${isDark ? 'bg-gray-700 border-gray-600' : 'bg-gray-50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <button
              {...attributes}
              {...listeners}
              className={`cursor-grab active:cursor-grabbing ${
                isDark ? 'text-gray-500 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <GripVertical size={20} />
            </button>
            {section.icon && <span className="text-2xl">{section.icon}</span>}
            <div>
              <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>{section.name}</h3>
              {section.description && (
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{section.description}</p>
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
      <div className="p-6">
        {section.items && section.items.length > 0 ? (
          <DishList
            dishes={section.items}
            menuId={menuId}
            sectionId={section.id}
            onDeleteDish={onDeleteDish}
          />
        ) : (
          <div className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
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
      className={`flex items-center gap-4 p-4 border rounded-lg hover:shadow-md transition-shadow ${
        isDark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className={`cursor-grab active:cursor-grabbing ${
          isDark ? 'text-gray-500 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600'
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
      <div className="flex-grow">
        <div className="flex items-center gap-2 mb-1">
          <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>{dish.name}</h4>
          {dish.discount > 0 && (
            <Badge variant="discount" size="sm">-{dish.discount}%</Badge>
          )}
          <Badge variant={dish.isActive ? 'success' : 'default'} size="sm">
            {dish.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>
        <p className={`text-sm line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{dish.description}</p>
      </div>
      <div className="text-right">
        {hasDiscount ? (
          <div>
            <p className={`text-sm line-through mb-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              ${dish.price.toFixed(2)}
            </p>
            <p className="text-lg font-bold text-red-600">
              ${finalPrice.toFixed(2)}
            </p>
          </div>
        ) : (
          <p className="text-lg font-bold text-emerald-600">${dish.price.toFixed(2)}</p>
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
            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
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
            <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>
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
            <Link href="/app/dashboard/menus" className="text-blue-600 hover:text-blue-800 text-sm mb-2 inline-block">
              ← Volver a Cartas
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-4xl">{menu.icon}</span>
              <div>
                <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{menu.name}</h2>
                {menu.description && (
                  <p className={isDark ? 'text-gray-400' : 'text-gray-600'}>{menu.description}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Link href={`/app/dashboard/menus/${menuId}/sections/new`}>
            <Button variant="primary">
              <Plus size={18} className="inline mr-2" />
              Nueva Sección
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Eye size={18} className="inline mr-2" />
            Vista Previa
          </Button>
          <MobilePreview menuId={menuId} />
          <PDFGenerator menu={menu} />
          <QRGenerator menuId={menuId} menuName={menu.name} />
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
                  <Card padding="none" className="ring-2 ring-blue-400">
                    <div className="p-4 flex items-center gap-3">
                      <span className="text-2xl">{menu.sections.find(s => s.id === activeSectionId)?.icon}</span>
                      <div>
                        <div className="text-lg font-semibold">{menu.sections.find(s => s.id === activeSectionId)?.name}</div>
                        <div className="text-sm text-gray-500">Moviendo sección</div>
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
                <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                  No hay secciones
                </h3>
                <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
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
