*🇬🇧 [Read the installation guide in English](INSTALLATION.md)*

# Guida all'Installazione

Albert è stato progettato per essere flessibile. Puoi avviarlo in due modalità:

1. **Versione Light (Raccomandata per sviluppo e test locale):** Include solo il database (PostgreSQL), il backend (Python/FastAPI) e il frontend (React). Utilizza un sistema di autenticazione JWT base interno.
2. **Versione Full (Produzione o per funzioni avanzate):** Include anche GoTrue (Supabase Auth) per gestire login OAuth (es. Google), invio email e Nginx come reverse proxy.

## Requisiti
- [Docker](https://docs.docker.com/get-docker/) e [Docker Compose](https://docs.docker.com/compose/install/)

---

## 🚀 Avvio Versione Light (Base)

Questa è la versione più semplice e lineare, perfetta se vuoi scaricare il progetto da GitHub e farlo partire sul tuo PC in pochi secondi.

1. **Clona il repository:**
   ```bash
   git clone https://github.com/tuo-utente/Albert.git
   cd Albert
   ```

2. **Configura le variabili d'ambiente:**
   Copia il file di esempio per creare il tuo file `.env`:
   ```bash
   cp .env.example .env
   ```
   *Nota: per la versione light non hai bisogno di configurare null'altro, le impostazioni base di default andranno bene per un test in locale.*

3. **Avvia i container base:**
   ```bash
   docker compose up -d
   ```

4. **Accedi all'applicazione:**
   - Frontend: [http://localhost:3001](http://localhost:3001)
   - Backend API Docs: [http://localhost:8001/docs](http://localhost:8001/docs)

---

## 🛠️ Avvio Versione Full (Con Auth Avanzata e Nginx)

Se vuoi utilizzare Google OAuth, email transazionali e avere Nginx come proxy, dovrai avviare la versione completa usando i "Profili" di Docker Compose.

1. Configura il file `.env` inserendo le chiavi `REACT_APP_SUPABASE_ANON_KEY`, le credenziali SMTP e le chiavi Google OAuth.
2. Avvia usando il profilo `full`:
   ```bash
   docker compose --profile full up -d
   ```
3. L'applicazione risponderà sulla porta 80 (o 443) tramite Nginx: [http://localhost](http://localhost).
