import axios from 'axios';

// Base URL dinamico: usa lo stesso host del frontend, porta 8001 per il backend
const API_BASE = `http://${window.location.hostname}:8001`;

const api = axios.create({
    baseURL: API_BASE,
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
});

// Interceptor: aggiunge automaticamente il token JWT a ogni richiesta
api.interceptors.request.use(config => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;
