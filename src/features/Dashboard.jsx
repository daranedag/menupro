'use client';
import { useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import { useMenu } from '../contexts/MenuContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Card, Spinner, Input, Button, Badge } from '../components/ui';
import { BookOpen, FolderOpen, UtensilsCrossed, Plus, List, Eye } from 'lucide-react';

function DashboardHome() {
  const { menus, isLoading, error } = useMenu();
  const { user, createRestaurant } = useAuth();
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantSlug, setRestaurantSlug] = useState('');
  const [restaurantError, setRestaurantError] = useState('');
  const [restaurantSuccess, setRestaurantSuccess] = useState('');
  const [isCreatingRestaurant, setIsCreatingRestaurant] = useState(false);

  const totalDishes = menus.reduce((acc, menu) => 
    acc + (menu.sections?.reduce((sum, section) => 
      sum + (section.items?.length || 0), 0) || 0), 0
  );

  const totalSections = menus.reduce((acc, menu) => 
    acc + (menu.sections?.length || 0), 0
  );

  const restaurantsCount = user?.restaurants?.length ?? 0;
  const maxRestaurants =
    user?.maxRestaurants ??
    user?.tierLimits?.maxRestaurants ??
    user?.tierLimits?.restaurants ??
    user?.tierLimits?.restaurantsCount ??
    null;
  const hasRestaurantsLimit = maxRestaurants !== null && maxRestaurants !== undefined;
  const canCreateRestaurant =
    user?.role === 'restaurant_owner' && (!hasRestaurantsLimit || restaurantsCount < Number(maxRestaurants));

  const handleCreateRestaurant = async (event) => {
    event.preventDefault();
    setRestaurantError('');
    setRestaurantSuccess('');

    if (!restaurantName.trim()) {
      setRestaurantError('Ingresa el nombre del restaurante');
      return;
    }

    if (!canCreateRestaurant) {
      setRestaurantError('Has alcanzado el límite de restaurantes de tu plan.');
      return;
    }

    setIsCreatingRestaurant(true);

    try {
      const created = await createRestaurant({ name: restaurantName, slug: restaurantSlug });
      setRestaurantSuccess(`Restaurante "${created?.name || restaurantName}" creado y seleccionado.`);
      setRestaurantName('');
      setRestaurantSlug('');
    } catch (err) {
      setRestaurantError(err?.message || 'No se pudo crear el restaurante');
    } finally {
      setIsCreatingRestaurant(false);
    }
  };

  return (
    <DashboardLayout>
      <div>
        <div className="mb-6">
          <h2 className={`text-3xl font-bold ${
            isDark ? 'text-white' : 'text-gray-800'
          }`}>
            Bienvenido, {user?.name || 'Usuario'}
          </h2>
          <p className={isDark ? 'text-gray-400 mt-1' : 'text-gray-600 mt-1'}>{user?.activeRestaurantName || user?.restaurantName}</p>
        </div>

        {isLoading && (
          <Card>
            <div className="py-8 text-center text-sm">
              <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>Cargando cartas...</p>
            </div>
          </Card>
        )}

        {error && !isLoading && (
          <Card>
            <div className="py-4 px-4 text-sm text-red-600">
              {error}
            </div>
          </Card>
        )}

        {isLoading && (
          <Card>
            <div className="py-8 flex items-center justify-center">
              <Spinner label="Cargando cartas..." />
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card hoverable>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-lg font-semibold ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`}>
                Total Cartas
              </h3>
              <div className="p-3 bg-blue-100 rounded-lg">
                <BookOpen className="text-blue-600" size={24} />
              </div>
            </div>
            <p className="text-4xl font-bold text-blue-600">{menus.length}</p>
            <p className={`text-sm mt-2 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>Cartas creadas</p>
          </Card>

          <Card hoverable>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-lg font-semibold ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`}>
                Secciones
              </h3>
              <div className="p-3 bg-emerald-100 rounded-lg">
                <FolderOpen className="text-emerald-600" size={24} />
              </div>
            </div>
            <p className="text-4xl font-bold text-emerald-600">{totalSections}</p>
            <p className={`text-sm mt-2 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>Categorías activas</p>
          </Card>

          <Card hoverable>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-lg font-semibold ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`}>
                Total Platos
              </h3>
              <div className="p-3 bg-violet-100 rounded-lg">
                <UtensilsCrossed className="text-violet-600" size={24} />
              </div>
            </div>
            <p className="text-4xl font-bold text-violet-600">{totalDishes}</p>
            <p className={`text-sm mt-2 ${
              isDark ? 'text-gray-400' : 'text-gray-500'
            }`}>En tu menú</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Acciones Rápidas">
            <div className="space-y-3">
              <a
                href="/app/dashboard/menus/new"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm hover:shadow-md"
              >
                <Plus size={20} />
                <span>Crear Nueva Carta</span>
              </a>
              <a
                href="/app/dashboard/menus"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-sm hover:shadow-md"
              >
                <List size={20} />
                <span>Gestionar Cartas</span>
              </a>
              <a
                href={user?.activeRestaurantSlug && menus[0]?.slug ? `/menu/${user.activeRestaurantSlug}/${menus[0].slug}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium shadow-sm hover:shadow-md"
                aria-disabled={!user?.activeRestaurantSlug || !menus[0]?.slug}
              >
                <Eye size={20} />
                <span>Ver Menú Público</span>
              </a>
            </div>
          </Card>

          <Card title="Últimas Cartas">
            {menus.length > 0 ? (
              <div className="space-y-3">
                {menus.slice(0, 5).map((menu) => (
                  <a
                    key={menu.id}
                    href={`/app/dashboard/menus/${menu.id}`}
                    className={`flex items-center justify-between py-3 border-b transition-colors rounded px-2 ${
                      isDark ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{menu.icon}</span>
                      <span className={`font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>{menu.name}</span>
                    </div>
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {menu.sections?.length || 0} secciones
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <p className={`text-center py-6 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                No hay cartas creadas aún
              </p>
            )}
          </Card>
        </div>

        {user?.role === 'restaurant_owner' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <Card title="Restaurantes" subtitle="Gestiona tus ubicaciones">
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className={isDark ? 'text-gray-200 font-semibold' : 'text-gray-800 font-semibold'}>
                      Plan {user?.subscriptionTier || 'actual'}
                    </p>
                    <p className={isDark ? 'text-gray-400 text-sm' : 'text-gray-600 text-sm'}>
                      Restaurantes: {restaurantsCount}{hasRestaurantsLimit ? ` / ${maxRestaurants}` : ' sin límite'}
                    </p>
                  </div>
                  <Badge variant={canCreateRestaurant ? 'success' : 'danger'}>
                    {canCreateRestaurant ? 'Espacio disponible' : 'Límite alcanzado'}
                  </Badge>
                </div>

                {restaurantError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                    {restaurantError}
                  </div>
                )}

                {restaurantSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
                    {restaurantSuccess}
                  </div>
                )}

                <form onSubmit={handleCreateRestaurant} className="space-y-3">
                  <Input
                    label="Nombre del restaurante"
                    name="restaurantName"
                    placeholder="Ej. Casa Bonita"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    required
                  />

                  <Input
                    label="Slug (opcional)"
                    name="restaurantSlug"
                    placeholder="ej: casa-bonita"
                    value={restaurantSlug}
                    onChange={(e) => setRestaurantSlug(e.target.value)}
                    helperText="Se usará en la URL pública"
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={!canCreateRestaurant || isCreatingRestaurant}
                    fullWidth
                  >
                    {isCreatingRestaurant ? 'Creando...' : 'Crear restaurante'}
                  </Button>
                </form>
              </div>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default DashboardHome;
