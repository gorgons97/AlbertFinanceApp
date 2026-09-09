from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from pydantic import BaseModel, validator
from decimal import Decimal
from datetime import date as date_type, datetime
from typing import Optional
from ..database import get_db
from ..services.saldi import ricalcola_saldo
from ..models import (
    Transazione, Portafoglio, Categoria, Utente, utenti_portafogli,
    TIPO_TRANSAZIONE, TIPO_TRANSAZIONE_REV, TIPO_PORTAFOGLIO,
)
from .auth import get_current_user

router = APIRouter()

TIPI_VALIDI = list(TIPO_TRANSAZIONE_REV.keys())


def _tipo_str(tipo_int: int) -> str:
    return TIPO_TRANSAZIONE.get(tipo_int, 'spesa')


def _tipo_int(tipo_str: str) -> int:
    return TIPO_TRANSAZIONE_REV.get(tipo_str, 1)


def _get_nome_utente_condiviso(db: Session, id_utente: int, id_utente_login: int) -> Optional[str]:
    "Restituisce il nome dell'utente di una transazione condivisa"

    if id_utente is None or id_utente == id_utente_login:
        return None

    return db.execute(
        select(Utente.nome).where(
            Utente.id_utente == id_utente,
        )
    ).scalar()


def _transazione_to_out(t: Transazione, nome_utente: Optional[str] = None) -> dict:
    nome_pf = t.portafoglio.nome if t.portafoglio else ""
    nome_cat = t.categoria.nome if t.categoria else ""
    return {
        "id_transazione": t.id_transazione,
        "id_utente": t.id_utente,
        "id_portafoglio": t.id_portafoglio,
        "nome_portafoglio": nome_pf,
        "id_categoria": t.id_categoria,
        "nome_categoria": nome_cat,
        "tipo": _tipo_str(t.tipo),
        "direzione": t.direzione,
        "importo": float(t.importo) if t.importo else 0.0,
        "descrizione": t.descrizione or "",
        "data_transazione": str(t.data_transazione) if t.data_transazione else "",
        "ora_transazione": str(t.ora_transazione) if t.ora_transazione else "",
        "nascosto": t.nascosto or False,
        "link_allegato": t.link_allegato or "",
        "id_transazione_collegata": t.id_transazione_collegata,
        "nome_utente": nome_utente,
    }


class TransazioneCreate(BaseModel):
    id_portafoglio: int
    id_categoria: int
    tipo: str = 'spesa'
    importo: float
    descrizione: Optional[str] = ""
    data_transazione: Optional[str] = None

    @validator('tipo')
    def valida_tipo(cls, v):
        if v not in TIPI_VALIDI:
            raise ValueError(f"Tipo non valido. Scegli tra: {', '.join(TIPI_VALIDI)}")
        return v


class TransazioneUpdate(BaseModel):
    id_portafoglio: int
    id_categoria: int
    tipo: str = 'spesa'
    importo: float
    descrizione: Optional[str] = ""
    data_transazione: Optional[str] = None

    @validator('tipo')
    def valida_tipo(cls, v):
        if v not in TIPI_VALIDI:
            raise ValueError(f"Tipo non valido. Scegli tra: {', '.join(TIPI_VALIDI)}")
        return v


class TrasferimentoCreate(BaseModel):
    id_portafoglio_origine: int
    id_portafoglio_destinazione: int
    importo: float
    descrizione: Optional[str] = ""
    data_transazione: Optional[str] = None   


class TransazioneOut(BaseModel):
    id_transazione: int
    id_utente: int
    id_portafoglio: int
    nome_portafoglio: str
    id_categoria: int
    nome_categoria: str
    tipo: str
    direzione: int
    importo: float
    descrizione: str
    data_transazione: str
    ora_transazione: str
    nascosto: bool
    link_allegato: str
    id_transazione_collegata: Optional[int] = None
    nome_utente: Optional[str] = None  

    class Config: orm_mode = True


def _aggiorna_saldo_portafoglio(db: Session, id_portafoglio: int, id_utente: int):
    """Ricalcola il valore del portafoglio sulle transazioni di TUTTI i suoi
    membri (il valore .valore è unico e condiviso: ogni utente legge quello
    stesso numero). Il parametro id_utente è mantenuto per compatibilità con i
    chiamanti ma NON filtra più: su un cointestato il saldo non può dipendere
    dal singolo utente che compie l'operazione."""
    db.flush()  # applica modifiche pendenti (add/delete/update) prima del ricalcolo
    ricalcola_saldo(db, id_portafoglio)


# ── Endpoints ──

@router.get("/", response_model=list[TransazioneOut])
def lista_transazioni(
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
    tipo: Optional[str] = Query(None, description="spesa/guadagno/trasferimento"),
    mese: Optional[str] = Query(None, description="YYYY-MM"),
    id_portafoglio: Optional[int] = Query(None, description="Filtra per portafoglio"),
    id_categoria: Optional[int] = Query(None, description="Filtra per categoria"),
    data_inizio: Optional[str] = Query(None, description="YYYY-MM-DD"),
    data_fine: Optional[str] = Query(None, description="YYYY-MM-DD"),
    limit: int = Query(100, ge=1, le=500),
):
    # 1. Recupera gli ID dei portafogli dell'utente
    portafogli_ids = [pf.id_portafoglio for pf in user.portafogli]

    query = db.query(Transazione).filter(
        Transazione.id_portafoglio.in_(portafogli_ids),
        Transazione.nascosto == False,
    )
    if tipo and tipo in TIPI_VALIDI:
        query = query.filter(Transazione.tipo == _tipo_int(tipo))
    if id_portafoglio:
        query = query.filter(Transazione.id_portafoglio == id_portafoglio)
    if id_categoria:
        query = query.filter(Transazione.id_categoria == id_categoria)
    if mese:
        try:
            anno, m = map(int, mese.split('-'))
            inizio_mese = date_type(anno, m, 1)
            if m == 12:
                fine_mese = date_type(anno + 1, 1, 1)
            else:
                fine_mese = date_type(anno, m + 1, 1)
            query = query.filter(
                Transazione.data_transazione >= inizio_mese,
                Transazione.data_transazione < fine_mese,
            )
        except (ValueError, IndexError):
            pass
    if data_inizio:
        try:
            query = query.filter(Transazione.data_transazione >= date_type.fromisoformat(data_inizio))
        except ValueError:
            pass
    if data_fine:
        try:
            query = query.filter(Transazione.data_transazione <= date_type.fromisoformat(data_fine))
        except ValueError:
            pass

    transazioni = query.order_by(
        Transazione.data_transazione.desc(),
        Transazione.ora_transazione.desc()
    ).limit(limit).all()
    return [_transazione_to_out(t, _get_nome_utente_condiviso(db, t.id_utente, user.id_utente)) for t in transazioni]


@router.get("/report")
def report_transazioni(
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
    mese: Optional[str] = Query(None, description="YYYY-MM (default: mese corrente)"),
    data_inizio: Optional[str] = Query(None, description="YYYY-MM-DD"),
    data_fine: Optional[str] = Query(None, description="YYYY-MM-DD"),
    id_portafoglio: Optional[int] = Query(None, description="Filtra per portafoglio"),
    id_categoria: Optional[int] = Query(None, description="Filtra per categoria"),
    tipo: Optional[str] = Query(None, description="spesa/guadagno/trasferimento"),
):
    """Report aggregato: spese/entrate per categoria, per mese e per portafoglio."""
    portafogli_ids = [pf.id_portafoglio for pf in user.portafogli]

    def _filtra(q):
        q = q.filter(
            Transazione.id_portafoglio.in_(portafogli_ids),
            Transazione.nascosto == False,
        )
        if tipo and tipo in TIPI_VALIDI:
            q = q.filter(Transazione.tipo == _tipo_int(tipo))
        if id_portafoglio:
            q = q.filter(Transazione.id_portafoglio == id_portafoglio)
        if id_categoria:
            q = q.filter(Transazione.id_categoria == id_categoria)
        if data_inizio:
            try: q = q.filter(Transazione.data_transazione >= date_type.fromisoformat(data_inizio))
            except ValueError: pass
        if data_fine:
            try: q = q.filter(Transazione.data_transazione <= date_type.fromisoformat(data_fine))
            except ValueError: pass
        if mese:
            try:
                anno, m = map(int, mese.split('-'))
                inizio = date_type(anno, m, 1)
                fine = date_type(anno + 1, 1, 1) if m == 12 else date_type(anno, m + 1, 1)
                q = q.filter(Transazione.data_transazione >= inizio,
                             Transazione.data_transazione < fine)
            except (ValueError, IndexError):
                pass
        return q

    # ── Totali spese/entrate (escludendo i trasferimenti interni) ──
    q_tot = _filtra(db.query(
        Transazione.tipo,
        func.coalesce(func.sum(Transazione.importo), 0),
    ))
    righe_tot = {r[0]: float(r[1]) for r in q_tot.group_by(Transazione.tipo).all()}
    spese = round(righe_tot.get(1, 0.0), 2)
    entrate = round(righe_tot.get(2, 0.0), 2)

    # ── Per categoria (nome + importo, per tipo) ──
    q_cat = _filtra(db.query(
        Categoria.nome, Transazione.tipo,
        func.coalesce(func.sum(Transazione.importo), 0),
    )).join(Categoria, Transazione.id_categoria == Categoria.id_categoria)
    per_categoria = []
    for nome, t, imp in q_cat.group_by(Categoria.nome, Transazione.tipo).all():
        per_categoria.append({"nome": nome, "tipo": _tipo_str(t), "importo": round(float(imp), 2)})
    # percentuale del peso rispetto al totale del proprio tipo (spesa o guadagno)
    for c in per_categoria:
        tot = entrate if c["tipo"] == "guadagno" else spese
        c["percentuale"] = round((c["importo"] / tot * 100), 1) if tot else 0.0
    per_categoria.sort(key=lambda x: -x["importo"])

    # ── Per mese (trend). Se è selezionato un mese unico, mostra gli ultimi 6 mesi ──
    if mese:
        try:
            anno, m = map(int, mese.split('-'))
            # finestra: 5 mesi prima del mese selezionato
            mese_idx = anno * 12 + (m - 1)
            inizio_trend = date_type((mese_idx - 5) // 12, (mese_idx - 5) % 12 + 1, 1)
            fine_trend = date_type((mese_idx + 1) // 12, (mese_idx + 1) % 12 + 1, 1) if mese_idx % 12 == 11 else date_type((mese_idx + 1) // 12, (mese_idx + 1) % 12 + 1, 1)
            q_mese = db.query(
                func.to_char(Transazione.data_transazione, 'YYYY-MM').label('mese'),
                Transazione.tipo,
                func.coalesce(func.sum(Transazione.importo), 0),
            ).filter(
                Transazione.id_portafoglio.in_(portafogli_ids),
                Transazione.nascosto == False,
                Transazione.data_transazione >= inizio_trend,
                Transazione.data_transazione < fine_trend,
            )
            if id_portafoglio:
                q_mese = q_mese.filter(Transazione.id_portafoglio == id_portafoglio)
            if id_categoria:
                q_mese = q_mese.filter(Transazione.id_categoria == id_categoria)
            if tipo and tipo in TIPI_VALIDI:
                q_mese = q_mese.filter(Transazione.tipo == _tipo_int(tipo))
            per_mese_raw = q_mese.group_by('mese', Transazione.tipo).all()
            per_mese = {}
            for ms, t, imp in per_mese_raw:
                d = per_mese.setdefault(ms, {"mese": ms, "spese": 0.0, "entrate": 0.0})
                if t == 1: d["spese"] = round(float(imp), 2)
                elif t == 2: d["entrate"] = round(float(imp), 2)
            per_mese = [per_mese[k] for k in sorted(per_mese.keys())]
        except (ValueError, IndexError):
            per_mese = []
    else:
        q_mese = _filtra(db.query(
            func.to_char(Transazione.data_transazione, 'YYYY-MM').label('mese'),
            Transazione.tipo,
            func.coalesce(func.sum(Transazione.importo), 0),
        ))
        per_mese_raw = q_mese.group_by('mese', Transazione.tipo).all()
        per_mese = {}
        for ms, t, imp in per_mese_raw:
            d = per_mese.setdefault(ms, {"mese": ms, "spese": 0.0, "entrate": 0.0})
            if t == 1: d["spese"] = round(float(imp), 2)
            elif t == 2: d["entrate"] = round(float(imp), 2)
        per_mese = [per_mese[k] for k in sorted(per_mese.keys())]

    # ── Per portafoglio ──
    q_pf = _filtra(db.query(
        Portafoglio.nome, Transazione.tipo,
        func.coalesce(func.sum(Transazione.importo), 0),
    )).join(Portafoglio, Transazione.id_portafoglio == Portafoglio.id_portafoglio)
    per_portafoglio = {}
    for nome, t, imp in q_pf.group_by(Portafoglio.nome, Transazione.tipo).all():
        d = per_portafoglio.setdefault(nome, {"nome": nome, "spese": 0.0, "entrate": 0.0})
        if t == 1: d["spese"] = round(float(imp), 2)
        elif t == 2: d["entrate"] = round(float(imp), 2)
    per_portafoglio = sorted(per_portafoglio.values(), key=lambda x: -(x["spese"] + x["entrate"]))

    return {
        "totali": {"spese": spese, "entrate": entrate, "saldo": round(entrate - spese, 2)},
        "per_categoria": per_categoria,
        "per_mese": per_mese,
        "per_portafoglio": per_portafoglio,
    }


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=TransazioneOut)
def crea_transazione(data: TransazioneCreate, user: Utente = Depends(get_current_user), db: Session = Depends(get_db)):
    pf = db.query(Portafoglio).filter(Portafoglio.id_portafoglio == data.id_portafoglio).first()
    if not pf: raise HTTPException(404, "Portafoglio non trovato")
    if pf not in user.portafogli: raise HTTPException(403, "Portafoglio non associato")
    if pf.tipo == 1: raise HTTPException(400, "Non puoi creare transazioni sul portafoglio generale")
    cat = db.query(Categoria).filter(Categoria.id_categoria == data.id_categoria).first()
    if not cat: raise HTTPException(404, "Categoria non trovata")
    if data.importo <= 0: raise HTTPException(400, "L'importo deve essere positivo")

    tipo_int = _tipo_int(data.tipo)
    direzione = 1 if tipo_int == 1 else 2  # spesa=uscita, guadagno=entrata
    trans = Transazione(
        id_utente=user.id_utente, id_portafoglio=data.id_portafoglio,
        id_categoria=data.id_categoria, tipo=tipo_int, direzione=direzione,
        importo=round(data.importo, 2), descrizione=data.descrizione or "",
    )
    if data.data_transazione:
        trans.data_transazione = date_type.fromisoformat(data.data_transazione)

    db.add(trans); db.flush()
    _aggiorna_saldo_portafoglio(db, data.id_portafoglio, user.id_utente)
    db.commit()
    db.refresh(trans)
    return _transazione_to_out(trans, _get_nome_utente_condiviso(db, trans.id_utente, user.id_utente))


@router.put("/{transazione_id}", response_model=TransazioneOut)
def modifica_transazione(
    transazione_id: int, data: TransazioneUpdate,
    user: Utente = Depends(get_current_user), db: Session = Depends(get_db),
):
    t = db.query(Transazione).filter(Transazione.id_transazione == transazione_id).first()
    if not t: raise HTTPException(404, "Transazione non trovata")
    if t.id_utente != user.id_utente: raise HTTPException(403, "Non autorizzato")

    pf = db.query(Portafoglio).filter(Portafoglio.id_portafoglio == data.id_portafoglio).first()
    if not pf: raise HTTPException(404, "Portafoglio non trovato")
    if pf not in user.portafogli: raise HTTPException(403, "Portafoglio non associato")
    if pf.tipo == 1: raise HTTPException(400, "Non puoi usare il portafoglio generale")
    if data.importo <= 0: raise HTTPException(400, "L'importo deve essere positivo")

    old_pf = t.id_portafoglio
    t.id_portafoglio = data.id_portafoglio
    t.id_categoria = data.id_categoria
    t.tipo = _tipo_int(data.tipo)
    t.direzione = 1 if _tipo_int(data.tipo) == 1 else 2
    t.importo = round(data.importo, 2)
    t.descrizione = data.descrizione or ""
    if data.data_transazione:
        t.data_transazione = date_type.fromisoformat(data.data_transazione)

    _aggiorna_saldo_portafoglio(db, data.id_portafoglio, user.id_utente)
    if old_pf != data.id_portafoglio:
        _aggiorna_saldo_portafoglio(db, old_pf, user.id_utente)
    db.commit(); db.refresh(t)
    return _transazione_to_out(t, _get_nome_utente_condiviso(db, t.id_utente, user.id_utente))


@router.post("/trasferimento", status_code=status.HTTP_201_CREATED)
def crea_trasferimento(data: TrasferimentoCreate, user: Utente = Depends(get_current_user), db: Session = Depends(get_db)):
    if data.id_portafoglio_origine == data.id_portafoglio_destinazione:
        raise HTTPException(400, "Origine e destinazione devono essere diversi")
    if data.importo <= 0: raise HTTPException(400, "L'importo deve essere positivo")

    pf_orig = db.query(Portafoglio).filter(Portafoglio.id_portafoglio == data.id_portafoglio_origine).first()
    pf_dest = db.query(Portafoglio).filter(Portafoglio.id_portafoglio == data.id_portafoglio_destinazione).first()
    if not pf_orig or not pf_dest: raise HTTPException(404, "Portafoglio non trovato")
    if pf_orig not in user.portafogli or pf_dest not in user.portafogli:
        raise HTTPException(403, "Portafoglio non associato")
    if pf_orig.tipo == 1 or pf_dest.tipo == 1:
        raise HTTPException(400, "Non puoi trasferire da/verso il portafoglio generale")

    cat_out = db.query(Categoria).filter(Categoria.nome == "Trasferimento in uscita", Categoria.tipo == 3).first()
    if not cat_out:
        cat_out = Categoria(nome="Trasferimento in uscita", tipo=3); db.add(cat_out); db.flush()
    cat_in = db.query(Categoria).filter(Categoria.nome == "Trasferimento in entrata", Categoria.tipo == 3).first()
    if not cat_in:
        cat_in = Categoria(nome="Trasferimento in entrata", tipo=3); db.add(cat_in); db.flush()

    importo = round(data.importo, 2)
    desc = data.descrizione or f"Trasferimento da {pf_orig.nome} a {pf_dest.nome}"


    uscita = Transazione(id_utente=user.id_utente, id_portafoglio=pf_orig.id_portafoglio,
        id_categoria=cat_out.id_categoria, tipo=3, direzione=1, importo=importo, descrizione=desc)
    
    if data.data_transazione:
        uscita.data_transazione = date_type.fromisoformat(data.data_transazione)

    db.add(uscita); db.flush()

    entrata = Transazione(id_utente=user.id_utente, id_portafoglio=pf_dest.id_portafoglio,
        id_categoria=cat_in.id_categoria, tipo=3, direzione=2, importo=importo, descrizione=desc,
        id_transazione_collegata=uscita.id_transazione)

    if data.data_transazione:
        entrata.data_transazione = date_type.fromisoformat(data.data_transazione)
        
    db.add(entrata); db.flush()
    uscita.id_transazione_collegata = entrata.id_transazione

    _aggiorna_saldo_portafoglio(db, pf_orig.id_portafoglio, user.id_utente)
    _aggiorna_saldo_portafoglio(db, pf_dest.id_portafoglio, user.id_utente)
    db.commit(); db.refresh(uscita); db.refresh(entrata)

    return {"message": "Trasferimento creato", "uscita": _transazione_to_out(uscita, _get_nome_utente_condiviso(db, uscita.id_utente, user.id_utente)), "entrata": _transazione_to_out(entrata, _get_nome_utente_condiviso(db, entrata.id_utente, user.id_utente))}


@router.delete("/{transazione_id}")
def elimina_transazione(transazione_id: int, user: Utente = Depends(get_current_user), db: Session = Depends(get_db)):
    t = db.query(Transazione).filter(Transazione.id_transazione == transazione_id).first()
    if not t: raise HTTPException(404, "Transazione non trovata")
    if t.id_utente != user.id_utente: raise HTTPException(403, "Non autorizzato")

    id_pf = t.id_portafoglio
    id_pf_collegata = None
    if t.id_transazione_collegata:
        col = db.query(Transazione).filter(Transazione.id_transazione == t.id_transazione_collegata).first()
        if col:
            id_pf_collegata = col.id_portafoglio
            db.delete(col)
    db.delete(t)

    _aggiorna_saldo_portafoglio(db, id_pf, user.id_utente)
    if id_pf_collegata is not None and id_pf_collegata != id_pf:
        _aggiorna_saldo_portafoglio(db, id_pf_collegata, user.id_utente)
    db.commit()
    return {"message": "Transazione eliminata"}