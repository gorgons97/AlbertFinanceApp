"""
Servizio di eliminazione dati per Albert.

Raccoglie funzioni separate, indipendenti e riusabili per cancellare i dati
dell'utente autenticato. Ogni funzione riceve la sessione db e l'utente gia'
autenticato, quindi puo' essere chiamata da qualunque route/script/scheduler.

Regole di business rispettate:
- Il portafoglio "Generale" (tipo=1) non viene MAI toccato.
- Portafogli e categorie sono globali/condivisibili: si interviene solo sui
  dati dell'utente, lasciando intatti quelli degli altri cointestatari.
- transazioni.id_categoria ha FK RESTRICT: prima si cancellano le transazioni
  dell'utente, poi (se possibile) la riga categoria/portafoglio.
- transazioni.id_transazione_collegata ha FK SET NULL: non crea blocchi.

Nota: le funzioni NON fanno commit da sole; il chiamante decide quando
committare (tutto in un'unica transazione) o rollback su errore.
"""

from sqlalchemy.orm import Session
from sqlalchemy import select, func

from ..models import (
    Utente, Transazione, Portafoglio, Categoria,
    utenti_portafogli, utenti_categorie,
)


# ---------------------------------------------------------------------------
# Helper interni
# ---------------------------------------------------------------------------

def _altro_membro_presente(db: Session, id_portafoglio: int, id_utente: int) -> bool:
    """True se il portafoglio ha almeno un membro diverso da id_utente."""
    cnt = db.execute(
        select(func.count()).select_from(utenti_portafogli).where(
            utenti_portafogli.c.id_portafoglio == id_portafoglio,
            utenti_portafogli.c.id_utente != id_utente,
        )
    ).scalar()
    return (cnt or 0) > 0


def _categoria_ancora_usata(db: Session, id_categoria: int) -> bool:
    """True se esiste ancora almeno una transazione con quella categoria."""
    cnt = db.query(Transazione).filter(
        Transazione.id_categoria == id_categoria
    ).count()
    return cnt > 0


# ---------------------------------------------------------------------------
# 1) ELIMINA TUTTE LE TRANSAZIONI DELL'UTENTE
# ---------------------------------------------------------------------------

def elimina_tutte_le_transazioni(user: Utente, db: Session) -> dict:
    """Cancella tutte le transazioni dell'utente. Portafogli e categorie restano."""
    res = db.query(Transazione).filter(
        Transazione.id_utente == user.id_utente
    ).delete(synchronize_session=False)
    return {"transazioni_eliminate": res}


# ---------------------------------------------------------------------------
# 2) ELIMINA TUTTI I PORTAFOGLI DELL'UTENTE (escluso il "Generale")
# ---------------------------------------------------------------------------

def elimina_tutti_i_portafogli(user: Utente, db: Session) -> dict:
    """
    Per ogni portafoglio dell'utente (escluso il Generale, tipo=1):
      - elimina le transazioni dell'utente in quel portafoglio;
      - se l'utente e' l'unico membro -> cancella la riga portafoglio
        (le transazioni residue e gli inviti cadono per CASCADE);
      - se ci sono altri cointestatari -> rimuove solo la presenza dell'utente,
        lasciando intatti i dati degli altri.
    """
    portafogli_eliminati = 0
    associazioni_rimosse = 0

    for pf in list(user.portafogli):
        if pf.tipo == 1:  # Generale: mai toccarlo
            continue

        # 1) transazioni dell'utente in questo portafoglio
        db.query(Transazione).filter(
            Transazione.id_utente == user.id_utente,
            Transazione.id_portafoglio == pf.id_portafoglio,
        ).delete(synchronize_session=False)

        # 2) decide se cancellare la riga o solo la propria associazione
        if _altro_membro_presente(db, pf.id_portafoglio, user.id_utente):
            # Restano altri membri -> solo io esco
            db.execute(
                utenti_portafogli.delete().where(
                    utenti_portafogli.c.id_portafoglio == pf.id_portafoglio,
                    utenti_portafogli.c.id_utente == user.id_utente,
                )
            )
            associazioni_rimosse += 1
        else:
            # Ultimo (o unico) membro -> elimino il portafoglio
            db.query(Portafoglio).filter(
                Portafoglio.id_portafoglio == pf.id_portafoglio
            ).delete(synchronize_session=False)
            portafogli_eliminati += 1

    return {
        "portafogli_eliminati": portafogli_eliminati,
        "associazioni_rimosse": associazioni_rimosse,
    }


# ---------------------------------------------------------------------------
# 3) ELIMINA TUTTE LE CATEGORIE DELL'UTENTE
# ---------------------------------------------------------------------------

def elimina_tutte_le_categorie(user: Utente, db: Session) -> dict:
    """
    Per ogni categoria dell'utente:
      - elimina le transazioni dell'utente con quella categoria;
      - se dopo la pulizia nessuna transazione (di nessuno) usa piu' la
        categoria -> elimina la riga categoria;
      - altrimenti (usata da altri) -> rimuove solo l'associazione dell'utente.
    """
    categorie_eliminate = 0
    associazioni_rimosse = 0

    for cat in list(user.categorie):
        # 1) transazioni dell'utente con questa categoria
        db.query(Transazione).filter(
            Transazione.id_utente == user.id_utente,
            Transazione.id_categoria == cat.id_categoria,
        ).delete(synchronize_session=False)

        # 2) decidi se cancellare la riga o solo l'associazione
        if _categoria_ancora_usata(db, cat.id_categoria):
            db.execute(
                utenti_categorie.delete().where(
                    utenti_categorie.c.id_categoria == cat.id_categoria,
                    utenti_categorie.c.id_utente == user.id_utente,
                )
            )
            associazioni_rimosse += 1
        else:
            db.query(Categoria).filter(
                Categoria.id_categoria == cat.id_categoria
            ).delete(synchronize_session=False)
            categorie_eliminate += 1

    return {
        "categorie_eliminate": categorie_eliminate,
        "associazioni_rimosse": associazioni_rimosse,
    }


# ---------------------------------------------------------------------------
# 4) ELIMINA L'UTENTE E TUTTI I SUOI DATI (cascata)
# ---------------------------------------------------------------------------

def elimina_utente(user: Utente, db: Session) -> dict:
    """
    Rimuove completamente l'account dell'utente e tutti i dati collegati.
    Ordine studiato per rispettare le FK:
      1) pulizia portafogli (transazioni + presenza; ultimo membro => portafoglio
         eliminato; altrimenti solo uscita);
      2) pulizia categorie (transazioni + presenza; ultimo uso => categoria eliminata);
      3) DELETE utente -> CASCADE su notifiche, inviti (dove invitante),
         transazioni residue e join table.
    """
    res_portafogli = elimina_tutti_i_portafogli(user, db)
    res_categorie = elimina_tutte_le_categorie(user, db)

    db.query(Utente).filter(Utente.id_utente == user.id_utente).delete(
        synchronize_session=False
    )

    return {
        "utente_eliminato": True,
        "portafogli": res_portafogli,
        "categorie": res_categorie,
    }
