# Albert — Family Expense Manager

*🇮🇹 [Leggi la documentazione in Italiano](README_it.md)*

A web application for family expense management with multi-user support and shared wallets, completely containerized with Docker.

## Quick Start

For instructions on how to start the application in **Light mode** (simple) or **Full mode** (production), check the **[Installation Guide](./INSTALLATION.md)**.

## Structure

```text
Albert/
├── docker-compose.yml        # Services: db, backend, frontend
├── ARCHITECTURE.md           # Complete technical documentation
├── backend_python/           # FastAPI backend (Python)
├── frontend/                 # React UI
└── docker/postgres/          # Database DDL schema
```

## Technologies

React 19 · FastAPI · PostgreSQL 15 · Docker · SQLAlchemy · JWT

## Documentation

For details on architecture, DB schema, API, and known bugs, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## First Registration

After completing your first registration, you must create at least one wallet and category before you can add any transactions.
