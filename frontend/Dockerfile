# Utilizza l'immagine ufficiale Node.js come base
FROM node:20-alpine

# Imposta la directory di lavoro all'interno del container
WORKDIR /app

# Aggiungi questa riga per cambiare i permessi
RUN chmod -R 777 /app

# Copia i file package.json e package-lock.json per installare le dipendenze
COPY package*.json ./

# Installa le dipendenze
RUN npm install --legacy-peer-deps

# Copia il resto del codice del frontend
COPY . .

# Avvia l'applicazione in modalità sviluppo (sarà accessibile dall'esterno)
CMD ["npm", "start"]