import axios from 'axios';

export const TOKEN_KEY = 'civicfix_token';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

API.interceptors.request.use((config) => {
  const token = window.localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function getApiError(error) {
  if (!error.response) {
    return 'Cannot reach the CivicFix server. Start the backend and make sure its MongoDB database is running.';
  }
  return error.response.data?.message || error.message || 'Something went wrong. Please try again.';
}

export default API;
