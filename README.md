# Albert — Gestore Spese Familiare

Applicazione web per la gestione delle spese familiari con supporto multi-utente
e portafogli cointestati, completamente containerizzata con Docker.

## Avvio rapido

```bash
# 1. Installare dipendenze frontend (solo prima volta)
cd frontend && npm install && cd ..

# 2. Avviare tutti i container
docker compose up --build

# 3 Avviare la produzione con LetsEncript
docker compose --env-file .env-vps -f docker-compose.prod.yml up --build
```

I servizi saranno disponibili su:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Database**: localhost:5432

## Struttura

```
Albert/
├── docker-compose.yml        # Servizi: db, backend, frontend
├── ARCHITECTURE.md           # Documentazione tecnica completa
├── backend_python/           # API FastAPI (Python)
├── frontend/                 # UI React
└── docker/postgres/          # Schema DDL del database
```

## Tecnologie

React 19 · FastAPI · PostgreSQL 15 · Docker · SQLAlchemy · JWT

## Documentazione

Per dettagli su architettura, schema DB, API e bug noti, vedi [ARCHITECTURE.md](./ARCHITECTURE.md).

## Prima Registrazione

Dopo aver fatto la prima registrazione per poter caricare la prima transazione dovrete necessariamente aver creato dei portafogli e delle categorie, sennò non potrete caricare nessuna transazione


