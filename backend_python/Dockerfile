# Dockerfile nel tuo progetto backend_python
FROM python:3.9-slim

# Installa netcat, un'utilità essenziale per lo script di attesa
RUN apt-get update && apt-get install -y netcat-openbsd

WORKDIR /app

# Copia i requisiti e installa le dipendenze
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install sqlalchemy-utils

# Copia tutto il codice dell'applicazione
COPY . .

# Rendi lo script di entrypoint eseguibile
RUN chmod +x ./entrypoint.sh

# Usa lo script di entrypoint per avviare il container
CMD ["/bin/bash", "./entrypoint.sh"]