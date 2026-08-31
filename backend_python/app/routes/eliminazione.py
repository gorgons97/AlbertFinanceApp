from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..database import get_db
from ..models import Utente
from .auth import get_current_user, pwd_context
from ..services import eliminazione

router = APIRouter()


class EliminazioneRequest(BaseModel):
    password: str


def _verifica_password(password: str, user: Utente) -> None:
    """Verifica che la password fornita corrisponda a quella dell'utente."""
    if not password:
        raise HTTPException(status_code=400, detail="Inserisci la password per confermare")
    if not pwd_context.verify(password, user.password_hash):
        raise HTTPException(status_code=400, detail="Password non corretta")


# POST /api/eliminazione/transazioni — cancella tutte le transazioni dell'utente
@router.post("/transazioni")
def cancella_transazioni(
    data: EliminazioneRequest,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verifica_password(data.password, user)
    risultato = eliminazione.elimina_tutte_le_transazioni(user, db)
    db.commit()
    return {"message": "Transazioni eliminate", **risultato}


# POST /api/eliminazione/portafogli — cancella tutti i portafogli (escluso Generale)
@router.post("/portafogli")
def cancella_portafogli(
    data: EliminazioneRequest,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verifica_password(data.password, user)
    risultato = eliminazione.elimina_tutti_i_portafogli(user, db)
    db.commit()
    return {"message": "Portafogli eliminati", **risultato}


# POST /api/eliminazione/categorie — cancella tutte le categorie
@router.post("/categorie")
def cancella_categorie(
    data: EliminazioneRequest,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verifica_password(data.password, user)
    risultato = eliminazione.elimina_tutte_le_categorie(user, db)
    db.commit()
    return {"message": "Categorie eliminate", **risultato}


# POST /api/eliminazione/utente — cancella l'account e tutti i dati collegati
@router.post("/utente")
def cancella_utente(
    data: EliminazioneRequest,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verifica_password(data.password, user)
    risultato = eliminazione.elimina_utente(user, db)
    db.commit()
    return {"message": "Account eliminato", **risultato}
