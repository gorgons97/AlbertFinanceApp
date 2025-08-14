from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import auth

## Importa i moduli necessari per la creazione delle tabelle
#from .database import Base, engine
#from .models import Utente, Portafoglio, Categoria, Transazione # Importa tutti i tuoi modelli
#
## Funzione per creare le tabelle del database
#def create_tables():
#    print("Creazione delle tabelle del database...")
#    Base.metadata.create_all(bind=engine)
#    print("Tabelle create con successo!")
#
## Chiama la funzione prima di istanziare l'app
#create_tables()

app = FastAPI()

# Configura il middleware CORS
origins = [
    "http://localhost",
    "http://localhost:3000",  # L'URL del tuo frontend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Autenticazione"])

@app.get("/")
def read_root():
    return {"message": "Benvenuto nel tuo backend!"}