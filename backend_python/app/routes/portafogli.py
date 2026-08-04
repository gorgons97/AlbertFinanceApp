from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, validator
from ..database import get_db
from ..models import Portafoglio, Utente
from .auth import get_current_user

router = APIRouter()

TIPI_VALIDI = ['contanti', 'conti', 'carta di credito', 'risparmi']


class PortafoglioCreate(BaseModel):
    nome: str
    importo: float = 0.0
    tipo: str = 'conti'

    @validator('tipo')
    def valida_tipo(cls, v):
        if v not in TIPI_VALIDI:
            raise ValueError(f"Tipo non valido. Scegli tra: {', '.join(TIPI_VALIDI)}")
        return v


class PortafoglioUpdate(BaseModel):
    nome: str
    importo: float = 0.0
    tipo: str = 'conti'

    @validator('tipo')
    def valida_tipo(cls, v):
        if v not in TIPI_VALIDI:
            raise ValueError(f"Tipo non valido. Scegli tra: {', '.join(TIPI_VALIDI)}")
        return v


class PortafoglioOut(BaseModel):
    id_portafoglio: int
    nome: str
    valore: float
    tipo: str

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

    # Crea nuovo portafoglio
    nuovo = Portafoglio(nome=nome, valore=importo, tipo=data.tipo)
    db.add(nuovo)
    db.flush()  # per ottenere l'id
    user.portafogli.append(nuovo)
    db.commit()
    db.refresh(nuovo)
    return nuovo


# PUT /api/portafogli/{id} — modifica un portafoglio
@router.put("/{portafoglio_id}", response_model=PortafoglioOut)
def modifica_portafoglio(
    portafoglio_id: int,
    data: PortafoglioUpdate,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pf = db.query(Portafoglio).filter(Portafoglio.id_portafoglio == portafoglio_id).first()
    if not pf:
        raise HTTPException(status_code=404, detail="Portafoglio non trovato")
    if pf not in user.portafogli:
        raise HTTPException(status_code=403, detail="Portafoglio non associato al tuo account")

    nome = data.nome.strip().capitalize()
    if not nome:
        raise HTTPException(status_code=400, detail="Il nome non puo' essere vuoto")

    # Controlla duplicati (escludendo se stesso)
    for p in user.portafogli:
        if p.id_portafoglio != portafoglio_id and p.nome.lower() == nome.lower():
            raise HTTPException(status_code=400, detail="Esiste gia' un portafoglio con questo nome")

    importo = round(data.importo, 2) if data.importo is not None else 0.0
    if importo < 0:
        raise HTTPException(status_code=400, detail="L'importo non puo' essere negativo")

    pf.nome = nome
    pf.valore = importo
    pf.tipo = data.tipo
    db.commit()
    db.refresh(pf)
    return pf


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
