from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date as date_type

from ..database import get_db
from ..models import Utente, TIPO_TRANSAZIONE_REV
from .auth import get_current_user, pwd_context
from ..services import eliminazione

router = APIRouter()


class EliminazioneRequest(BaseModel):
    password: str


class EliminaTransazioniFiltrateRequest(BaseModel):
    password: str
    tutto: bool = False
    tipi: Optional[list[str]] = None          # 'spesa','guadagno','trasferimento'
    id_categorie: Optional[list[int]] = None
    id_portafogli: Optional[list[int]] = None
    dal: Optional[str] = None                  # YYYY-MM-DD
    al: Optional[str] = None                   # YYYY-MM-DD


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


# POST /api/eliminazione/transazioni/filtrate — cancella transazioni con filtri
@router.post("/transazioni/filtrate")
def cancella_transazioni_filtrate(
    data: EliminaTransazioniFiltrateRequest,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _verifica_password(data.password, user)

    if not data.tutto and not (
        data.tipi or data.id_categorie or data.id_portafogli or data.dal or data.al
    ):
        raise HTTPException(
            status_code=400,
            detail="Seleziona almeno un filtro oppure scegli 'Tutto'",
        )

    if data.tutto:
        risultato = eliminazione.elimina_tutte_le_transazioni(user, db)
    else:
        tipi_int = [
            TIPO_TRANSAZIONE_REV[t] for t in (data.tipi or [])
            if t in TIPO_TRANSAZIONE_REV
        ]
        dal_d = date_type.fromisoformat(data.dal) if data.dal else None
        al_d = date_type.fromisoformat(data.al) if data.al else None
        risultato = eliminazione.elimina_transazioni_filtrate(
            user, db,
            tipi=tipi_int or None,
            id_categorie=data.id_categorie,
            id_portafogli=data.id_portafogli,
            dal=dal_d,
            al=al_d,
        )
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
