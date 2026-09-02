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
- transazioni.id_transazione_collegata ha FK SET NULL: quando si cancellano
  trasferimenti si rimuovono sempre entrambe le gambe (uscita+entrata).
- Un portafoglio non deve MAI restare orfano o senza proprietario:
    * se chi esce e' l'unico membro -> la riga portafoglio viene eliminata;
    * se chi esce e' il proprietario e restano cointestatari -> la proprieta'
      passa al cointestatario membro da piu' tempo (data_aggiunta minore).

Nota: le funzioni NON fanno commit da sole; il chiamante decide quando
committare (tutto in un'unica transazione) o rollback su errore.
"""

from sqlalchemy.orm import Session
from sqlalchemy import select, func

from ..models import (
    Utente, Transazione, Portafoglio, Categoria,
    utenti_portafogli, utenti_categorie,
)

# Ruoli (coerenti con models.py)
RUOLO_PROPRIETARIO = 1
RUOLO_COINTESTATARIO = 2


# ---------------------------------------------------------------------------
# Helper interni
# ---------------------------------------------------------------------------

def _ruolo(db: Session, id_portafoglio: int, id_utente: int):
    """Ruolo dell'utente su un portafoglio (o None se non e' membro)."""
    return db.execute(
        select(utenti_portafogli.c.ruolo).where(
            utenti_portafogli.c.id_portafoglio == id_portafoglio,
            utenti_portafogli.c.id_utente == id_utente,
        )
    ).scalar()


def _altri_membri(db: Session, id_portafoglio: int, id_utente: int):
    """Righe di join (id_utente, ruolo, data_aggiunta) dei membri diversi da id_utente."""
    return db.execute(
        select(
            utenti_portafogli.c.id_utente,
            utenti_portafogli.c.ruolo,
            utenti_portafogli.c.data_aggiunta,
        ).where(
            utenti_portafogli.c.id_portafoglio == id_portafoglio,
            utenti_portafogli.c.id_utente != id_utente,
        )
    ).all()


def _conteggio_membri(db: Session, id_portafoglio: int) -> int:
    return db.execute(
        select(func.count()).select_from(utenti_portafogli).where(
            utenti_portafogli.c.id_portafoglio == id_portafoglio,
        )
    ).scalar() or 0


def _rimuovi_associazione(db: Session, id_portafoglio: int, id_utente: int):
    db.execute(
        utenti_portafogli.delete().where(
            utenti_portafogli.c.id_portafoglio == id_portafoglio,
            utenti_portafogli.c.id_utente == id_utente,
        )
    )


def _categoria_ancora_usata(db: Session, id_categoria: int) -> bool:
    """True se esiste ancora almeno una transazione con quella categoria."""
    return db.query(Transazione).filter(
        Transazione.id_categoria == id_categoria
    ).count() > 0


def _ricalcola_saldo(db: Session, id_portafoglio: int, id_utente: int):
    """Ricalcola il valore di un portafoglio (non Generale) in base alle
    transazioni di id_utente, come fa il resto del sistema."""
    pf = db.query(Portafoglio).filter(Portafoglio.id_portafoglio == id_portafoglio).first()
    if not pf or pf.tipo == 1:
        return
    entrate = db.query(Transazione).filter(
        Transazione.id_portafoglio == id_portafoglio,
        Transazione.id_utente == id_utente,
        Transazione.direzione == 2,
        Transazione.nascosto == False,
    ).all()
    uscite = db.query(Transazione).filter(
        Transazione.id_portafoglio == id_portafoglio,
        Transazione.id_utente == id_utente,
        Transazione.direzione == 1,
        Transazione.nascosto == False,
    ).all()
    saldo = sum(float(t.importo) for t in entrate) - sum(float(t.importo) for t in uscite)
    pf.valore = round(saldo, 2)


# ---------------------------------------------------------------------------
# Uscita di un utente da un portafoglio (con gestione proprietà / orfani)
# ---------------------------------------------------------------------------

def esci_da_portafoglio(
    user: Utente,
    db: Session,
    pf: Portafoglio,
    cancella_transazioni: bool = True,
) -> dict:
    """
    Fa uscire user da pf, gestendo proprieta' e orfani.
    Regole:
      - cancella le transazioni dell'utente nel portafoglio se richiesto;
      - se l'utente e' l'UNICO membro -> elimina la riga portafoglio
        (le eventuali transazioni residue, inviti e join cadono per CASCADE);
      - se l'utente e' il PROPRIETARIO e restano altri -> trasferisce la
        proprieta' al cointestatario membro da piu' tempo e rimuove l'associazione;
      - altrimenti (cointestatario) -> rimuove solo la propria associazione.
    Ritorna un dict descrittivo dell'esito.
    """
    pf_id = pf.id_portafoglio
    if pf.tipo == 1:
        return {"esito": "generale_intoccato"}

    if cancella_transazioni:
        db.query(Transazione).filter(
            Transazione.id_utente == user.id_utente,
            Transazione.id_portafoglio == pf_id,
        ).delete(synchronize_session=False)

    altri = _altri_membri(db, pf_id, user.id_utente)

    if not altri:
        # Unico membro -> elimina il portafoglio (mai orfani nel DB)
        db.query(Portafoglio).filter(Portafoglio.id_portafoglio == pf_id).delete(
            synchronize_session=False
        )
        return {"esito": "eliminato", "id_portafoglio": pf_id}

    ruolo = _ruolo(db, pf_id, user.id_utente)

    if ruolo == RUOLO_PROPRIETARIO:
        # Trasferisci la proprietà al cointestatario membro da più tempo
        nuovo_owner_id = min(
            altri,
            key=lambda r: (r.data_aggiunta is None, r.data_aggiunta, r.id_utente),
        ).id_utente
        db.execute(
            utenti_portafogli.update()
            .where(
                utenti_portafogli.c.id_portafoglio == pf_id,
                utenti_portafogli.c.id_utente == nuovo_owner_id,
            )
            .values(ruolo=RUOLO_PROPRIETARIO)
        )
        _rimuovi_associazione(db, pf_id, user.id_utente)
        return {
            "esito": "proprieta_trasferita",
            "id_portafoglio": pf_id,
            "nuovo_proprietario": nuovo_owner_id,
        }

    # cointestatario: esce e basta
    _rimuovi_associazione(db, pf_id, user.id_utente)
    return {"esito": "uscito", "id_portafoglio": pf_id}


# ---------------------------------------------------------------------------
# 1) ELIMINA TUTTE LE TRANSAZIONI DELL'UTENTE
# ---------------------------------------------------------------------------

def elimina_tutte_le_transazioni(user: Utente, db: Session) -> dict:
    """Cancella tutte le transazioni dell'utente e ricalcola i saldi dei suoi
    portafogli non generali. Portafogli e categorie restano."""
    # Colleziona le coppie di trasferimento: cancella sempre entrambe le gambe
    ids = [
        r[0] for r in db.query(Transazione.id_transazione).filter(
            Transazione.id_utente == user.id_utente
        ).all()
    ]
    res = _cancella_transazioni_per_ids(user, db, ids)
    return {"transazioni_eliminate": res}


def _cancella_transazioni_per_ids(user: Utente, db: Session, ids) -> int:
    """Cancella le transazioni (solo id_utente) espandendo le coppie di
    trasferimento collegate, e ricalcola i saldi dei portafogli toccati."""
    if not ids:
        return 0

    da_eliminare = set(ids)

    # espandi le coppie: chi ha id_transazione_collegata tra gli ids
    partner = db.query(
        Transazione.id_transazione_collegata
    ).filter(
        Transazione.id_transazione.in_(ids),
        Transazione.id_utente == user.id_utente,
        Transazione.id_transazione_collegata.isnot(None),
    ).all()
    da_eliminare.update(r[0] for r in partner if r[0] is not None)

    # e la direzione inversa (una entrata che punta a una delle nostre uscite)
    reverse = db.query(
        Transazione.id_transazione
    ).filter(
        Transazione.id_transazione_collegata.in_(ids),
        Transazione.id_utente == user.id_utente,
    ).all()
    da_eliminare.update(r[0] for r in reverse)

    # portafogli toccati per il ricalcolo saldo
    pf_ids = {
        r[0] for r in db.query(Transazione.id_portafoglio).filter(
            Transazione.id_transazione.in_(list(da_eliminare))
        ).all()
    }

    db.query(Transazione).filter(
        Transazione.id_transazione.in_(list(da_eliminare))
    ).delete(synchronize_session=False)

    for pf_id in pf_ids:
        _ricalcola_saldo(db, pf_id, user.id_utente)

    return len(da_eliminare)


# ---------------------------------------------------------------------------
# 1b) ELIMINA TRANSAZIONI CON FILTRI (bucket)
# ---------------------------------------------------------------------------

def elimina_transazioni_filtrate(
    user: Utente,
    db: Session,
    tipi=None,          # list[int] tipi transazione
    id_categorie=None,  # list[int]
    id_portafogli=None, # list[int]
    dal=None,           # date
    al=None,            # date
) -> dict:
    """
    Elimina le transazioni dell'utente che soddisfano TUTTI i filtri (AND).
    Richiede almeno un filtro: con nessun filtro non elimina nulla.
    Le coppie di trasferimento collegate vengono rimosse insieme.
    """
    q = db.query(Transazione.id_transazione).filter(
        Transazione.id_utente == user.id_utente
    )
    if tipi:
        q = q.filter(Transazione.tipo.in_(tipi))
    if id_categorie:
        q = q.filter(Transazione.id_categoria.in_(id_categorie))
    if id_portafogli:
        q = q.filter(Transazione.id_portafoglio.in_(id_portafogli))
    if dal:
        q = q.filter(Transazione.data_transazione >= dal)
    if al:
        q = q.filter(Transazione.data_transazione <= al)

    ids = [r[0] for r in q.all()]
    eliminati = _cancella_transazioni_per_ids(user, db, ids)
    return {"transazioni_eliminate": eliminati}


# ---------------------------------------------------------------------------
# 2) ELIMINA TUTTI I PORTAFOGLI DELL'UTENTE (escluso il "Generale")
# ---------------------------------------------------------------------------

def elimina_tutti_i_portafogli(user: Utente, db: Session) -> dict:
    """Fa uscire l'utente da tutti i suoi portafogli (escluso Generale),
    cancellandone le transazioni e gestendo proprieta'/orfani."""
    portafogli_eliminati = 0
    uscite = 0
    trasferimenti = 0

    for pf in list(user.portafogli):
        esito = esci_da_portafoglio(user, db, pf, cancella_transazioni=True)
        if esito["esito"] == "eliminato":
            portafogli_eliminati += 1
        elif esito["esito"] == "proprieta_trasferita":
            trasferimenti += 1
        elif esito["esito"] == "uscito":
            uscite += 1

    return {
        "portafogli_eliminati": portafogli_eliminati,
        "proprieta_trasferite": trasferimenti,
        "uscite": uscite,
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
        db.query(Transazione).filter(
            Transazione.id_utente == user.id_utente,
            Transazione.id_categoria == cat.id_categoria,
        ).delete(synchronize_session=False)

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
      1) uscita da tutti i portafogli (gestendo proprieta'/orfani);
      2) pulizia categorie;
      3) DELETE utente -> CASCADE su notifiche, inviti, transazioni residue e join.
    """
    res_portafogli = elimina_tutti_i_portafogli(user, db)
    res_categorie = elimina_tutte_le_categorie(user, db)

    # Il portafoglio "Generale" e' per-utente (creato alla registrazione, non
    # condivisibile): una volta rimosso l'account la sua riga resterebbe orfana,
    # quindi la eliminiamo insieme alle sue transazioni e join (CASCADE).
    generali = [pf for pf in list(user.portafogli) if pf.tipo == 1]
    for pf in generali:
        db.query(Transazione).filter(
            Transazione.id_utente == user.id_utente,
            Transazione.id_portafoglio == pf.id_portafoglio,
        ).delete(synchronize_session=False)
        db.query(Portafoglio).filter(
            Portafoglio.id_portafoglio == pf.id_portafoglio
        ).delete(synchronize_session=False)

    db.query(Utente).filter(Utente.id_utente == user.id_utente).delete(
        synchronize_session=False
    )

    return {
        "utente_eliminato": True,
        "portafogli": res_portafogli,
        "categorie": res_categorie,
    }
