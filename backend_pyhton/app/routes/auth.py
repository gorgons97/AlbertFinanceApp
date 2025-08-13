from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from ..database import get_db
from ..models import Utente

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Endpoint per la registrazione
@router.post("/registrazione", status_code=status.HTTP_201_CREATED)
def registra_utente(nome: str, email: str, password: str, db: Session = Depends(get_db)):
    # Controlla se l'utente esiste già
    db_utente = db.query(Utente).filter(Utente.email == email).first()
    if db_utente:
        raise HTTPException(status_code=400, detail="Email già registrata")

    # Hasher la password
    hashed_password = pwd_context.hash(password)
    
    # Crea il nuovo utente e salvalo nel DB
    nuovo_utente = Utente(nome=nome, email=email, password_hash=hashed_password)
    db.add(nuovo_utente)
    db.commit()
    db.refresh(nuovo_utente)
    return {"message": "Utente registrato con successo"}

# Endpoint per il login
@router.post("/login")
def login_utente(email: str, password: str, db: Session = Depends(get_db)):
    # Trova l'utente per email
    utente = db.query(Utente).filter(Utente.email == email).first()
    if not utente:
        raise HTTPException(status_code=401, detail="Credenziali non valide")
    
    # Verifica la password
    if not pwd_context.verify(password, utente.password_hash):
        raise HTTPException(status_code=401, detail="Credenziali non valide")
    
    # Qui potresti generare un token JWT per l'autenticazione
    return {"message": "Login avvenuto con successo", "utente_id": utente.id_utente}