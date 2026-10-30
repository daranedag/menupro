'use client';
import MenuSection from '../menu/MenuSection';
import { UtensilsCrossed } from 'lucide-react';

function MenuPreview({ menu }) {
  return (
    <div className="bg-gray-50 rounded-lg p-6 max-h-[70vh] overflow-y-auto">
      {/* Menu Header */}
      <div className="text-center mb-8 bg-white rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-center gap-3 mb-2">
          {menu.icon && <span className="text-4xl">{menu.icon}</span>}
          <h2 className="text-3xl font-bold text-gray-800">{menu.name}</h2>
        </div>
        {menu.description && (
          <p className="text-gray-600">{menu.description}</p>
        )}
      </div>

      {/* Sections */}
      {menu.sections && menu.sections.length > 0 ? (
        <div className="space-y-8">
          {menu.sections
            .filter(section => section.isActive !== false)
            .map((section) => (
              <MenuSection key={section.id} section={section} />
            ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gray-100 rounded-full">
              <UtensilsCrossed className="text-gray-400" size={48} />
            </div>
          </div>
          <p className="text-gray-500">
            No hay secciones para mostrar
          </p>
        </div>
      )}
    </div>
  );
}

export default MenuPreview;
