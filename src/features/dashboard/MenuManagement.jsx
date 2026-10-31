'use client';
import Link from 'next/link';

import { useMenu } from '../../contexts/MenuContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Button, Badge, Card, Spinner } from '../../components/ui';
import { Plus, BookOpen, Edit, Pause, Play, Eye, EyeOff, Trash2, UtensilsCrossed, FolderOpen } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';

function MenuManagement() {
  const { menus, toggleMenuStatus, toggleMenuVisibility, deleteMenu, publishMenu, isLoading } = useMenu();
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';

  const handleDelete = (menuId, menuName) => {
    if (window.confirm(`¿Estás seguro de eliminar el menú "${menuName}"?`)) {
      deleteMenu(menuId);
    }
  };

  return (
    <DashboardLayout>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Mis Cartas</h2>
            <p className={`mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Gestiona tus menús y cartas</p>
          </div>
          <Link href="/app/dashboard/menus/new">
            <Button variant="primary">
              <Plus size={18} className="inline mr-2" />
              Nueva Carta
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <Card padding="lg">
            <div className="py-16 flex items-center justify-center">
              <Spinner label="Cargando cartas..." />
            </div>
          </Card>
        ) : menus.length === 0 ? (
          <Card padding="lg">
            <div className="text-center py-12">
              <div className="flex justify-center mb-4">
                <div className="p-4 bg-blue-100 rounded-full">
                  <BookOpen className="text-blue-600" size={48} />
                </div>
              </div>
              <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                No tienes cartas creadas
              </h3>
              <p className={`mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Crea tu primera carta para comenzar
              </p>
              <Link href="/app/dashboard/menus/new">
                <Button variant="primary">
                  <Plus size={18} className="inline mr-2" />
                  Crear Primera Carta
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menus.map((menu) => (
              <Card key={menu.id} hoverable padding="none">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {menu.icon && <span className="text-3xl">{menu.icon}</span>}
                      <h3 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-800'}`}>
                        {menu.name}
                      </h3>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={menu.isActive ? 'success' : 'default'} size="sm">
                        {menu.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                      <Badge variant={menu.isVisible ? 'primary' : 'default'} size="sm">
                        {menu.isVisible ? 'Visible' : 'Oculto'}
                      </Badge>
                    </div>
                  </div>

                  {menu.description && (
                    <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{menu.description}</p>
                  )}

                  <div className={`flex items-center gap-4 text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    <span className="flex items-center gap-1">
                      <FolderOpen size={16} />
                      {menu.sections?.length || 0} secciones
                    </span>
                    <span className="flex items-center gap-1">
                      <UtensilsCrossed size={16} />
                      {menu.sections?.reduce((acc, s) => acc + (s.items?.length || 0), 0) || 0} platos
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/app/dashboard/menus/${menu.id}`} className="flex-1">
                      <Button variant="primary" size="sm" fullWidth>
                        <Edit size={16} className="inline" />
                      </Button>
                    </Link>
                    <Button
                      variant={menu.isActive ? 'warning' : 'success'}
                      size="sm"
                      onClick={() => toggleMenuStatus(menu.id)}
                      title={menu.isActive ? 'Pausar' : 'Activar'}
                    >
                      {menu.isActive ? <Pause size={16} /> : <Play size={16} />}
                    </Button>
                    <Button
                      variant={menu.isPublished ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => publishMenu(menu.id, !menu.isPublished)}
                      title={menu.isPublished ? 'Despublicar' : 'Publicar'}
                      aria-label={`${menu.isPublished ? 'Despublicar' : 'Publicar'} ${menu.name}`}
                    >
                      {menu.isPublished ? 'Publicado' : 'Publicar'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleMenuVisibility(menu.id)}
                      title={menu.isVisible ? 'Ocultar' : 'Mostrar'}
                    >
                      {menu.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(menu.id, menu.name)}
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default MenuManagement;
