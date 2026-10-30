import { api } from './client';
export const createRestaurant = data => api.post('/api/restaurants', data);
export const fetchRestaurants = () => api.get('/api/restaurants');
