'use client';
import { useState } from 'react';
import Link from 'next/link';
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
        <div className="dashboard-heading mb-6"><div>
          <h2 className={`text-3xl font-bold ${
            isDark ? 'text-white' : 'text-ink'
          }`}>
            Tu carta, al día.
          </h2>
          <p className="text-muted mt-1">Organiza tus platos, prepara tu carta y compártela con tus clientes.</p>
        </div><Link href="/app/dashboard/menus/new" className="ui-button inline-flex items-center gap-2 bg-action px-5 py-3 text-white"><Plus size={18} aria-hidden="true" />Nueva carta</Link></div>

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

        <div className="dashboard-summary">
          <div><span><BookOpen size={18} />Cartas creadas</span><strong>{menus.length}</strong></div>
          <div><span><FolderOpen size={18} />Secciones</span><strong>{totalSections}</strong></div>
          <div><span><UtensilsCrossed size={18} />Platos en carta</span><strong>{totalDishes}</strong></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Tu próximo paso" subtitle="Lo esencial para poner tu carta en marcha">
            <div className="dashboard-actions">
              <Link href="/app/dashboard/menus/new"><Plus size={20} />Crear una nueva carta</Link>
              <Link href="/app/dashboard/menus"><List size={20} />Gestionar mis cartas</Link>
              {user?.activeRestaurantSlug && menus.find(menu => menu.isPublished)?.slug ? <a href={`/menu/${user.activeRestaurantSlug}/${menus.find(menu => menu.isPublished).slug}`} target="_blank" rel="noopener noreferrer"><Eye size={20} />Ver mi carta publicada</a> : <p className="px-3 py-2 text-xs text-muted">Publica una carta para compartirla con tus clientes.</p>}
            </div>
          </Card>

          <Card title="Tus últimas cartas">
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
              <div className="dashboard-empty"><BookOpen size={34} strokeWidth={1.3} /><h3 className="text-lg">Aquí empieza tu próxima carta</h3><p>Agrega tus platos y ten todo listo para publicar.</p><Link href="/app/dashboard/menus/new" className="text-brand text-sm font-semibold underline underline-offset-4">Crear mi primera carta</Link></div>
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
                    label="Dirección de tu carta (opcional)"
                    name="restaurantSlug"
                    placeholder="ej: casa-bonita"
                    value={restaurantSlug}
                    onChange={(e) => setRestaurantSlug(e.target.value)}
                    helperText="El nombre que aparecerá en el enlace de tu restaurante"
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
