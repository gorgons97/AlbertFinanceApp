*🇮🇹 [Leggi la documentazione dell'architettura in Italiano](ARCHITECTURE_it.md)*

# Albert — Project Architecture

## Overview

Albert is a multi-user family expense manager containerized with Docker.
It allows multiple people to track their expenses on personal wallets.

## Technology Stack

| Layer       | Technology                  |
|-------------|-----------------------------|
| Frontend    | React 19, React Router 7, Axios |
| Backend     | FastAPI (Python 3.9), SQLAlchemy, Pydantic |
| Database    | PostgreSQL 15               |
| Auth        | bcrypt (password), JWT      |
| Container   | Docker + docker-compose     |

---

## Database Schema

```text
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
  valore           NUMERIC(10,2)
  tipo             SMALLINT NOT NULL DEFAULT 3
                   (1=general, 2=cash, 3=accounts, 4=credit card, 5=savings)

utenti_portafogli      (N:N join table)
  id_utente        INT FK -> utenti
  id_portafoglio   INT FK -> portafogli
  PK (id_utente, id_portafoglio)

categorie
  id_categoria     SERIAL PK
  nome             VARCHAR(100) UNIQUE
  tipo             SMALLINT NOT NULL DEFAULT 1
                   (1=expense, 2=income, 3=transfer)

utenti_categorie       (N:N join table)
  id_utente        INT FK -> utenti
  id_categoria     INT FK -> categorie
  PK (id_utente, id_categoria)

transazioni
  id_transazione   SERIAL PK
  id_utente        INT FK -> utenti
  id_portafoglio   INT FK -> portafogli
  id_categoria     INT FK -> categorie
  tipo             SMALLINT NOT NULL DEFAULT 1
                   (1=expense, 2=income, 3=transfer)
  importo          NUMERIC(10,2)
  descrizione      TEXT
  data_transazione DATE
  ora_transazione  TIME
  nascosto         BOOLEAN DEFAULT FALSE
  link_allegato    TEXT
  id_transazione_collegata INT FK -> transazioni (for transfers)
```

---

## API Endpoints

| Method | Path                           | Description                           | Auth |
|--------|--------------------------------|---------------------------------------|------|
| GET    | /                              | Health check                          | No   |
| POST   | /api/auth/registrazione        | Create user + general wallet          | No   |
| POST   | /api/auth/login                | Login (JWT)                           | No   |
| POST   | /api/auth/reset-password       | Reset password                        | No   |
| GET    | /api/portafogli/               | List wallets (no general)             | JWT  |
| GET    | /api/portafogli/saldo          | Total balance                         | JWT  |
| POST   | /api/portafogli/               | Create wallet                         | JWT  |
| PUT    | /api/portafogli/{id}           | Update wallet                         | JWT  |
| DELETE | /api/portafogli/{id}           | Remove wallet                         | JWT  |
| GET    | /api/categorie/                | List categories                       | JWT  |
| GET    | /api/categorie/per-tipo/{t}    | Filter by type (expense/income)       | JWT  |
| POST   | /api/categorie/                | Create category                       | JWT  |
| PUT    | /api/categorie/{id}            | Update category                       | JWT  |
| DELETE | /api/categorie/{id}            | Remove category                       | JWT  |
| GET    | /api/transazioni/              | List transactions (?mese=YYYY-MM)     | JWT  |
| POST   | /api/transazioni/              | Create transaction                    | JWT  |
| PUT    | /api/transazioni/{id}          | Update transaction                    | JWT  |
| DELETE | /api/transazioni/{id}          | Delete transaction                    | JWT  |
| POST   | /api/transazioni/trasferimento | Transfer between wallets              | JWT  |
| POST   | /api/backup/import             | Import XLSX/CSV                       | JWT  |
| GET    | /api/backup/export             | Download CSV backup                   | JWT  |

---

## Main Features

### Wallets
- 4 selectable types: Cash, Accounts, Credit card, Savings
- "General" is managed automatically (created upon registration, hidden from the list)
- Balance visible in the Balance card on the Dashboard
- Each wallet displays the balance calculated from transactions
- Update and delete with confirmation

### Categories
- 3 types: Expense, Income, Transfer
- Automatic filter in the transactions form based on the selected type
- Shared among users (if same name+type, they are reused)

### Transactions
- Expense/Income with wallet, category, amount, description
- Transfer: creates two linked transactions (outgoing + incoming)
- Inline editing with automatic balance updates
- Deletion with balance updates
- Transfer categories created automatically

### Dashboard
- Real cards: Monthly expenses, Monthly income, Total balance
- List of current month's transactions
- FAB (+) opens quick add modal

### Backup
- Import from XLSX (Money Manager) or CSV
- Automatically creates missing wallets, categories, and transactions
- Downloadable CSV export with all transactions

---

## Getting Started

```bash
cd frontend && npm install          # only first time
docker compose up --build
```

Access: http://localhost:3001
Backend: http://localhost:8001
Database: localhost:5433

## Ports

| Service   | Host  | Container |
|-----------|-------|-----------|
| Frontend  | 3001  | 3000      |
| Backend   | 8001  | 8000      |
| Database  | 5433  | 5432      |

## Database

```bash
docker exec -it albert_db psql -U albert -d albert_app -p 5432
```

---

## Production Deployment (VPS + HTTPS)

The app is designed to run behind a reverse proxy (nginx) that terminates TLS.
The containers remain on internal HTTP; nginx encrypts the traffic.

### Environment Variables (`.env` file in project root)

| Variable             | Description                                                    | Default (dev)                        |
|----------------------|----------------------------------------------------------------|--------------------------------------|
| `SECRET_KEY`         | JWT signature key — **mandatory in production**, long and random | chiave-di-sviluppo-NON-usare-in-produzione |
| `CORS_ORIGINS`       | Allowed origins, comma-separated (e.g. `https://albert.yourdomain.com`) | `*` (all, dev only) |
| `REACT_APP_API_BASE` | Frontend API URL override (in production: `/api`)          | auto: `/api` if HTTPS, otherwise `http://<host>:8001` |

Example `.env` for the VPS:

```
SECRET_KEY=$(openssl rand -hex 32)
CORS_ORIGINS=https://albert.yourdomain.com
REACT_APP_API_BASE=/api
```

### Reverse Proxy

Full nginx config in `deploy/nginx-vps.conf` (HTTP->HTTPS redirect, frontend proxy on 127.0.0.1:3001, `/api` proxy on backend 127.0.0.1:8001, security headers). Requires a domain (e.g. free DuckDNS) + Let's Encrypt certificate (`certbot --nginx -d YOURDOMAIN.com`).

After enabling nginx, close the direct container ports:

```bash
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw deny 3001/tcp && ufw deny 8001/tcp
ufw enable
```

### Production (VPS) — Dedicated Files

| File                     | Role                                                         |
|--------------------------|--------------------------------------------------------------|
| `docker-compose.prod.yml`| Production compose: no public port for db/backend/frontend, nginx service included (80/443) |
| `nginx/nginx.prod.conf`  | nginx config with domain + Let's Encrypt certificates (replace `YOURDOMAIN.com`) |
| `.env-vps.example`       | Variables template for the VPS → copy to `.env-vps` (never committed) |

Starting in production:

```bash
cp .env-vps.example .env-vps          # then modify the values
# get the certificate (before starting nginx):
docker run --rm -v /etc/letsencrypt:/etc/letsencrypt -p 80:80 \
  certbot/certbot certonly --standalone -d YOURDOMAIN.com \
  --non-interactive --agree-tos -m YOUREMAIL@example.com
docker compose --env-file .env-vps -f docker-compose.prod.yml up -d --build
```

### Security Note

The frontend runs with the webpack dev server: acceptable for testing, but in long-term production, it is recommended to serve the static build (`npm run build`) via nginx.

```bash
docker compose --env-file .env-vps -f docker-compose.prod.yml up -d --build
```
