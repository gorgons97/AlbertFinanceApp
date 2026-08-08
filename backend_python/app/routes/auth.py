from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
from ..database import get_db
from ..models import Utente, Portafoglio

# Configurazione JWT
SECRET_KEY = "chiave-segreta-temporanea-da-spostare-in-env"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 ore

class UserCreate(BaseModel):
    nome: str
    cognome: str
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ResetPasswordRequest(BaseModel):
    email: str
    new_password: str

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__truncate_error=True)


def create_access_token(data: dict) -> str:
    """Genera un token JWT con scadenza."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# Endpoint per la registrazione
@router.post("/registrazione", status_code=status.HTTP_201_CREATED)
def registra_utente(user: UserCreate, db: Session = Depends(get_db)):
    # Controlla se l'utente esiste gia'
    db_utente = db.query(Utente).filter(Utente.email == user.email).first()
    if db_utente:
        raise HTTPException(status_code=400, detail="Email gia' registrata")

    # Hasher la password
    hashed_password = pwd_context.hash(user.password)

    # Crea il nuovo utente e salvalo nel DB
    nuovo_utente = Utente(
        nome=user.nome, cognome=user.cognome,
        email=user.email, password_hash=hashed_password
    )
    db.add(nuovo_utente)
    db.commit()
    db.refresh(nuovo_utente)

    # Crea il portafoglio "Generale" automaticamente
    portafoglio_generale = Portafoglio(nome="Generale", valore=0, tipo=1)
    db.add(portafoglio_generale)
    db.flush()
    nuovo_utente.portafogli.append(portafoglio_generale)
    db.commit()

    # Genera token JWT e lo restituisce subito (login automatico)
    token = create_access_token(data={"sub": str(nuovo_utente.id_utente)})
    return {
        "message": "Utente registrato con successo",
        "utente_id": nuovo_utente.id_utente,
        "access_token": token,
        "token_type": "bearer",
    }


# Endpoint per il login
@router.post("/login", response_model=Token)
def login_utente(login: LoginRequest, db: Session = Depends(get_db)):
    # Trova l'utente per email
    utente = db.query(Utente).filter(Utente.email == login.email).first()
    if not utente:
        raise HTTPException(status_code=401, detail="Credenziali non valide")

    # Verifica la password
    if not pwd_context.verify(login.password, utente.password_hash):
        raise HTTPException(status_code=401, detail="Credenziali non valide")

    # Genera token JWT
    token = create_access_token(data={"sub": str(utente.id_utente)})
    return {
        "access_token": token,
        "token_type": "bearer",
    }


# Endpoint per il reset password (locale, senza verifica email)
@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    utente = db.query(Utente).filter(Utente.email == data.email).first()
    if not utente:
        raise HTTPException(status_code=404, detail="Email non trovata")

    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="La password deve avere almeno 8 caratteri")

    utente.password_hash = pwd_context.hash(data.new_password)
    db.commit()
    return {"message": "Password aggiornata con successo"}


# Dipendenza per proteggere le route: estrae l'utente dal token JWT
def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)) -> Utente:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token mancante")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Token non valido")

    utente = db.query(Utente).filter(Utente.id_utente == user_id).first()
    if not utente:
        raise HTTPException(status_code=401, detail="Utente non trovato")
    return utente
