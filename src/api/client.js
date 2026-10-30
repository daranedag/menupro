import axios from 'axios';

export const api = axios.create({ baseURL: '/', headers: { 'Content-Type': 'application/json' } });

api.interceptors.response.use(
  response => ({ ...response, data: response.data?.data ?? response.data }),
  error => {
    error.message = error.response?.data?.error ?? 'No se pudo conectar. Inténtalo nuevamente.';
    if (error.response?.status === 401 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/app/login')) {
      window.location.assign('/app/login');
    }
    return Promise.reject(error);
  }
);
