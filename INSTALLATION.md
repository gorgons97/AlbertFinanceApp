# Installation Guide

*🇮🇹 [Leggi la guida all'installazione in Italiano](INSTALLATION_it.md)*

Albert is designed to be flexible. You can run it in two modes:

1. **Light Version (Recommended for development and local testing):** Includes only the database (PostgreSQL), backend (Python/FastAPI), and frontend (React). Uses an internal basic JWT authentication system.
2. **Full Version (Production or advanced features):** Also includes GoTrue (Supabase Auth) to handle OAuth login (e.g., Google), transactional emails, and Nginx as a reverse proxy.

## Requirements
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

---

## 🚀 Start Light Version (Base)

This is the simplest and most straightforward version, perfect if you want to clone the project from GitHub and get it running on your PC in a few seconds.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/tuo-utente/Albert.git
   cd Albert
   ```

2. **Configure environment variables:**
   Copy the example file to create your `.env` file:
   ```bash
   cp .env.example .env
   ```
   *Note: for the light version you don't need to configure anything else; the default base settings will work fine for local testing.*

3. **Start the base containers:**
   ```bash
   docker compose up -d
   ```

4. **Access the application:**
   - Frontend: [http://localhost:3001](http://localhost:3001)
   - Backend API Docs: [http://localhost:8001/docs](http://localhost:8001/docs)

---

## 🛠️ Start Full Version (With Advanced Auth and Nginx)

If you want to use Google OAuth, transactional emails, and Nginx as a proxy, you will need to start the full version using Docker Compose "Profiles".

1. Configure the `.env` file by inserting your `REACT_APP_SUPABASE_ANON_KEY`, SMTP credentials, and Google OAuth keys.
2. Start using the `full` profile:
   ```bash
   docker compose --profile full up -d
   ```
3. The application will respond on port 80 (or 443) via Nginx: [http://localhost](http://localhost).
