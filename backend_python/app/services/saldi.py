"""
Servizio di ricalcolo saldo portafogli per Albert.

Il valore di un portafoglio e' memorizzato in portafogli.valore ed e' UNICO
e CONDIVISO tra tutti i membri: ogni utente legge quello stesso valore.

Pertanto il saldo va ricalcolato sommando le transazioni di TUTTI i membri
attualmente associati al portafoglio (join utenti_portafogli), NON solo
quelle dell'utente che sta compiendo l'operazione. Filtrare per un singolo
utente produce, su un portafoglio cointestato, un saldo parziale che viene
sovrascritto su .valore corrompendolo per tutti.

Regole rispettate (coerenti con eliminazione.py):
- il portafoglio "Generale" (tipo=1) non viene mai modificato qui;
- si considerano solo le transazioni dei membri ancora associati, cosi' chi
  esce dal portafoglio smette di contribuire al saldo;
- transazioni nascoste (nascosto=True) escluse;
- direzione 2 = entrata (aggiunge), direzione 1 = uscita (sottrae).
"""

from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import Optional

from ..models import Portafoglio, Transazione, utenti_portafogli


def _membri(db: Session, id_portafoglio: int) -> list:
    """Id utente di tutti i membri attualmente associati al portafoglio."""
    return [
        r[0] for r in db.execute(
            select(utenti_portafogli.c.id_utente).where(
                utenti_portafogli.c.id_portafoglio == id_portafoglio,
            )
        ).all()
    ]


def ricalcola_saldo(db: Session, id_portafoglio: int) -> Optional[float]:
    """Ricalcola .valore del portafoglio sulle transazioni di tutti i suoi
    membri. Ritorna il nuovo saldo, oppure None se il portafoglio non esiste
    o e' il Generale (tipo=1). Non fa commit: il chiamante decide."""
    pf = db.query(Portafoglio).filter(
        Portafoglio.id_portafoglio == id_portafoglio
    ).first()
    if not pf or pf.tipo == 1:
        return None

    membri = _membri(db, id_portafoglio)
    if not membri:
        # Nessun membro (situazione anomala / in via di eliminazione):
        # il valore non ha senso, lo lasciamo invariato.
        return None

    q = db.query(Transazione).filter(
        Transazione.id_portafoglio == id_portafoglio,
        Transazione.id_utente.in_(membri),
        Transazione.nascosto == False,
    )
    entrate = sum(
        float(t.importo) for t in q.filter(Transazione.direzione == 2).all()
    )
    uscite = sum(
        float(t.importo) for t in q.filter(Transazione.direzione == 1).all()
    )
    saldo = round(entrate - uscite, 2)
    pf.valore = saldo
    return saldo
