*🇬🇧 [Read documentation in English](README.md)*

# Albert — Gestore Spese Familiare

Applicazione web per la gestione delle spese familiari con supporto multi-utente
e portafogli cointestati, completamente containerizzata con Docker.

## Avvio rapido

Per le istruzioni su come avviare l'applicazione in **modalità Light** (semplice) o **Full** (produzione), consulta la **[Guida all'Installazione](./INSTALLATION_it.md)**.

## Struttura

```
Albert/
├── docker-compose.yml        # Servizi: db, backend, frontend
├── ARCHITECTURE_it.md           # Documentazione tecnica completa
├── backend_python/           # API FastAPI (Python)
├── frontend/                 # UI React
└── docker/postgres/          # Schema DDL del database
```

## Tecnologie

React 19 · FastAPI · PostgreSQL 15 · Docker · SQLAlchemy · JWT

## Documentazione

Per dettagli su architettura, schema DB, API e bug noti, vedi [ARCHITECTURE_it.md](./ARCHITECTURE_it.md).

## Prima Registrazione

Dopo aver fatto la prima registrazione per poter caricare la prima transazione dovrete necessariamente aver creato dei portafogli e delle categorie, sennò non potrete caricare nessuna transazione


