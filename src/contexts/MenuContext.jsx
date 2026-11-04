'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as menusApi from '../api/menus';
import { useAuth } from './AuthContext';

const MenuContext = createContext(null);
export function useMenu() {
  const value = useContext(MenuContext);
  if (!value) throw new Error('MenuProvider is required');
  return value;
}
export function MenuProvider({ children }) {
  const { user, isLoading: authLoading } = useAuth();
  const restaurantId = user?.isAdmin ? null : user?.activeRestaurantId;
  const [menus, setMenus] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const refreshMenus = useCallback(async () => {
    if (authLoading) return;
    if (!restaurantId) { setMenus([]); setIsLoading(false); return; }
    setIsLoading(true);
    try { const { data } = await menusApi.fetchMenusByRestaurant(restaurantId); setMenus(data); setError(null); }
    catch (error) { setError(error.message); }
    finally { setIsLoading(false); }
  }, [restaurantId, authLoading]);
  useEffect(() => { refreshMenus(); }, [refreshMenus]);
  const run = async operation => {
    try { const result = await operation(); await refreshMenus(); return result?.data; }
    catch (error) { setError(error.message); throw error; }
  };
  const createMenu = data => run(() => menusApi.createMenu({ ...data, restaurant_id: restaurantId }));
  const updateMenu = (id, data) => run(() => menusApi.updateMenu(id, data));
  const deleteMenu = id => run(() => menusApi.deleteMenu(id));
  const publishMenu = (id, publish) => run(() => menusApi.publishMenu(id, { publish }));
  const createSection = (id, data) => run(() => menusApi.createSection(id, { ...data, order_index: menus.find(m => m.id === id)?.sections.length ?? 0 }));
  const updateSection = (_menu, id, data) => run(() => menusApi.updateSection(id, data));
  const deleteSection = (_menu, id) => run(() => menusApi.deleteSection(id));
  const createDish = (menuId, sectionId, data) => run(() => menusApi.createDish(sectionId, { ...data,
    order_index: menus.find(m => m.id === menuId)?.sections.find(s => s.id === sectionId)?.items.length ?? 0 }));
  const updateDish = (_menu, _section, id, data) => run(() => menusApi.updateDish(id, data));
  const deleteDish = (_menu, _section, id) => run(() => menusApi.deleteDish(id));
  const toggleMenuStatus = id => updateMenu(id, { isActive: !menus.find(m => m.id === id)?.isActive });
  const toggleMenuVisibility = id => updateMenu(id, { isVisible: !menus.find(m => m.id === id)?.isVisible });
  const toggleSectionStatus = (menu, id) => updateSection(menu, id, { isActive: !menus.find(m => m.id === menu)?.sections.find(s => s.id === id)?.isActive });
  const toggleDishStatus = (menu, section, id) => updateDish(menu, section, id, { isActive: !menus.find(m => m.id === menu)?.sections.find(s => s.id === section)?.items.find(i => i.id === id)?.isActive });
  return <MenuContext.Provider value={{ menus, isLoading, error, refreshMenus, createMenu, updateMenu, deleteMenu, publishMenu,
    toggleMenuStatus, toggleMenuVisibility, createSection, updateSection, deleteSection, toggleSectionStatus,
    createDish, updateDish, deleteDish, toggleDishStatus,
    reorderSections: (id, sections) => run(() => menusApi.reorderSectionsApi(id, sections)),
    reorderDishes: (_menu, id, items) => run(() => menusApi.reorderSectionItems(id, items)) }}>
    {error && <div role="alert" className="fixed bottom-4 left-4 right-4 z-50 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-lg">{error}<button className="float-right ml-4" onClick={() => setError(null)} aria-label="Cerrar aviso">✕</button></div>}
    {children}
  </MenuContext.Provider>;
}
