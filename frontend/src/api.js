import axios from 'axios';

// Base URL dell'API.
// Le chiamate nel codice usano già il prefisso "/api" (es. api.post('/api/auth/login')).
// Quindi:
// - In produzione (HTTPS dietro nginx) baseURL DEVE essere vuoto: le chiamate
//   diventano same-origin "/api/..." -> nginx inoltra al backend.
// - In sviluppo (HTTP) usa http://<host>:8001 -> le chiamate diventano
//   http://<host>:8001/api/...
// - Override esplicito con REACT_APP_API_BASE (es. http://host:8001). NON usare
//   "/api" qui: raddoppierebbe il prefisso.
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
