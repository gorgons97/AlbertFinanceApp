from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, validator
from decimal import Decimal
from ..database import get_db
from ..models import Portafoglio, Utente, TIPO_PORTAFOGLIO, TIPO_PORTAFOGLIO_REV
from .auth import get_current_user

router = APIRouter()

TIPI_VALIDI = list(TIPO_PORTAFOGLIO_REV.keys())  # ['generale','contanti','conti','carta di credito','risparmi']


def _tipo_str(tipo_int: int) -> str:
    return TIPO_PORTAFOGLIO.get(tipo_int, 'conti')


def _tipo_int(tipo_str: str) -> int:
    return TIPO_PORTAFOGLIO_REV.get(tipo_str, 3)


def _portafoglio_to_out(pf: Portafoglio, somma_altri: float = None) -> dict:
    """Converte un Portafoglio ORM in dict per l'output.
    Se e' di tipo 'generale', il valore e' la somma degli altri portafogli."""
    if pf.tipo == 1 and somma_altri is not None:  # generale
        valore = somma_altri
    else:
        valore = float(pf.valore) if pf.valore else 0.0
    return {
        "id_portafoglio": pf.id_portafoglio,
        "nome": pf.nome,
        "valore": valore,
        "tipo": _tipo_str(pf.tipo),
    }


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


# GET /api/portafogli — lista portafogli dell'utente (escluso generale)
@router.get("/", response_model=list[PortafoglioOut])
def lista_portafogli(
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ha_generale = any(pf.tipo == 1 for pf in user.portafogli)
    if not ha_generale:
        generale = Portafoglio(nome="Generale", valore=0, tipo=1)
        db.add(generale); db.flush()
        user.portafogli.append(generale)
        db.commit(); db.refresh(user)

    # Somma di tutti i portafogli non generali (per il calcolo del saldo)
    somma = sum(float(pf.valore) if pf.valore else 0.0 for pf in user.portafogli if pf.tipo != 1)
    # Restituisce solo i portafogli NON generali
    return [_portafoglio_to_out(pf, somma) for pf in user.portafogli if pf.tipo != 1]


# GET /api/portafogli/saldo — solo il saldo totale (somma di tutti i portafogli)
@router.get("/saldo")
def get_saldo(
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ha_generale = any(pf.tipo == 1 for pf in user.portafogli)
    if not ha_generale:
        generale = Portafoglio(nome="Generale", valore=0, tipo=1)
        db.add(generale); db.flush()
        user.portafogli.append(generale)
        db.commit(); db.refresh(user)

    somma = sum(float(pf.valore) if pf.valore else 0.0 for pf in user.portafogli if pf.tipo != 1)
    return {"saldo": round(somma, 2)}


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

    # Ogni utente puo' avere un solo portafoglio "generale"
    tipo_int = _tipo_int(data.tipo)
    if tipo_int == 1:  # generale
        for pf in user.portafogli:
            if pf.tipo == 1:
                raise HTTPException(status_code=400, detail="Esiste gia' un portafoglio generale")

    # Controlla duplicati per nome
    for pf in user.portafogli:
        if pf.nome.lower() == nome.lower():
            raise HTTPException(status_code=400, detail="Portafoglio gia' esistente")

    importo = round(data.importo, 2) if data.importo is not None else 0.0
    if importo < 0:
        raise HTTPException(status_code=400, detail="L'importo non puo' essere negativo")

    nuovo = Portafoglio(nome=nome, valore=importo, tipo=tipo_int)
    db.add(nuovo)
    db.flush()
    user.portafogli.append(nuovo)
    db.commit()
    db.refresh(nuovo)
    # Per il generale, il valore mostrato e' la somma degli altri
    somma = sum(float(pf.valore) if pf.valore else 0.0 for pf in user.portafogli if pf.tipo != 1)
    return _portafoglio_to_out(nuovo, somma)


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

    # Controlla duplicati nome
    for p in user.portafogli:
        if p.id_portafoglio != portafoglio_id and p.nome.lower() == nome.lower():
            raise HTTPException(status_code=400, detail="Esiste gia' un portafoglio con questo nome")

    tipo_int = _tipo_int(data.tipo)
    # Se si sta impostando a generale, controlla che non ce ne sia gia' un altro
    if tipo_int == 1:
        for p in user.portafogli:
            if p.id_portafoglio != portafoglio_id and p.tipo == 1:
                raise HTTPException(status_code=400, detail="Esiste gia' un portafoglio generale")

    importo = round(data.importo, 2) if data.importo is not None else 0.0
    if importo < 0:
        raise HTTPException(status_code=400, detail="L'importo non puo' essere negativo")

    pf.nome = nome
    pf.valore = importo
    pf.tipo = tipo_int
    db.commit()
    db.refresh(pf)

    somma = sum(float(p.valore) if p.valore else 0.0 for p in user.portafogli if p.tipo != 1)
    return _portafoglio_to_out(pf, somma)


# DELETE /api/portafogli/{id} — rimuovi un portafoglio dell'utente
@router.delete("/{portafoglio_id}")
def rimuovi_portafoglio(
    portafoglio_id: int,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pf = db.query(Portafoglio).filter(Portafoglio.id_portafoglio == portafoglio_id).first()
    if not pf:
        raise HTTPException(status_code=404, detail="Portafoglio non trovato")
    if pf not in user.portafogli:
        raise HTTPException(status_code=403, detail="Portafoglio non associato al tuo account")

    # Non permettere eliminazione del portafoglio generale
    if pf.tipo == 1:
        raise HTTPException(status_code=400, detail="Il portafoglio generale non puo' essere eliminato")

    user.portafogli.remove(pf)
    db.commit()
    return {"message": f"Portafoglio '{pf.nome}' rimosso"}