# Utilizza l'immagine ufficiale Node.js come base
FROM node:20-alpine

# Imposta la directory di lavoro all'interno del container
WORKDIR /app

# Copia i file package.json e package-lock.json per installare le dipendenze
COPY package*.json ./

# Installa le dipendenze NEL CONTAINER (con permessi Linux corretti)
# RUN npm ci --only=production --silent
# Oppure se hai problemi di dipendenze:
RUN npm install --silent --legacy-peer-deps

# Copia il resto del codice del frontend
COPY . .

EXPOSE 3000

# Avvia l'applicazione in modalità sviluppo
CMD ["npm", "start"]
