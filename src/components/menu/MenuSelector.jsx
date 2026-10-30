'use client';
import { useState } from 'react';

function MenuSelector({ menus, activeMenu, onMenuChange }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="sticky top-0 z-40 bg-white shadow-md border-b mb-6">
      <div className="container mx-auto px-4 py-4">
        {/* Mobile: Dropdown */}
        <div className="sm:hidden">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-semibold"
          >
            <span className="flex items-center gap-2">
              {activeMenu.icon && <span>{activeMenu.icon}</span>}
              {activeMenu.name}
            </span>
            <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
          
          {isOpen && (
            <div className="absolute left-0 right-0 bg-white shadow-lg border-t mt-2 max-h-64 overflow-y-auto">
              {menus.map((menu) => (
                <button
                  key={menu.id}
                  onClick={() => {
                    onMenuChange(menu);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                    activeMenu.id === menu.id ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-700'
                  }`}
                >
                  {menu.icon && <span>{menu.icon}</span>}
                  <div>
                    <div>{menu.name}</div>
                    {menu.description && (
                      <div className="text-xs text-gray-500">{menu.description}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Desktop: Tabs */}
        <div className="hidden sm:flex items-center gap-2 overflow-x-auto pb-2">
          {menus.map((menu) => (
            <button
              key={menu.id}
              onClick={() => onMenuChange(menu)}
              className={`px-6 py-3 rounded-lg font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                activeMenu.id === menu.id
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg transform scale-105'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {menu.icon && <span className="text-xl">{menu.icon}</span>}
              <div className="text-left">
                <div>{menu.name}</div>
                {menu.description && activeMenu.id === menu.id && (
                  <div className="text-xs opacity-90">{menu.description}</div>
                )}
              </div>
            </button>
          ))}
        </div>
        
        {/* Navegación rápida por secciones */}
        {activeMenu.sections && activeMenu.sections.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {activeMenu.sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full whitespace-nowrap transition-colors"
              >
                {section.icon && <span className="mr-1">{section.icon}</span>}
                {section.name}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MenuSelector;
