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
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabella Portafoglio
CREATE TABLE portafogli (
    id_portafoglio SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descrizione TEXT
);

-- Tabella di collegamento Utente <-> Portafoglio
CREATE TABLE utenti_portafogli (
    id_utente INT NOT NULL,
    id_portafoglio INT NOT NULL,
    PRIMARY KEY (id_utente, id_portafoglio),
    FOREIGN KEY (id_utente) REFERENCES utenti(id_utente) ON DELETE CASCADE,
    FOREIGN KEY (id_portafoglio) REFERENCES portafogli(id_portafoglio) ON DELETE CASCADE
);

-- Tabella Categoria
CREATE TABLE categorie (
    id_categoria SERIAL PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL
);

-- Tabella di collegamento Utente <-> Categoria
CREATE TABLE utenti_categorie (
    id_utente INT NOT NULL,
    id_categoria INT NOT NULL,
    PRIMARY KEY (id_utente, id_categoria),
    FOREIGN KEY (id_utente) REFERENCES utenti(id_utente) ON DELETE CASCADE,
    FOREIGN KEY (id_categoria) REFERENCES categorie(id_categoria) ON DELETE CASCADE
);

-- Tabella Transazione
CREATE TABLE transazioni (
    id_transazione SERIAL PRIMARY KEY,
    id_utente INT NOT NULL,
    id_portafoglio INT NOT NULL,
    id_categoria INT NOT NULL,
    valore NUMERIC(10, 2) NOT NULL,
    data_transazione DATE NOT NULL DEFAULT CURRENT_DATE,
    ora_transazione TIME NOT NULL DEFAULT CURRENT_TIME,
    nascosto BOOLEAN DEFAULT FALSE,
    link_allegato TEXT,
    FOREIGN KEY (id_utente) REFERENCES utenti(id_utente) ON DELETE CASCADE,
    FOREIGN KEY (id_portafoglio) REFERENCES portafogli(id_portafoglio) ON DELETE CASCADE,
    FOREIGN KEY (id_categoria) REFERENCES categorie(id_categoria) ON DELETE RESTRICT
);