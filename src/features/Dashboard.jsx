'use client';
import { useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import { useMenu } from '../contexts/MenuContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Card, Spinner, Input, Button, Badge } from '../components/ui';
import { BookOpen, FolderOpen, UtensilsCrossed, Plus, List, Eye } from 'lucide-react';
import TrialOnboarding from '@/components/business/TrialOnboarding';

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

  const restaurantsCount = user?.restaurants?.filter(restaurant => !restaurant.archived_at).length ?? 0;
  const maxRestaurants =
    user?.maxRestaurants ??
    user?.tierLimits?.maxRestaurants ??
    user?.tierLimits?.restaurants ??
    user?.tierLimits?.restaurantsCount ??
    null;
  const hasRestaurantsLimit = maxRestaurants !== null && maxRestaurants !== undefined;
  const canCreateRestaurant =
    ['owner', 'manager'].includes(user?.businessRole) && user?.subscription?.has_access && (!hasRestaurantsLimit || restaurantsCount < Number(maxRestaurants));

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

  if (user?.subscription && !user.subscription.has_access && ['unstarted', 'review'].includes(user.subscription.effective_status)) {
    return <DashboardLayout><TrialOnboarding key={user.businessId} /></DashboardLayout>;
  }
  return (
    <DashboardLayout>
      <div>
        <div className="mb-6">
          <h2 className={`text-3xl font-bold ${
            isDark ? 'text-white' : 'text-ink'
          }`}>
            Bienvenido, {user?.name || 'Usuario'}
          </h2>
          <p className={isDark ? 'text-muted mt-1' : 'text-muted mt-1'}>{user?.activeRestaurantName || user?.restaurantName}</p>
        </div>

        {isLoading && (
          <Card>
            <div className="py-8 text-center text-sm">
              <Spinner label="Cargando cartas…" />
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card hoverable>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-lg font-semibold ${
                isDark ? 'text-muted' : 'text-ink'
              }`}>
                Total Cartas
              </h3>
              <div className="p-3 bg-brand-soft rounded-lg">
                <BookOpen className="text-brand" size={24} />
              </div>
            </div>
            <p className="text-4xl font-bold text-brand">{menus.length}</p>
            <p className={`text-sm mt-2 ${
              isDark ? 'text-muted' : 'text-muted'
            }`}>Cartas creadas</p>
          </Card>

          <Card hoverable>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-lg font-semibold ${
                isDark ? 'text-muted' : 'text-ink'
              }`}>
                Secciones
              </h3>
              <div className="p-3 bg-brand-soft rounded-lg">
                <FolderOpen className="text-brand" size={24} />
              </div>
            </div>
            <p className="text-4xl font-bold text-brand">{totalSections}</p>
            <p className={`text-sm mt-2 ${
              isDark ? 'text-muted' : 'text-muted'
            }`}>Categorías activas</p>
          </Card>

          <Card hoverable>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-lg font-semibold ${
                isDark ? 'text-muted' : 'text-ink'
              }`}>
                Total Platos
              </h3>
              <div className="p-3 bg-brand-soft rounded-lg">
                <UtensilsCrossed className="text-brand" size={24} />
              </div>
            </div>
            <p className="text-4xl font-bold text-brand">{totalDishes}</p>
            <p className={`text-sm mt-2 ${
              isDark ? 'text-muted' : 'text-muted'
            }`}>En tu menú</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Acciones Rápidas">
            <div className="space-y-3">
              <a
                href="/app/dashboard/menus/new"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-action text-white rounded-lg hover:bg-action-hover transition-colors font-medium shadow-sm hover:shadow-md"
              >
                <Plus size={20} />
                <span>Crear Nueva Carta</span>
              </a>
              <a
                href="/app/dashboard/menus"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-action text-white rounded-lg hover:bg-action-hover transition-colors font-medium shadow-sm hover:shadow-md"
              >
                <List size={20} />
                <span>Gestionar Cartas</span>
              </a>
              <a
                href={user?.activeRestaurantSlug && menus[0]?.slug ? `/menu/${user.activeRestaurantSlug}/${menus[0].slug}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-action text-white rounded-lg hover:bg-action-hover transition-colors font-medium shadow-sm hover:shadow-md"
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
                      isDark ? 'border-line hover:bg-elevated' : 'border-line hover:bg-canvas'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{menu.icon}</span>
                      <span className={`font-medium ${isDark ? 'text-muted' : 'text-ink'}`}>{menu.name}</span>
                    </div>
                    <span className={`text-sm ${isDark ? 'text-muted' : 'text-muted'}`}>
                      {menu.sections?.length || 0} secciones
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <p className={`text-center py-6 ${isDark ? 'text-muted' : 'text-muted'}`}>
                No hay cartas creadas aún
              </p>
            )}
          </Card>
        </div>

        {['owner', 'manager'].includes(user?.businessRole) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <Card title="Restaurantes" subtitle="Gestiona tus ubicaciones">
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <p className={isDark ? 'text-muted font-semibold' : 'text-ink font-semibold'}>
                      Plan {user?.subscriptionTier || 'actual'}
                    </p>
                    <p className={isDark ? 'text-muted text-sm' : 'text-muted text-sm'}>
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
