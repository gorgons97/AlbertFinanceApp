import { createClient } from '@supabase/supabase-js';

// Determina l'URL di Supabase / GoTrue dinamicamente per evitare errori se testato da altri dispositivi
let supabaseUrl = '';
if (window.location.protocol === 'https:') {
    // In produzione HTTPS o dietro Nginx: usa la stessa origin (nginx instrada /auth/v1/ a GoTrue)
    supabaseUrl = window.location.origin;
} else {
    // In sviluppo HTTP (es. accesso via porta 3001), punta alla porta 9999 dello STESSO host
    supabaseUrl = `http://${window.location.hostname}:9999`;
}

// Anon Key (JWT generato con SECRET_KEY con claim role: anon)
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY
    || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg5MjEwOTExLCJleHAiOjIxMDQ1NzA5MTF9.ruKCQHSEEMgO63PWdl2MP2T0jtdccjfYavonvHSprbA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
    },
});

// Ascolta i cambiamenti di stato di autenticazione (inclusi i redirect da Google OAuth)
supabase.auth.onAuthStateChange((event, session) => {
    if (session?.access_token) {
        localStorage.setItem('access_token', session.access_token);
    } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('access_token');
    }
});

export default supabase;
