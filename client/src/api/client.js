import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const searchCatalog = async (query) => {
  if (!query || !query.trim()) return [];
  const response = await api.get('/api/search', {
    params: { q: query.trim() },
  });
  return response.data.results || [];
};

export const getTrackedProducts = async (fresh = false) => {
  const response = await api.get('/api/products', {
    params: fresh ? { fresh: 'true' } : undefined,
  });
  return response.data.products || [];
};

export const getProductDetails = async (id) => {
  const response = await api.get(`/api/products/${id}`);
  return response.data;
};

export const getProductHistory = async (id, range = 'all') => {
  const response = await api.get(`/api/products/${id}/history`, {
    params: { range },
  });
  return response.data.history || [];
};

export const getProductLogs = async (id, limit = 50) => {
  const response = await api.get(`/api/products/${id}/logs`, {
    params: { limit },
  });
  return response.data.logs || [];
};

export const trackProduct = async ({ storeProductId, name, slug, productUrl }) => {
  const response = await api.post('/api/products', {
    storeProductId,
    name,
    slug,
    productUrl,
  });
  return response.data;
};

export const updateProduct = async (id, updates) => {
  const response = await api.patch(`/api/products/${id}`, updates);
  return response.data;
};

export const deleteProduct = async (id) => {
  const response = await api.delete(`/api/products/${id}`);
  return response.data;
};

export const triggerScrapeProduct = async (id) => {
  const response = await api.post(`/api/scrape/product/${id}`);
  return response.data;
};

export const triggerScrapeAll = async () => {
  const response = await api.post('/api/scrape/all');
  return response.data;
};

export const getScraperStatus = async () => {
  const response = await api.get('/api/scrape/status');
  return response.data;
};

export default api;
