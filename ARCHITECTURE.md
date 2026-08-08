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

Accesso: http://localhost:3000
Backend: http://localhost:8000

## Database

```bash
docker exec -it albert_db psql -U albert -d albert_app
```