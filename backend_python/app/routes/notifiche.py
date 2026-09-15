from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime, timezone
from ..database import get_db
from ..models import (
    Notifica, InvitoPortafoglio, Utente,
    utenti_portafogli, TIPO_NOTIFICA, STATO_INVITO,
)
from .auth import get_current_user

router = APIRouter()


def _notifica_to_out(n: Notifica) -> dict:
    return {
        "id_notifica": n.id_notifica,
        "tipo": TIPO_NOTIFICA.get(n.tipo, 'info'),
        "titolo": n.titolo,
        "messaggio": n.messaggio or "",
        "riferimento_id": n.riferimento_id,
        "letto": n.letto,
        "data_creazione": str(n.data_creazione) if n.data_creazione else "",
        "mittente": (n.mittente.nome + " " + n.mittente.cognome).strip() if n.mittente else "",
    }


# GET /api/notifiche — lista notifiche dell'utente + conteggio non lette
@router.get("/")
def lista_notifiche(
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notifiche = db.query(Notifica).filter(
        Notifica.id_utente == user.id_utente
    ).order_by(Notifica.data_creazione.desc()).all()

    non_lette = sum(1 for n in notifiche if not n.letto)
    return {
        "non_lette": non_lette,
        "notifiche": [_notifica_to_out(n) for n in notifiche],
    }


# POST /api/notifiche/{id}/letta — segna una notifica come letta
@router.post("/{notifica_id}/letta")
def segna_letta(
    notifica_id: int,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    n = db.query(Notifica).filter(Notifica.id_notifica == notifica_id).first()
    if not n:
        raise HTTPException(404, "Notifica non trovata")
    if n.id_utente != user.id_utente:
        raise HTTPException(403, "Non autorizzato")
    n.letto = True
    db.commit()
    return {"message": "Notifica letta"}


# DELETE /api/notifiche/{id} — elimina una notifica dell'utente
@router.delete("/{notifica_id}")
def elimina_notifica(
    notifica_id: int,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    n = db.query(Notifica).filter(Notifica.id_notifica == notifica_id).first()
    if not n:
        raise HTTPException(404, "Notifica non trovata")
    if n.id_utente != user.id_utente:
        raise HTTPException(403, "Non autorizzato")
    db.delete(n)
    db.commit()
    return {"message": "Notifica eliminata"}


# POST /api/inviti/{id}/accetta — accetta un invito a un portafoglio
@router.post("/inviti/{invito_id}/accetta")
def accetta_invito(
    invito_id: int,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inv = db.query(InvitoPortafoglio).filter(InvitoPortafoglio.id_invito == invito_id).first()
    if not inv:
        raise HTTPException(404, "Invito non trovato")
    if inv.stato != 1:
        raise HTTPException(400, "Invito non piu' valido")

    # Verifica che l'utente corrente sia il destinatario (per id o email)
    if inv.id_invitato and inv.id_invitato != user.id_utente:
        raise HTTPException(403, "Invito destinato a un altro utente")
    if not inv.id_invitato and inv.email_invitato.lower() != user.email.lower():
        raise HTTPException(403, "Invito destinato a un'altra email")

    # Aggiungi l'utente come cointestatario (ruolo=2)
    gia_membro = db.execute(
        select(utenti_portafogli.c.id_utente).where(
            utenti_portafogli.c.id_utente == user.id_utente,
            utenti_portafogli.c.id_portafoglio == inv.id_portafoglio,
        )
    ).scalar()
    if not gia_membro:
        db.execute(
            utenti_portafogli.insert().values(
                id_utente=user.id_utente,
                id_portafoglio=inv.id_portafoglio,
                ruolo=2,
            )
        )

    inv.stato = 2  # accettato
    inv.id_invitato = user.id_utente
    inv.data_risposta = datetime.now(timezone.utc)

    # Elimina la notifica di invito collegata (non deve restare nella sezione)
    if inv.id_invito:
        n = db.query(Notifica).filter(
            Notifica.id_utente == user.id_utente,
            Notifica.tipo == 1,
            Notifica.riferimento_id == inv.id_invito,
        ).first()
        if n:
            db.delete(n)

    db.commit()
    return {"message": "Invito accettato", "stato": STATO_INVITO[2]}


# POST /api/inviti/{id}/rifiuta — rifiuta un invito
@router.post("/inviti/{invito_id}/rifiuta")
def rifiuta_invito(
    invito_id: int,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inv = db.query(InvitoPortafoglio).filter(InvitoPortafoglio.id_invito == invito_id).first()
    if not inv:
        raise HTTPException(404, "Invito non trovato")
    if inv.stato != 1:
        raise HTTPException(400, "Invito non piu' valido")

    if inv.id_invitato and inv.id_invitato != user.id_utente:
        raise HTTPException(403, "Invito destinato a un altro utente")
    if not inv.id_invitato and inv.email_invitato.lower() != user.email.lower():
        raise HTTPException(403, "Invito destinato a un'altra email")

    inv.stato = 3  # rifiutato
    inv.data_risposta = datetime.now(timezone.utc)

    # Elimina la notifica di invito collegata (non deve restare nella sezione)
    n = db.query(Notifica).filter(
        Notifica.id_utente == user.id_utente,
        Notifica.tipo == 1,
        Notifica.riferimento_id == inv.id_invito,
    ).first()
    if n:
        db.delete(n)

    db.commit()
    return {"message": "Invito rifiutato", "stato": STATO_INVITO[3]}