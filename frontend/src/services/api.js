import { API_URL } from '../constants';

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, value);
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export async function fetchApi(path, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timer);

    const text = await res.text();
    if (!text) return { success: res.ok };

    try {
      return JSON.parse(text);
    } catch {
      return {
        success: false,
        message: text || 'Response server tidak valid',
      };
    }
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      return { success: false, message: 'Waktu permintaan habis, silakan coba lagi', errorCode: 'ERR-TIMEOUT-01' };
    }
    return { success: false, message: 'Terjadi kesalahan jaringan' };
  }
}

export const auth = {
  login: (data) => fetchApi('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data) => fetchApi('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => fetchApi('/auth/logout', { method: 'POST' }),
  me: () => fetchApi('/auth/me'),
};

export const references = {
  getProvinces: () => fetchApi('/provinces'),
  getCities: (provinceId) => fetchApi(`/cities/${provinceId}`),
  getAllCities: () => fetchApi('/cities'),
  getProductCategories: () => fetchApi('/product-categories'),
  getUnits: () => fetchApi('/units'),
};

export const seller = {
  register: (data) => fetchApi('/sellers/register', { method: 'POST', body: JSON.stringify(data) }),
  getMyProfile: () => fetchApi('/sellers/profiles/me'),
  getCatalog: (params = {}) => fetchApi(`/sellers/catalog${buildQuery(params)}`),
  getPublicProfile: (sellerId) => fetchApi(`/sellers/${sellerId}`),
  getPublicCatalog: (sellerId, params = {}) => fetchApi(`/sellers/${sellerId}/products${buildQuery(params)}`),
  getProductsBySeller: (sellerId, params = {}) => fetchApi(`/sellers/${sellerId}/products${buildQuery(params)}`),
};

export const admin = {
  listUsers: () => fetchApi('/users'),
  updateUserStatus: (id, status) => fetchApi(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  listSellers: () => fetchApi('/sellers'),
  listProducts: (sellerId) => fetchApi(`/products${buildQuery({ sellerId })}`),
  takedownProduct: (id) => fetchApi(`/products/${id}/takedown`, { method: 'PATCH' }),
};

export const audit = {
  list: (params = {}) => fetchApi(`/audit-logs${buildQuery(params)}`),
};

export const products = {
  list: (params = {}) => fetchApi(`/products${buildQuery(params)}`),
  getById: (id) => fetchApi(`/products/${id}`),
  create: (data) => fetchApi('/products', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => fetchApi(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  takedown: (id) => fetchApi(`/products/${id}/takedown`, { method: 'PATCH' }),
};

export const contracts = {
  create: (data) => fetchApi('/contracts', { method: 'POST', body: JSON.stringify(data) }),
  list: () => fetchApi('/contracts'),
  getById: (id) => fetchApi(`/contracts/${id}`),
  respond: (id, data) => fetchApi(`/contracts/${id}/respond`, { method: 'PATCH', body: JSON.stringify(data) }),
  cancel: (id) => fetchApi(`/contracts/${id}/cancel`, { method: 'PATCH' }),
};

export const userAddresses = {
  list: () => fetchApi('/users/addresses'),
  create: (data) => fetchApi('/users/addresses', { method: 'POST', body: JSON.stringify(data) }),
};

export const negotiations = {
  initiate: (data) => fetchApi('/negotiations', { method: 'POST', body: JSON.stringify(data) }),
  list: () => fetchApi('/negotiations'),
  getById: (id) => fetchApi(`/negotiations/${id}`),
  sellerRespond: (id, data) => fetchApi(`/negotiations/${id}/seller`, { method: 'PATCH', body: JSON.stringify(data) }),
  buyerRespond: (id, data) => fetchApi(`/negotiations/${id}/buyer`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const cart = {
  addItem: (data) => fetchApi('/carts/items', { method: 'POST', body: JSON.stringify(data) }),
  view: () => fetchApi('/carts/items'),
  updateItem: (id, data) => fetchApi(`/carts/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  removeItem: (id) => fetchApi(`/carts/items/${id}`, { method: 'DELETE' }),
};

export const checkout = {
  list: (params) => fetchApi(`/checkouts${buildQuery(params)}`),
  direct: (data) => fetchApi('/checkouts/direct', { method: 'POST', body: JSON.stringify(data) }),
  create: (data) => fetchApi('/checkouts', { method: 'POST', body: JSON.stringify(data) }),
  pay: (id) => fetchApi(`/checkouts/${id}/pay`, { method: 'PUT' }),
  cancel: (id) => fetchApi(`/checkouts/${id}/cancel`, { method: 'PUT' }),
  getStatus: (id) => fetchApi(`/checkouts/${id}/status`),
  shipOrder: (checkoutId, orderId) => fetchApi(`/checkouts/${checkoutId}/orders/${orderId}/ship`, { method: 'PUT' }),
  cancelOrder: (checkoutId, orderId) => fetchApi(`/checkouts/${checkoutId}/orders/${orderId}/cancel`, { method: 'PUT' }),
  receiveOrder: (checkoutId, orderId) => fetchApi(`/checkouts/${checkoutId}/orders/${orderId}/receive`, { method: 'PUT' }),
};

export const dashboard = {
  buyer: () => fetchApi('/dashboard/buyer'),
  seller: () => fetchApi('/dashboard/seller'),
  admin: () => fetchApi('/dashboard/admin'),
};
