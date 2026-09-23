from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
import os
import logging
from passlib.context import CryptContext
from jose import JWTError, jwt
from ..database import get_db
from ..models import Utente, Portafoglio

logger = logging.getLogger(__name__)

# Configurazione JWT
# In produzione SECRET_KEY va impostata come variabile d'ambiente (vedi docker-compose / .env):
#   SECRET_KEY="una-stringa-lunga-e-casuale"
_SECRET_KEY_DEFAULT = "chiave-di-sviluppo-NON-usare-in-produzione"
SECRET_KEY = os.environ.get("SECRET_KEY", _SECRET_KEY_DEFAULT)
if SECRET_KEY == _SECRET_KEY_DEFAULT:
    logger.warning(
        "ATTENZIONE: SECRET_KEY non impostata — si sta usando la chiave di sviluppo. "
        "NON usare in produzione!"
    )
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 ore
JWT_AUDIENCE = "authenticated"

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__truncate_error=True)


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
    remember_me: bool = False

class ResetPasswordRequest(BaseModel):
    email: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    password_attuale: str
    nuova_password: str

def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    """Genera un token JWT con scadenza e audience 'authenticated' (compatibile con GoTrue)."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "aud": JWT_AUDIENCE})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Dipendenza per proteggere le route: estrae l'utente dal token JWT (GoTrue o legacy)
def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)) -> Utente:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token mancante")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], audience=JWT_AUDIENCE)
        user_sub = payload.get("sub")
        if not user_sub:
            raise HTTPException(status_code=401, detail="Token non valido")
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Token non valido")

    user_sub_str = str(user_sub)

    # 1. Cerca per supabase_uid (token GoTrue)
    utente = db.query(Utente).filter(Utente.supabase_uid == user_sub_str).first()
    if utente:
        return utente

    # 2. Se sub è numerico, cerca per id_utente (vecchio token interno di Albert)
    if user_sub_str.isdigit():
        utente = db.query(Utente).filter(Utente.id_utente == int(user_sub_str)).first()
        if utente:
            return utente

    # 3. Se non trovato per sub, cerca per email dal token GoTrue e collega il supabase_uid
    token_email = payload.get("email")
    if token_email:
        email_clean = str(token_email).strip().lower()
        utente = db.query(Utente).filter(Utente.email.ilike(email_clean)).first()
        if utente:
            utente.supabase_uid = user_sub_str
            db.commit()
            db.refresh(utente)
            return utente

        # 4. Nuovo utente registrato tramite GoTrue: creiamo profilo Utente locale e portafoglio Generale
        user_meta = payload.get("user_metadata") or {}
        nome = user_meta.get("nome") or user_meta.get("given_name")
        cognome = user_meta.get("cognome") or user_meta.get("family_name")
        if not nome:
            full_name = user_meta.get("full_name") or user_meta.get("name")
            if full_name:
                parts = str(full_name).strip().split(" ", 1)
                nome = parts[0]
                if len(parts) > 1 and not cognome:
                    cognome = parts[1]
        nome = (nome or email_clean.split("@")[0]).strip().capitalize()
        cognome = (cognome or "").strip().capitalize()

        nuovo_utente = Utente(
            supabase_uid=user_sub_str,
            email=email_clean,
            nome=nome,
            cognome=cognome,
        )
        db.add(nuovo_utente)
        db.flush()

        portafoglio_generale = Portafoglio(nome="Generale", valore=0, tipo=1)
        db.add(portafoglio_generale)
        db.flush()
        nuovo_utente.portafogli.append(portafoglio_generale)
        db.commit()
        db.refresh(nuovo_utente)
        return nuovo_utente

    raise HTTPException(status_code=401, detail="Utente non trovato")


# Endpoint informativo sul profilo utente autenticato
@router.get("/me")
def get_me(user: Utente = Depends(get_current_user)):
    return {
        "id_utente": user.id_utente,
        "supabase_uid": user.supabase_uid,
        "nome": user.nome,
        "cognome": user.cognome,
        "email": user.email,
    }


# Endpoint per la registrazione
@router.post("/registrazione", status_code=status.HTTP_201_CREATED)
def registra_utente(user: UserCreate, db: Session = Depends(get_db)):
    db_utente = db.query(Utente).filter(Utente.email == user.email).first()
    if db_utente:
        raise HTTPException(status_code=400, detail="Email gia' registrata")

    hashed_password = pwd_context.hash(user.password)

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
    utente = db.query(Utente).filter(Utente.email == login.email).first()
    if not utente:
        raise HTTPException(status_code=401, detail="Credenziali non valide")

    if not pwd_context.verify(login.password, utente.password_hash):
        raise HTTPException(status_code=401, detail="Credenziali non valide")

    expires_delta = timedelta(days=30) if login.remember_me else None
    token = create_access_token(data={"sub": str(utente.id_utente)}, expires_delta=expires_delta)
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


# Endpoint per cambiare la password (utente autenticato)
@router.post("/change-password")
def change_password(
    data: ChangePasswordRequest,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not pwd_context.verify(data.password_attuale, user.password_hash):
        raise HTTPException(status_code=400, detail="Password attuale non corretta")

    if len(data.nuova_password) < 8:
        raise HTTPException(status_code=400, detail="La nuova password deve avere almeno 8 caratteri")

    user.password_hash = pwd_context.hash(data.nuova_password)
    db.commit()
    return {"message": "Password aggiornata con successo"}
