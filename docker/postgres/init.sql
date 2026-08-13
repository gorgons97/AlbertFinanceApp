-- Crea il database se non esiste
CREATE DATABASE albert_app;
CREATE USER "albert" WITH PASSWORD 'AlbertPig2025!';
GRANT ALL PRIVILEGES ON DATABASE albert_app TO "albert";

-- Connettiti al database per creare le tabelle
\c albert_app;

-- Tabella Utente
CREATE TABLE utenti (
    id_utente SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cognome VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabella Portafoglio (tipo: 1=generale 2=contanti 3=conti 4=carta di credito 5=risparmi)
CREATE TABLE portafogli (
    id_portafoglio SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    valore NUMERIC(10, 2) NOT NULL,
    tipo SMALLINT NOT NULL DEFAULT 3
);

-- Tabella di collegamento Utente <-> Portafoglio
CREATE TABLE utenti_portafogli (
    id_utente INT NOT NULL,
    id_portafoglio INT NOT NULL,
    ruolo SMALLINT NOT NULL DEFAULT 1,
    data_aggiunta TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_utente, id_portafoglio),
    FOREIGN KEY (id_utente) REFERENCES utenti(id_utente) ON DELETE CASCADE,
    FOREIGN KEY (id_portafoglio) REFERENCES portafogli(id_portafoglio) ON DELETE CASCADE
);

-- Tabella Categoria (tipo: 1=spesa 2=guadagno 3=trasferimento)
-- UNIQUE composto (nome, tipo): permette stessa categoria con tipo diverso (es. "Altro" spesa e "Altro" guadagno)
CREATE TABLE categorie (
    id_categoria SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    tipo SMALLINT NOT NULL DEFAULT 1,
    UNIQUE (nome, tipo)
);

-- Tabella di collegamento Utente <-> Categoria
CREATE TABLE utenti_categorie (
    id_utente INT NOT NULL,
    id_categoria INT NOT NULL,
    PRIMARY KEY (id_utente, id_categoria),
    FOREIGN KEY (id_utente) REFERENCES utenti(id_utente) ON DELETE CASCADE,
    FOREIGN KEY (id_categoria) REFERENCES categorie(id_categoria) ON DELETE CASCADE
);

-- Tabella Transazione (tipo: 1=spesa 2=guadagno 3=trasferimento)
CREATE TABLE transazioni (
    id_transazione SERIAL PRIMARY KEY,
    id_utente INT NOT NULL,
    id_portafoglio INT NOT NULL,
    id_categoria INT NOT NULL,
    tipo SMALLINT NOT NULL DEFAULT 1,
    importo NUMERIC(10, 2) NOT NULL,
    descrizione TEXT,
    data_transazione DATE NOT NULL DEFAULT CURRENT_DATE,
    ora_transazione TIME NOT NULL DEFAULT CURRENT_TIME,
    nascosto BOOLEAN DEFAULT FALSE,
    link_allegato TEXT,
    id_transazione_collegata INT,
    FOREIGN KEY (id_utente) REFERENCES utenti(id_utente) ON DELETE CASCADE,
    FOREIGN KEY (id_portafoglio) REFERENCES portafogli(id_portafoglio) ON DELETE CASCADE,
    FOREIGN KEY (id_categoria) REFERENCES categorie(id_categoria) ON DELETE RESTRICT,
    FOREIGN KEY (id_transazione_collegata) REFERENCES transazioni(id_transazione) ON DELETE SET NULL
);

-- Tabella Notifica (tipo: 1=invito_portafoglio 2=info 3=messaggio)
CREATE TABLE notifiche (
    id_notifica SERIAL PRIMARY KEY,
    id_utente INT NOT NULL,
    id_mittente INT,
    tipo SMALLINT NOT NULL DEFAULT 2,
    titolo VARCHAR(150) NOT NULL,
    messaggio TEXT,
    riferimento_id INT,
    letto BOOLEAN NOT NULL DEFAULT FALSE,
    data_creazione TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_utente) REFERENCES utenti(id_utente) ON DELETE CASCADE,
    FOREIGN KEY (id_mittente) REFERENCES utenti(id_utente) ON DELETE SET NULL
);
CREATE INDEX ix_notifiche_id_utente ON notifiche(id_utente);

-- Tabella Inviti Portafoglio (stato: 1=in_attesa 2=accettato 3=rifiutato 4=annullato)
CREATE TABLE inviti_portafogli (
    id_invito SERIAL PRIMARY KEY,
    id_portafoglio INT NOT NULL,
    id_invitante INT NOT NULL,
    email_invitato VARCHAR(100) NOT NULL,
    id_invitato INT,
    stato SMALLINT NOT NULL DEFAULT 1,
    data_creazione TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_risposta TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (id_portafoglio) REFERENCES portafogli(id_portafoglio) ON DELETE CASCADE,
    FOREIGN KEY (id_invitante) REFERENCES utenti(id_utente) ON DELETE CASCADE,
    FOREIGN KEY (id_invitato) REFERENCES utenti(id_utente) ON DELETE SET NULL
);