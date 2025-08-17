Il repository contiene tutto,
quando però si fa un nuovo riallineamento bisogna prestare attenzione per il frontend, perchè vi è un gitignore che non scarica le librerie, quello che si deve fare in questo caso è:

npm install

e

npm run dev

nelle cartella del frontend per ricreare il progetto prima del docker-compose