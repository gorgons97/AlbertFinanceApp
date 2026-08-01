#!/bin/bash
# entrypoint.sh - Script per attendere il database e avviare l'applicazione

# Host e porta del database (dal docker-compose.yml)
DB_HOST="db"
DB_PORT="5432"

echo "Attendo che il database sia disponibile su $DB_HOST:$DB_PORT..."

# Loop per attendere la disponibilità del database
while ! nc -z $DB_HOST $DB_PORT; do
  echo "Il database non è ancora disponibile. Riprovo in 1 secondo..."
  sleep 1
done

echo "Il database è disponibile! Avvio la creazione delle tabelle..."

# Esegue lo script Python per la creazione delle tabelle (tutti i modelli)
python -c "from app.database import Base, engine; from app.models import Utente, Portafoglio, Categoria, Transazione; Base.metadata.create_all(bind=engine)"

echo "Tabelle create. Avvio del server..."

# Avvia l'applicazione FastAPI con Uvicorn
exec uvicorn app.main:app --host 0.0.0.0 --port 8000