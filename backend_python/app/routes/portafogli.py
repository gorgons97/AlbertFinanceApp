from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models import Portafoglio, Utente
from .auth import get_current_user

router = APIRouter()


class PortafoglioCreate(BaseModel):
    nome: str


class PortafoglioOut(BaseModel):
    id_portafoglio: int
    nome: str
    valore: float

    class Config:
        orm_mode = True


# GET /api/portafogli — lista portafogli dell'utente
@router.get("/", response_model=list[PortafoglioOut])
def lista_portafogli(
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return user.portafogli


# POST /api/portafogli — aggiungi un nuovo portafoglio
@router.post("/", status_code=status.HTTP_201_CREATED, response_model=PortafoglioOut)
def crea_portafoglio(
    data: PortafoglioCreate,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    nome = data.nome.strip().capitalize()
    if not nome:
        raise HTTPException(status_code=400, detail="Il nome non puo' essere vuoto")

    # Controlla se il portafoglio esiste gia' per questo utente
    for pf in user.portafogli:
        if pf.nome.lower() == nome.lower():
            raise HTTPException(status_code=400, detail="Portafoglio gia' esistente")

    # Arrotonda l'importo a 2 decimali e gestisci valori nulli
    importo = round(data.importo, 2) if data.importo is not None else 0.0
    if importo < 0:
        raise HTTPException(status_code=400, detail="L'importo non puo' essere negativo")

    # Crea nuovo portafoglio (valore iniziale 0)
    nuovo = Portafoglio(nome=nome, valore=importo)
    db.add(nuovo)
    db.flush()  # per ottenere l'id
    user.portafogli.append(nuovo)
    db.commit()
    db.refresh(nuovo)
    return nuovo


# DELETE /api/portafogli/{id} — rimuovi un portafoglio dell'utente
@router.delete("/{portafoglio_id}")
def rimuovi_portafoglio(
    portafoglio_id: int,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Cerca il portafoglio tra quelli dell'utente
    pf = db.query(Portafoglio).filter(Portafoglio.id_portafoglio == portafoglio_id).first()
    if not pf:
        raise HTTPException(status_code=404, detail="Portafoglio non trovato")
    if pf not in user.portafogli:
        raise HTTPException(status_code=403, detail="Portafoglio non associato al tuo account")

    user.portafogli.remove(pf)
    db.commit()
    return {"message": f"Portafoglio '{pf.nome}' rimosso"}