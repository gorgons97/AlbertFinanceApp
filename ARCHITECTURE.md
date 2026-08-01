# Albert — Architettura del Progetto

## Panoramica

Albert e' un gestore spese familiare multi-utente containerizzato con Docker.
Permette a piu' persone di tracciare le proprie spese su portafogli personali
e cointestati. Una spesa su un portafoglio cointestato viene riflessa su tutti
i portafogli dei cointestatari.

## Stack tecnologico

| Livello     | Tecnologia                  |
|------------|-----------------------------|
| Frontend   | React 19, React Router 7, Axios |
| Backend    | FastAPI (Python 3.9), SQLAlchemy, Pydantic |
| Database   | PostgreSQL 15               |
| Auth       | bcrypt (password), JWT (da implementare) |
| Container  | Docker + docker-compose     |

---

## Schema del database

```
utenti
  id_utente        SERIAL PK
  nome             VARCHAR(100)
  cognome          VARCHAR(100)
  email            VARCHAR(100) UNIQUE
  password_hash    VARCHAR(255)
  data_creazione   TIMESTAMPTZ

portafogli
  id_portafoglio   SERIAL PK
  nome             VARCHAR(100)
  descrizione      TEXT

utenti_portafogli      (tabella di join N:N)
  id_utente        INT FK -> utenti
  id_portafoglio   INT FK -> portafogli
  PK (id_utente, id_portafoglio)

categorie
  id_categoria     SERIAL PK
  nome             VARCHAR(100) UNIQUE

utenti_categorie       (tabella di join N:N)
  id_utente        INT FK -> utenti
  id_categoria     INT FK -> categorie
  PK (id_utente, id_categoria)

transazioni
  id_transazione   SERIAL PK
  id_utente        INT FK -> utenti
  id_portafoglio   INT FK -> portafogli
  id_categoria     INT FK -> categorie
  valore           NUMERIC(10,2)
  data_transazione DATE
  ora_transazione  TIME
  nascosto         BOOLEAN DEFAULT FALSE
  link_allegato    TEXT
```

### Relazioni chiave

- Un utente puo' appartenere a N portafogli (personali + cointestati)
- Un portafoglio puo' avere N utenti (cointestazione)
- Una transazione appartiene a UN utente e UN portafoglio
- Una transazione ha UNA categoria
- Le categorie sono personali (legame N:N utente-categoria)
- DELETE CASCADE su utenti e portafogli, DELETE RESTRICT su categorie

---

## Struttura delle directory

```
Albert/
├── docker-compose.yml          # Orchestrazione container
├── entrypoint.sh               # (OBSOLETO - non usato, vedi backend_python/)
├── README.md                   # Istruzioni rapide
├── ARCHITECTURE.md             # Questo file
├── .gitignore
│
├── backend_python/
│   ├── Dockerfile
│   ├── entrypoint.sh           # Attesa DB -> crea tabelle -> avvia uvicorn
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── main.py             # App FastAPI, CORS, router
│       ├── database.py         # Connessione SQLAlchemy a PostgreSQL
│       ├── models.py           # Modelli ORM (solo Utente al momento)
│       └── routes/
│           ├── __init__.py
│           └── auth.py         # POST /registrazione, POST /login
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── App.js              # Router: /login, /register
│       └── components/
│           └── auth/
│               ├── Login.js
│               ├── Login.css
│               ├── Registrazione.js
│               └── Registrazione.css
│
└── docker/
    └── postgres/
        └── init.sql            # Schema DDL iniziale del database
```

---

## Flusso di avvio con Docker

1. `docker-compose up` avvia i 3 servizi in ordine:
   - **db**: PostgreSQL con init.sql che crea le tabelle
   - **backend**: attende il DB (healthcheck), crea le tabelle via SQLAlchemy, avvia uvicorn su :8000
   - **frontend**: React dev server su :3000, comunica con backend via axios su localhost:8000

2. Allineamento iniziale (prima volta):
   ```bash
   cd frontend && npm install    # solo se node_modules mancante
   docker-compose up --build
   ```

---

## API endpoints (attuali)

| Method | Path                     | Descrizione                  | Auth |
|--------|--------------------------|------------------------------|------|
| GET    | /                        | Health check backend          | No   |
| POST   | /api/auth/registrazione  | Crea nuovo utente             | No   |
| POST   | /api/auth/login          | Login (email+password in query)| No   |

### Da implementare

- [ ] `POST /api/auth/login` -> restituire JWT invece del solo messaggio
- [ ] CRUD `/api/portafogli` — gestione portafogli
- [ ] CRUD `/api/categorie` — gestione categorie personali
- [ ] CRUD `/api/transazioni` — gestione spese
- [ ] `GET  /api/report` — report/bilanci
- [ ] Dashboard frontend dopo login

---

## Bug noti / cose da sistemare

1. **Credenziali DB disallineate**: docker-compose crea utente `albert` sul DB `albert_app`,
   ma `database.py` ha `postgresql://financeuser:***@db:5432/financedb`.
   → Allineare a `albert`/`albert_app`.

2. **Modelli SQLAlchemy incompleti**: `models.py` ha solo `Utente`.
   Mancano `Portafoglio`, `Categoria`, `Transazione`, `UtentePortafoglio`, `UtenteCategoria`.

3. **Login senza JWT**: la route `/login` non genera token, restituisce solo
   `{"message": "...", "utente_id": ...}`. Serve `python-jose` (gia' in requirements).

4. **entrypoint.sh duplicato**: ce n'e' uno nella root del progetto (non referenziato
   da docker-compose) e uno corretto in `backend_python/`. Rimuovere quello in root.

5. **Password in chiaro nei file**: `docker-compose.yml`, `database.py` e `init.sql`
   contengono credenziali in chiaro. Valutare `.env` per produzione.
