*🇬🇧 [Read the architecture documentation in English](ARCHITECTURE.md)*

# Albert — Architettura del Progetto

## Panoramica

Albert e' un gestore spese familiare multi-utente containerizzato con Docker.
Permette a piu' persone di tracciare le proprie spese su portafogli personali.

## Stack tecnologico

| Livello     | Tecnologia                  |
|------------|-----------------------------|
| Frontend   | React 19, React Router 7, Axios |
| Backend    | FastAPI (Python 3.9), SQLAlchemy, Pydantic |
| Database   | PostgreSQL 15               |
| Auth       | bcrypt (password), JWT      |
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
  valore           NUMERIC(10,2)
  tipo             SMALLINT NOT NULL DEFAULT 3
                   (1=generale, 2=contanti, 3=conti, 4=carta di credito, 5=risparmi)

utenti_portafogli      (tabella di join N:N)
  id_utente        INT FK -> utenti
  id_portafoglio   INT FK -> portafogli
  PK (id_utente, id_portafoglio)

categorie
  id_categoria     SERIAL PK
  nome             VARCHAR(100) UNIQUE
  tipo             SMALLINT NOT NULL DEFAULT 1
                   (1=spesa, 2=guadagno, 3=trasferimento)

utenti_categorie       (tabella di join N:N)
  id_utente        INT FK -> utenti
  id_categoria     INT FK -> categorie
  PK (id_utente, id_categoria)

transazioni
  id_transazione   SERIAL PK
  id_utente        INT FK -> utenti
  id_portafoglio   INT FK -> portafogli
  id_categoria     INT FK -> categorie
  tipo             SMALLINT NOT NULL DEFAULT 1
                   (1=spesa, 2=guadagno, 3=trasferimento)
  importo          NUMERIC(10,2)
  descrizione      TEXT
  data_transazione DATE
  ora_transazione  TIME
  nascosto         BOOLEAN DEFAULT FALSE
  link_allegato    TEXT
  id_transazione_collegata INT FK -> transazioni (per trasferimenti)
```

---

## API endpoints

| Method | Path                        | Descrizione                         | Auth |
|--------|-----------------------------|-------------------------------------|------|
| GET    | /                           | Health check                        | No   |
| POST   | /api/auth/registrazione     | Crea utente + portafoglio generale  | No   |
| POST   | /api/auth/login             | Login (JWT)                         | No   |
| POST   | /api/auth/reset-password    | Reset password                      | No   |
| GET    | /api/portafogli/            | Lista portafogli (no generale)      | JWT  |
| GET    | /api/portafogli/saldo       | Saldo totale                        | JWT  |
| POST   | /api/portafogli/            | Crea portafoglio                    | JWT  |
| PUT    | /api/portafogli/{id}        | Modifica portafoglio                | JWT  |
| DELETE | /api/portafogli/{id}        | Rimuovi portafoglio                 | JWT  |
| GET    | /api/categorie/             | Lista categorie                     | JWT  |
| GET    | /api/categorie/per-tipo/{t} | Filtra per tipo (spesa/guadagno)    | JWT  |
| POST   | /api/categorie/             | Crea categoria                      | JWT  |
| PUT    | /api/categorie/{id}         | Modifica categoria                  | JWT  |
| DELETE | /api/categorie/{id}         | Rimuovi categoria                   | JWT  |
| GET    | /api/transazioni/           | Lista transazioni (?mese=YYYY-MM)   | JWT  |
| POST   | /api/transazioni/           | Crea transazione                    | JWT  |
| PUT    | /api/transazioni/{id}       | Modifica transazione                | JWT  |
| DELETE | /api/transazioni/{id}       | Elimina transazione                 | JWT  |
| POST   | /api/transazioni/trasferimento | Trasferimento tra portafogli     | JWT  |
| POST   | /api/backup/import          | Importa XLSX/CSV                    | JWT  |
| GET    | /api/backup/export          | Scarica backup CSV                  | JWT  |

---

## Feature principali

### Portafogli
- 4 tipi selezionabili: Contanti, Conti, Carta di credito, Risparmi
- "Generale" gestito automaticamente (creato alla registrazione, nascosto dalla lista)
- Saldo visibile nella card Saldo della Dashboard
- Ogni portafoglio mostra il saldo calcolato da transazioni
- Modifica e eliminazione con conferma

### Categorie
- 3 tipi: Spesa, Guadagno, Trasferimento
- Filtro automatico nel form transazioni in base al tipo selezionato
- Condivise tra utenti (se stesso nome+tipo, vengono riusate)

### Transazioni
- Spesa/Guadagno con portafoglio, categoria, importo, descrizione
- Trasferimento: crea due transazioni collegate (uscita + entrata)
- Modifica inline con update automatico dei saldi
- Eliminazione con aggiornamento saldi
- Categorie di trasferimento create automaticamente

### Dashboard
- Card reali: Spese mese, Entrate mese, Saldo totale
- Lista transazioni del mese corrente
- FAB (+) apre modale di aggiunta rapida

### Backup
- Import da XLSX (Money Manager) o CSV
- Crea automaticamente portafogli, categorie e transazioni mancanti
- Export CSV scaricabile con tutte le transazioni

---

## Avvio

```bash
cd frontend && npm install          # solo prima volta
docker compose up --build
```

Accesso: http://localhost:3001
Backend: http://localhost:8001
Database: localhost:5433

## Porte

| Servizio  | Host  | Container |
|-----------|-------|-----------|
| Frontend  | 3001  | 3000     |
| Backend   | 8001  | 8000     |
| Database  | 5433  | 5432     |

## Database

```bash
docker exec -it albert_db psql -U albert -d albert_app -p 5432
```

---

## Deploy in produzione (VPS + HTTPS)

L'app e' pensata per girare dietro un reverse proxy (nginx) che termina TLS.
I container restano su HTTP interno; e' nginx a cifrare il traffico.

### Variabili d'ambiente (file `.env` nella root del progetto)

| Variabile            | Descrizione                                                    | Default (dev)                        |
|----------------------|----------------------------------------------------------------|--------------------------------------|
| `SECRET_KEY`         | Chiave firma JWT — **obbligatoria in produzione**, lunga e casuale | chiave-di-sviluppo-NON-usare-in-produzione |
| `CORS_ORIGINS`       | Origini consentite, virgola-separate (es. `https://albert.tuodominio.it`) | `*` (tutte, solo dev) |
| `REACT_APP_API_BASE` | Override URL API del frontend (in produzione: `/api`)          | auto: `/api` se HTTPS, altrimenti `http://<host>:8001` |

Esempio `.env` per la VPS:

```
SECRET_KEY=$(openssl rand -hex 32)
CORS_ORIGINS=https://albert.tuodominio.it
REACT_APP_API_BASE=/api
```

### Reverse proxy

Config nginx completa in `deploy/nginx-vps.conf` (redirect HTTP->HTTPS, proxy
frontend su 127.0.0.1:3001, proxy `/api` sul backend 127.0.0.1:8001, headers di
sicurezza). Richiede un dominio (es. DuckDNS gratuito) + certificato Let's Encrypt
(`certbot --nginx -d TUODOMINIO.it`).

Dopo l'attivazione di nginx, chiudere le porte dirette dei container:

```bash
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw deny 3001/tcp && ufw deny 8001/tcp
ufw enable
```

### Produzione (VPS) — file dedicati

| File                     | Ruolo                                                        |
|--------------------------|--------------------------------------------------------------|
| `docker-compose.prod.yml`| Compose di produzione: nessuna porta pubblica per db/backend/frontend, servizio nginx incluso (80/443) |
| `nginx/nginx.prod.conf`  | Config nginx con dominio + certificati Let's Encrypt (sostituire `TUODOMINIO.it`) |
| `.env-vps.example`       | Template delle variabili per la VPS → copiare in `.env-vps` (mai committato) |

Avvio in produzione:

```bash
cp .env-vps.example .env-vps          # poi modifica i valori
# ottenere il certificato (prima di avviare nginx):
docker run --rm -v /etc/letsencrypt:/etc/letsencrypt -p 80:80 \
  certbot/certbot certonly --standalone -d TUODOMINIO.it \
  --non-interactive --agree-tos -m TUOEMAIL@example.com
docker compose --env-file .env-vps -f docker-compose.prod.yml up -d --build
```

### Nota sicurezza

Il frontend gira con il dev server webpack: accettabile per test, ma in produzione
a lungo termine e' consigliato servire la build statica (`npm run build`) da nginx.
```

docker compose --env-file .env-vps -f docker-compose.prod.yml up -d --build
