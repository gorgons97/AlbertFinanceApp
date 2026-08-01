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

    class Config:
        orm_mode = True


# GET /api/categorie — lista categorie dell'utente
@router.get("/", response_model=list[PortafoglioOut])
def lista_categorie(
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return user.categorie


# POST /api/categorie — aggiungi una nuova portafoglio
@router.post("/", status_code=status.HTTP_201_CREATED, response_model=PortafoglioOut)
def crea_portafoglio(
    data: PortafoglioCreate,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    nome = data.nome.strip().capitalize()
    if not nome:
        raise HTTPException(status_code=400, detail="Il nome non puo' essere vuoto")

    # Controlla se la portafoglio esiste gia' (globale o dell'utente)
    for cat in user.categorie:
        if cat.nome.lower() == nome.lower():
            raise HTTPException(status_code=400, detail="Portafoglio gia' esistente")

    # Cerca se esiste gia' una portafoglio globale con lo stesso nome
    existing = db.query(Portafoglio).filter(Portafoglio.nome.ilike(nome)).first()
    if existing:
        # Associa la portafoglio esistente all'utente
        user.categorie.append(existing)
        db.commit()
        db.refresh(existing)
        return existing

    # Crea nuova portafoglio
    nuova = Portafoglio(nome=nome)
    db.add(nuova)
    db.flush()  # per ottenere l'id
    user.categorie.append(nuova)
    db.commit()
    db.refresh(nuova)
    return nuova


# DELETE /api/categorie/{id} — rimuovi una portafoglio dell'utente
@router.delete("/{portafoglio_id}")
def rimuovi_portafoglio(
    portafoglio_id: int,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Cerca la portafoglio tra quelle dell'utente
    cat = db.query(Portafoglio).filter(Portafoglio.id_portafoglio == portafoglio_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Portafoglio non trovata")
    if cat not in user.categorie:
        raise HTTPException(status_code=403, detail="Portafoglio non associata al tuo account")

    user.categorie.remove(cat)
    db.commit()
    return {"message": f"Portafoglio '{cat.nome}' rimosso"}
