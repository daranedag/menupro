'use client';
import MenuItem from './MenuItem';

function MenuSection({ section }) {
  return (
    <div className="mb-10" id={section.id}>
      {/* Header de la sección */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          {section.icon && (
            <span className="text-3xl">{section.icon}</span>
          )}
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
            {section.name}
          </h2>
        </div>
        
        {section.description && (
          <p className="text-gray-600 text-sm sm:text-base ml-0 sm:ml-12">
            {section.description}
          </p>
        )}
        
        {/* Línea divisoria */}
        <div className="h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mt-3 w-20"></div>
      </div>
      
      {/* Lista de platos */}
      <div className="space-y-4">
        {section.items && section.items.length > 0 ? (
          section.items.map((item) => (
            <MenuItem key={item.id} item={item} />
          ))
        ) : (
          <p className="text-gray-400 text-center py-8">
            No hay platos disponibles en esta sección
          </p>
        )}
      </div>
    </div>
  );
}

export default MenuSection;
