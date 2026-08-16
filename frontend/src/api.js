import axios from 'axios';

// Base URL dell'API.
// - In produzione (HTTPS dietro nginx) usa il percorso relativo "/api":
//   nginx inoltra /api al backend sulla stessa origine -> niente mixed content.
// - In sviluppo (HTTP) usa http://<host>:8001 direttamente.
// - Override esplicito possibile con REACT_APP_API_BASE (es. /api).
const API_BASE = process.env.REACT_APP_API_BASE
    || (window.location.protocol === 'https:' ? '' : `http://${window.location.hostname}:8001`);

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
