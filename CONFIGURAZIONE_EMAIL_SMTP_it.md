*🇬🇧 [Read the SMTP configuration guide in English](SMTP_EMAIL_CONFIGURATION.md)*

# Guida Configurazione Servizio Email (SMTP) per Albert

Questa guida descrive in dettaglio la procedura passo-passo per configurare l'invio delle email di sistema (recupero password, link di autenticazione e notifiche) tramite **GoTrue (Supabase Auth)**.

---

## 📌 Indice
1. [A cosa serve il servizio email](#1-a-cosa-serve-il-servizio-email)
2. [Opzione A: Creare un account Gmail dedicato (Google App Password)](#2-opzione-a-creare-un-account-gmail-dedicato)
3. [Opzione B: Utilizzare un provider SMTP transazionale (Consigliato per Produzione - Brevo)](#3-opzione-b-utilizzare-un-provider-smtp-transazionale-brevo)
4. [Configurazione dei file `.env`](#4-configurazione-dei-file-env)
5. [Applicazione delle modifiche con Docker](#5-applicazione-delle-modifiche-con-docker)
6. [Come testare e verificare l'invio](#6-come-testare-e-verificare-linvio)
7. [Risoluzione problemi comuni (Troubleshooting)](#7-risoluzione-problemi-comuni)

---

## 1. A cosa serve il servizio email

All'interno dell'ecosistema Albert, il motore di autenticazione **GoTrue** gestisce direttamente:
- **Reset della Password**: invio del link sicuro con token temporaneo (richiesto da `/forgot`).
- **Verifica dell'indirizzo email**: invio del link di conferma alla registrazione di nuovi utenti (se abilitato).
- **Magic Link**: login one-click tramite link inviato per email (se abilitato in futuro).

Senza un server SMTP configurato, GoTrue registra le richieste internamente ma non può recapitare le email nelle vere caselle di posta dei destinatari.

---

## 2. Opzione A: Creare un account Gmail dedicato

Se desideri utilizzare un indirizzo Gmail (es. `albertapp.noreply@gmail.com` o `albert.gestionale@gmail.com`), segui questi passaggi.

> [!IMPORTANT]
> Google ha dismesso l'"Accesso ad app meno sicure". **Non è possibile usare la normale password dell'account Google** all'interno dell'applicazione. È obbligatorio generare una **Password per le app** a 16 caratteri.

### Passo 1: Creazione dell'account Google
1. Vai su [accounts.google.com/signup](https://accounts.google.com/signup) e registra il nuovo account (es. `albert.noreply@gmail.com`).

### Passo 2: Attivazione della Verifica in due passaggi (2FA)
*La generazione della "Password per le app" è disponibile solo se la verifica in due passaggi è attiva.*
1. Accedi alla gestione account: [myaccount.google.com/security](https://myaccount.google.com/security).
2. Nella sezione **Come accedi a Google**, seleziona **Verifica in due passaggi**.
3. Segui le istruzioni per associarvi il tuo numero di telefono o un'app authenticator e attivala.

### Passo 3: Creazione della "Password per le app"
1. Visita direttamente il link: **[myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)**  
   *(oppure cercalo nella barra di ricerca delle impostazioni dell'account Google digitando "Password per le app")*.
2. Nel campo **Nome app**, scrivi: `Albert App` (o `Albert GoTrue`).
3. Clicca su **Crea**.
4. Verrà visualizzata una finestra con una password generata casualmente di 16 lettere (es. `abcd efgh ijkl mnop`).
5. **Copia questa password** (puoi scriverla senza spazi: `abcdefghijklmnop`). Non verrà più mostrata.

---

## 3. Opzione B: Utilizzare un provider SMTP transazionale (Brevo)

Per un ambiente di produzione (VPS), l'uso di un servizio SMTP transazionale dedicato come **Brevo** (ex Sendinblue) è spesso preferibile a Gmail perché:
- È **gratuito al 100% per sempre** fino a 300 email al giorno (più che sufficiente per uso personale/familiare).
- Non rischia blocchi improvvisi da parte dei filtri anti-abuso di Google.
- Ha una reputazione di deliverability più alta (le email non finiscono nello Spam).
- Non richiede di associare numeri di telefono personali a un account Gmail di servizio.

### Procedura con Brevo:
1. Registrati gratis su [brevo.com](https://www.brevo.com/).
2. Nel menu in alto a destra, clicca sul tuo profilo e seleziona **SMTP & API**.
3. Nella scheda **SMTP**, troverai:
   - **Host**: `smtp-relay.brevo.com`
   - **Porta**: `587`
   - **Login**: la tua email di accesso a Brevo
4. Clicca su **Genera una nuova chiave SMTP**, assegna un nome (es. `Albert Prod`) e copia la chiave generata. Quella sarà la tua `SMTP_PASS`.

---

## 4. Configurazione dei file `.env`

Apri il file `.env` (in locale) o `.env-vps` (sulla VPS) e compila la sezione dedicata all'SMTP:

### Configurazione con Gmail:
```env
# Configurazione SMTP per invio email reali (GoTrue)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=albert.noreply@gmail.com
SMTP_PASS=abcdefghijklmnop
SMTP_ADMIN_EMAIL=albert.noreply@gmail.com
```

### Configurazione con Brevo:
```env
# Configurazione SMTP per invio email reali (GoTrue)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=iltuologin@brevo.com
SMTP_PASS=xkeysib-tua-chiave-smtp-lunga
SMTP_ADMIN_EMAIL=noreply@albertapp.duckdns.org
```

---

## 5. Applicazione delle modifiche con Docker

Una volta salvato il file `.env`, riavvia il container di **GoTrue** in modo che recepisca le nuove variabili d'ambiente:

### In Locale:
```bash
docker compose up -d gotrue
```

### In Produzione sulla VPS:
```bash
docker compose -f docker-compose.prod.yml up -d gotrue
```

Per verificare che il container sia partito correttamente e senza errori:
```bash
docker logs -n 20 albert_gotrue
```

---

## 6. Come testare e verificare l'invio

### Test 1: Dall'interfaccia grafica
1. Apri la pagina di login di Albert (`http://localhost:3001/login` o `https://albertapp.duckdns.org/login`).
2. Clicca su **"Hai dimenticato la password?"**.
3. Inserisci un indirizzo email valido a cui hai accesso.
4. Clicca su **"Invia Link di Recupero"**.
5. Controlla la casella di posta dell'indirizzo inserito (verifica anche la cartella **Spam/Posta indesiderata**).
6. Clicca sul link ricevuto: si aprirà la pagina di Albert per impostare e confermare la nuova password.

### Test 2: Da riga di comando (curl)
Puoi verificare la chiamata direttamente dal terminale con:
```bash
curl -i -X POST http://localhost:9999/auth/v1/recover \
  -H "Content-Type: application/json" \
  -d '{"email":"latuamail@example.com"}'
```
Se la configurazione è corretta, riceverai una risposta HTTP `200 OK` (`{}`).

### Test 3: Verifica dei log di invio
Puoi monitorare l'invio in tempo reale guardando i log di GoTrue:
```bash
docker logs -f albert_gotrue
```
All'invio della richiesta vedrai comparire l'evento `method: POST`, `path: /recover` e l'eventuale conferma dell'invio via mailer.

---

## 7. Risoluzione problemi comuni (Troubleshooting)

| Errore / Sintomo | Causa | Soluzione |
| :--- | :--- | :--- |
| `535-5.7.8 Username and Password not accepted` (Gmail) | È stata usata la password normale dell'account Google anziché la Password per le app. | Attiva la 2FA e genera una [Password per le app](https://myaccount.google.com/apppasswords) a 16 caratteri. |
| Nessun errore a video ma l'email non arriva | L'email è finita nella cartella Spam o il mittente non è verificato. | Controlla lo Spam. Se usi Brevo, verifica il dominio o l'indirizzo mittente nelle impostazioni Mittenti di Brevo. |
| Timeout di connessione SMTP (porta 587) | La porta 587 in uscita è bloccata dal firewall o dal cloud provider. | Verifica le regole firewall in uscita del server o prova la porta alternativa `465` (SSL). |
| `400: User not found` | L'email inserita non è registrata nel database di Albert. | Esegui prima una registrazione con quell'email o verifica che l'indirizzo sia corretto. |
