from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel, validator
from datetime import datetime
from typing import Optional
from ..database import get_db
from ..models import (
    Portafoglio, Utente, Notifica, InvitoPortafoglio,
    utenti_portafogli,
    TIPO_PORTAFOGLIO, TIPO_PORTAFOGLIO_REV, RUOLO_PORTAFOGLIO,
)
from .auth import get_current_user
from ..services.eliminazione import esci_da_portafoglio

router = APIRouter()

TIPI_VALIDI = list(TIPO_PORTAFOGLIO_REV.keys())


def _tipo_str(tipo_int: int) -> str:
    return TIPO_PORTAFOGLIO.get(tipo_int, 'conti')


def _tipo_int(tipo_str: str) -> int:
    return TIPO_PORTAFOGLIO_REV.get(tipo_str, 3)


def _ruolo_utente(db: Session, id_utente: int, id_portafoglio: int) -> str:
    """Restituisce il ruolo dell'utente su un portafoglio."""
    r = db.execute(
        select(utenti_portafogli.c.ruolo).where(
            utenti_portafogli.c.id_utente == id_utente,
            utenti_portafogli.c.id_portafoglio == id_portafoglio,
        )
    ).scalar()
    return RUOLO_PORTAFOGLIO.get(r, 'cointestatario')


def _portafoglio_to_out(pf: Portafoglio, somma_altri: float = None, ruolo: str = None) -> dict:
    if pf.tipo == 1 and somma_altri is not None:
        valore = somma_altri
    else:
        valore = float(pf.valore) if pf.valore else 0.0
    return {
        "id_portafoglio": pf.id_portafoglio,
        "nome": pf.nome,
        "valore": valore,
        "tipo": _tipo_str(pf.tipo),
        "ruolo": ruolo,
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
    ruolo: Optional[str] = None

    class Config:
        orm_mode = True


class InvitaPortafoglioRequest(BaseModel):
    email: str


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
    # Restituisce solo i portafogli NON generali, con il ruolo dell'utente
    out = []
    for pf in user.portafogli:
        if pf.tipo == 1:
            continue
        out.append(_portafoglio_to_out(pf, somma, _ruolo_utente(db, user.id_utente, pf.id_portafoglio)))
    return out


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
    return _portafoglio_to_out(nuovo, somma, 'proprietario')


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
    return _portafoglio_to_out(pf, somma, _ruolo_utente(db, user.id_utente, portafoglio_id))


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

    # Solo il proprietario puo' eliminare
    if _ruolo_utente(db, user.id_utente, portafoglio_id) != 'proprietario':
        raise HTTPException(status_code=403, detail="Solo il proprietario puo' eliminare il portafoglio")

    # Delega al servizio di eliminazione, che gestisce proprieta' e orfani:
    #  - se l'owner e' l'UNICO membro      -> elimina la riga portafoglio (e le sue transazioni);
    #  - se l'owner ha cointestatari       -> trasferisce la proprieta' al membro piu' anziano
    #    e rimuove la sua associazione (mai portafogli senza proprietario);
    #  - il portafoglio condiviso resta sempre eliminabile senza restare "nell'etere".
    risultato = esci_da_portafoglio(
        user, db, pf, cancella_transazioni=True,
    )
    db.commit()

    esito = risultato["esito"]
    if esito == "eliminato":
        return {"message": f"Portafoglio '{pf.nome}' eliminato"}
    if esito == "proprieta_trasferita":
        return {
            "message": f"Proprieta' del portafoglio '{pf.nome}' trasferita "
                       f"al cointestatario piu' anziano",
            "esito": "proprieta_trasferita",
            "id_portafoglio": pf.id_portafoglio,
            "nuovo_proprietario": risultato["nuovo_proprietario"],
        }
    return {"message": f"Sei uscito dal portafoglio '{pf.nome}'", "esito": "uscito"}


# POST /api/portafogli/{id}/invita — invita un utente (per email)
@router.post("/{portafoglio_id}/invita")
def invita_utente(
    portafoglio_id: int,
    data: InvitaPortafoglioRequest,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pf = db.query(Portafoglio).filter(Portafoglio.id_portafoglio == portafoglio_id).first()
    if not pf:
        raise HTTPException(404, "Portafoglio non trovato")
    if pf not in user.portafogli:
        raise HTTPException(403, "Portafoglio non associato al tuo account")
    if pf.tipo == 1:
        raise HTTPException(400, "Il portafoglio generale non e' condivisibile")

    email = data.email.strip().lower()
    if not email:
        raise HTTPException(400, "Email non valida")
    if email == user.email.lower():
        raise HTTPException(400, "Non puoi invitare te stesso")

    # Trova l'utente invitato (se esiste)
    invitato = db.query(Utente).filter(Utente.email.ilike(email)).first()

    # Se esiste e gia' membro, errore
    if invitato and invitato in pf.utenti:
        raise HTTPException(400, "Utente gia' membro del portafoglio")

    # Evita inviti duplicati pendenti
    existing = db.query(InvitoPortafoglio).filter(
        InvitoPortafoglio.id_portafoglio == portafoglio_id,
        InvitoPortafoglio.email_invitato == email,
        InvitoPortafoglio.stato == 1,
    ).first()
    if existing:
        raise HTTPException(400, "Invito gia' inviato a questa email")

    inv = InvitoPortafoglio(
        id_portafoglio=portafoglio_id,
        id_invitante=user.id_utente,
        email_invitato=email,
        id_invitato=invitato.id_utente if invitato else None,
        stato=1,
    )
    db.add(inv)
    db.flush()

    # Notifica solo se l'utente esiste gia' (altrimenti si attiva alla registrazione)
    if invitato:
        notifica = Notifica(
            id_utente=invitato.id_utente,
            id_mittente=user.id_utente,
            tipo=1,
            titolo=f"Invito al portafoglio '{pf.nome}'",
            messaggio=f"{user.nome} {user.cognome} ti ha invitato a condividere il portafoglio '{pf.nome}'.",
            riferimento_id=inv.id_invito,
        )
        db.add(notifica)

    db.commit()
    return {
        "message": "Invito inviato",
        "id_invito": inv.id_invito,
        "utente_esistente": invitato is not None,
    }


# DELETE /api/portafogli/{id}/membri/{id_utente} — rimuovi un cointestatario
@router.delete("/{portafoglio_id}/membri/{id_utente}")
def rimuovi_membro(
    portafoglio_id: int,
    id_utente: int,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pf = db.query(Portafoglio).filter(Portafoglio.id_portafoglio == portafoglio_id).first()
    if not pf:
        raise HTTPException(404, "Portafoglio non trovato")
    if pf not in user.portafogli:
        raise HTTPException(403, "Portafoglio non associato al tuo account")

    # Solo il proprietario puo' rimuovere membri
    if _ruolo_utente(db, user.id_utente, portafoglio_id) != 'proprietario':
        raise HTTPException(403, "Solo il proprietario puo' rimuovere membri")

    if id_utente == user.id_utente:
        raise HTTPException(400, "Non puoi rimuoverti da solo")

    target = db.query(Utente).filter(Utente.id_utente == id_utente).first()
    if not target or target not in pf.utenti:
        raise HTTPException(404, "Membro non trovato")

    pf.utenti.remove(target)
    db.commit()
    return {"message": f"Membro rimosso dal portafoglio"}


# GET /api/portafogli/{id}/membri — lista membri del portafoglio
@router.get("/{portafoglio_id}/membri")
def lista_membri(
    portafoglio_id: int,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pf = db.query(Portafoglio).filter(Portafoglio.id_portafoglio == portafoglio_id).first()
    if not pf:
        raise HTTPException(404, "Portafoglio non trovato")
    if pf not in user.portafogli:
        raise HTTPException(403, "Portafoglio non associato al tuo account")

    membri = []
    for u in pf.utenti:
        membri.append({
            "id_utente": u.id_utente,
            "nome": f"{u.nome} {u.cognome}".strip(),
            "email": u.email,
            "ruolo": _ruolo_utente(db, u.id_utente, portafoglio_id),
        })
    return membri