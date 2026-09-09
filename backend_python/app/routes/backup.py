from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import date as date_type, datetime
from typing import Optional
from io import BytesIO, StringIO
import csv, io
from ..database import get_db
from ..services.saldi import ricalcola_saldo
from ..models import (
    Transazione, Portafoglio, Categoria, Utente,
    TIPO_TRANSAZIONE, TIPO_TRANSAZIONE_REV,
    TIPO_PORTAFOGLIO, TIPO_PORTAFOGLIO_REV,
    TIPO_CATEGORIA, TIPO_CATEGORIA_REV,
)
from .auth import get_current_user

router = APIRouter()

# ============================================================
# DEBUG — metti False per disattivare le stampe di debug
# Le stampe escono su stdout del container: si leggono con
#   docker logs -f albert_backend        (in tempo reale)
#   docker logs --tail 100 albert_backend (ultime 100 righe)
# ============================================================
DEBUG = True


def _debug(msg: str):
    """Stampa di debug su stdout (visibile nei docker logs)."""
    if DEBUG:
        print(f"[IMPORT-DEBUG] {msg}", flush=True)


def _parse_importo(v):
    """Converte un valore a float, gestisce stringhe e numeri."""
    if v is None: return 0.0
    try: return round(float(str(v).replace(',', '.')), 2)
    except: return 0.0


@router.post("/import")
async def importa_backup(
    file: UploadFile = File(...),
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Importa un file XLSX o CSV. Crea portafogli, categorie e transazioni."""
    content = await file.read()
    filename = file.filename or ""
    _debug(f"=== INIZIO IMPORT file={filename} utente={user.email} id={user.id_utente} ===")

    rows = []
    if filename.lower().endswith('.csv'):
        text = content.decode('utf-8-sig')
        reader = csv.reader(io.StringIO(text))
        header = next(reader, None)
        for r in reader:
            if len(r) >= 6:
                rows.append(r)
    elif filename.lower().endswith('.xlsx'):
        import openpyxl
        wb = openpyxl.load_workbook(BytesIO(content))
        ws = wb.active
        for row in ws.iter_rows(min_row=2, values_only=True):
            if len(row) >= 6 and row[0] is not None:
                rows.append(row)
    elif filename.lower().endswith('.xls'):
        import xlrd
        book = xlrd.open_workbook(file_contents=content)
        sheet = book.sheet_by_index(0)
        for i in range(1, sheet.nrows):
            row = sheet.row_values(i)
            if len(row) >= 6 and row[0] != '':
                rows.append(row)
    else:
        raise HTTPException(400, "Formato non supportato. Usa .xlsx, .xls o .csv")

    if not rows:
        raise HTTPException(400, "Nessuna riga valida trovata")

    _debug(f"Righe valide lette dal file: {len(rows)}")

    # Cache per evitare query duplicate
    pf_cache = {pf.nome.lower(): pf for pf in user.portafogli}
    cat_cache = {}
    _debug(f"Portafogli gia' esistenti dell'utente: {[p.nome for p in user.portafogli]}")

    created_pf = 0
    created_cat = 0
    created_tr = 0

    # Solo i portafogli effettivamente toccati dall'import avranno il saldo ricalcolato.
    # Quelli non menzionati nel file NON vanno mai toccati (es. condivisi con altri utenti).
    portafogli_toccati = set()

    for idx, row in enumerate(rows):
        # Col 0: data, Col 1: conto, Col 2: categoria, Col 3: nota, Col 4: importo, Col 5: tipo
        nome_conto = str(row[1]).strip() if row[1] else ""
        nome_cat = str(row[2]).strip() if row[2] else ""
        nota = str(row[3]).strip() if row[3] else ""
        importo = _parse_importo(row[4])
        tipo_str = str(row[5]).strip().lower() if row[5] else "spesa"

        if not nome_conto or importo <= 0:
            _debug(f"  riga {idx}: saltata (conto='{nome_conto}' importo={importo})")
            continue

        # Mappa il tipo
        if tipo_str in ('guadagno', 'income', 'entrata'):
            tipo_tr = 2
        elif tipo_str in ('trasferimento', 'trasferimento uscita', 'transfer'):
            tipo_tr = 3
            _debug(f"  riga {idx}: trasferimento '{tipo_tr}'")
        else:
            tipo_tr = 1  # spesa
        direzione = 1 if tipo_tr in (1, 3) else 2  # uscita vs entrata

        # Portafoglio: crea se non esiste (default conti)
        key_pf = nome_conto.lower()
        if key_pf not in pf_cache:
            existing = db.query(Portafoglio).filter(
                Portafoglio.nome.ilike(nome_conto)
            ).first()
            if existing and existing in user.portafogli:
                pf = existing
                _debug(f"  riga {idx}: riuso portafoglio esistente '{nome_conto}' (id={pf.id_portafoglio})")
            else:
                pf = Portafoglio(nome=nome_conto, valore=0, tipo=3)  # 3=conti default
                db.add(pf); db.flush()
                user.portafogli.append(pf)
                created_pf += 1
                _debug(f"  riga {idx}: CREATO portafoglio '{nome_conto}' (id={pf.id_portafoglio})")
            pf_cache[key_pf] = pf
        pf = pf_cache[key_pf]
        portafogli_toccati.add(pf.id_portafoglio)

        if tipo_tr != 3:
            # Categoria: crea se non esiste
            key_cat = (nome_cat.lower(), tipo_tr)
            if key_cat not in cat_cache:
                existing = db.query(Categoria).filter(
                    Categoria.nome.ilike(nome_cat),
                    Categoria.tipo == tipo_tr
                ).first()
                if existing:
                    cat = existing
                    if cat not in user.categorie:
                        user.categorie.append(cat)
                else:
                    cat = Categoria(nome=nome_cat, tipo=tipo_tr)
                    db.add(cat); db.flush()
                    user.categorie.append(cat)
                    created_cat += 1
                    _debug(f"  riga {idx}: CREATA categoria '{nome_cat}' tipo={tipo_tr}")
                cat_cache[key_cat] = cat
            cat = cat_cache[key_cat]
        else:
            # Portafoglio di arrivo per il trasferimento: crea se non esiste (default conti) 
            key_pf = nome_cat.lower()
            if key_pf not in pf_cache:
                existing = db.query(Portafoglio).filter(
                    Portafoglio.nome.ilike(nome_cat)
                ).first()
                if existing and existing in user.portafogli:
                    pf_dest = existing
                    _debug(f"  riga {idx}: riuso portafoglio esistente '{nome_cat}' (id={pf_dest.id_portafoglio})")
                else:
                    pf_dest = Portafoglio(nome=nome_cat, valore=0, tipo=3)  # 3=conti default
                    db.add(pf_dest); db.flush()
                    user.portafogli.append(pf_dest)
                    created_pf += 1
                    _debug(f"  riga {idx}: CREATO portafoglio '{nome_cat}' (id={pf_dest.id_portafoglio})")
                pf_cache[key_pf] = pf_dest
            pf_dest = pf_cache[key_pf]
            portafogli_toccati.add(pf_dest.id_portafoglio)

            nota = f"Trasferimento da {pf.nome} a {pf_dest.nome}"

            cat = db.query(Categoria).filter(Categoria.nome == "Trasferimento in uscita", Categoria.tipo == 3).first()
            if not cat:
                cat = Categoria(nome="Trasferimento in uscita", tipo=3); db.add(cat); db.flush()
            

        # Data
        dt = row[0]
        if isinstance(dt, datetime):
            data_tr = dt.date()
        elif isinstance(dt, date_type):
            data_tr = dt
        elif isinstance(dt, str):
            try: data_tr = date_type.fromisoformat(dt[:10])
            except: data_tr = date_type.today()
        else:
            data_tr = date_type.today()

        # Transazione
        tr = Transazione(
            id_utente=user.id_utente,
            id_portafoglio=pf.id_portafoglio,
            id_categoria=cat.id_categoria,
            tipo=tipo_tr,
            direzione=direzione,
            importo=importo,
            descrizione=nota,
            data_transazione=data_tr,
        )
        db.add(tr)

        if tipo_tr == 3:
            direzione = 2
            cat = db.query(Categoria).filter(Categoria.nome == "Trasferimento in entrata", Categoria.tipo == 3).first()
            if not cat:
                cat = Categoria(nome="Trasferimento in entrata", tipo=3); db.add(cat); db.flush()
            # Transazione
            tr = Transazione(
                id_utente=user.id_utente,
                id_portafoglio=pf_dest.id_portafoglio,
                id_categoria=cat.id_categoria,
                tipo=tipo_tr,
                direzione=direzione,
                importo=importo,
                descrizione=nota,
                data_transazione=data_tr,
            )
            db.add(tr)

        created_tr += 2 if tipo_tr == 3 else 1

        # Stampa di debug ogni 200 righe (per non spammare il log)
        if idx % 200 == 0:
            _debug(f"  riga {idx}/{len(rows)}: conto='{nome_conto}' cat='{nome_cat}' "
                   f"tipo={tipo_tr} dir={direzione} importo={importo} data={data_tr}")

    # IMPORTANTE: applica le transazioni pending al DB prima di ricalcolare i saldi,
    # altrimenti le query sotto non le vedono (la sessione ha autoflush=False)
    db.flush()
    _debug(f"Flush eseguito. Transazioni create: {created_tr}")

    # Aggiorna i saldi SOLO dei portafogli toccati dall'import (usando la
    # direzione, come nel resto del sistema). Il valore di un portafoglio è
    # unico e condiviso: ricalcolarlo = sommare le transazioni di TUTTI i suoi
    # membri correnti (un cointestato non può dipendere dal singolo utente).
    # I portafogli non menzionati restano intoccati.
    _debug("=== Ricalcolo saldi portafogli toccati ===")
    for pf_id in portafogli_toccati:
        saldo = ricalcola_saldo(db, pf_id)
        if saldo is not None:
            pf = db.query(Portafoglio).filter(Portafoglio.id_portafoglio == pf_id).first()
            _debug(f"  saldo '{pf.nome}' (id={pf.id_portafoglio}) -> {saldo}")

    db.commit()
    _debug(f"=== IMPORT COMPLETATO: {created_pf} pf creati, {created_cat} cat create, "
           f"{created_tr} transazioni, saldi aggiornati ===")

    return {
        "message": "Import completato",
        "portafogli_creati": created_pf,
        "categorie_create": created_cat,
        "transazioni_importate": created_tr,
        "totale_righe": len(rows),
    }

@router.get("/export")
def esporta_backup(
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
    tipi: Optional[str] = Query(None, description="Filtro tipi, comma-separati: spesa,guadagno,trasferimento"),
    id_categorie: Optional[str] = Query(None, description="Filtro categorie, comma-separate (id)"),
    id_portafogli: Optional[str] = Query(None, description="Filtro portafogli, comma-separati (id)"),
    dal: Optional[str] = Query(None, description="Data inizio YYYY-MM-DD"),
    al: Optional[str] = Query(None, description="Data fine YYYY-MM-DD"),
):
    """Esporta tutte le transazioni in CSV, con i trasferimenti su una singola riga."""
    transazioni = db.query(Transazione).filter(
        Transazione.id_utente == user.id_utente,
        Transazione.nascosto == False,
    )

    if tipi:
        tipi_list = [t.strip() for t in tipi.split(",") if t.strip()]
        tipi_int = [TIPO_TRANSAZIONE_REV.get(t) for t in tipi_list]
        tipi_int = [t for t in tipi_int if t is not None]
        if tipi_int:
            query = query.filter(Transazione.tipo.in_(tipi_int))
    if id_categorie:
        try:
            cat_ids = [int(x) for x in id_categorie.split(",") if x.strip()]
            if cat_ids:
                query = query.filter(Transazione.id_categoria.in_(cat_ids))
        except ValueError:
            pass
    if id_portafogli:
        try:
            pf_ids = [int(x) for x in id_portafogli.split(",") if x.strip()]
            if pf_ids:
                query = query.filter(Transazione.id_portafoglio.in_(pf_ids))
        except ValueError:
            pass
    if dal:
        try:
            query = query.filter(Transazione.data_transazione >= date_type.fromisoformat(dal))
        except ValueError:
            pass
    if al:
        try:
            query = query.filter(Transazione.data_transazione <= date_type.fromisoformat(al))
        except ValueError:
            pass

    transazioni = query.order_by(Transazione.data_transazione.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Data", "Conto", "Categoria", "Descrizione", "Importo", "Tipo"])

    # Separiamo le transazioni normali da quelle di trasferimento
    normali = []
    trasferimenti = []
    for t in transazioni:
        if t.tipo == 3:
            if "trasferimento" in t.portafoglio.nome:
                continue
            if "trasferimento" in t.categoria.nome:
                continue
            
            trasferimenti.append(t)
        else:
            normali.append(t)

    # Esportiamo le transazioni normali
    for t in normali:
        writer.writerow([
            str(t.data_transazione) if t.data_transazione else "",
            t.portafoglio.nome if t.portafoglio else "",
            t.categoria.nome if t.categoria else "",
            t.descrizione or "",
            str(float(t.importo)) if t.importo else "0",
            TIPO_TRANSAZIONE.get(t.tipo, 'spesa'),
        ])

    # Raggruppiamo i trasferimenti per (data, importo, descrizione)
    # (la descrizione è comune per uscita/entrata)
    gruppi = {}
    for t in trasferimenti:
        key = (t.data_transazione, t.importo, t.descrizione)
        gruppi.setdefault(key, []).append(t)

    # Per ogni gruppo scriviamo una riga unica
    for key, lista in gruppi.items():
        out = next((t for t in lista if t.direzione == 1), None)
        inn = next((t for t in lista if t.direzione == 2), None)

        if out and "trasferimento" in out.portafoglio.nome.lower():
            continue

        if inn and "trasferimento" in inn.portafoglio.nome.lower():
            continue

        if out and inn:
            data = str(key[0]) if key[0] else ""
            importo = str(float(key[1])) if key[1] else "0"
            descrizione = key[2] or ""
            conto_origine = out.portafoglio.nome if out.portafoglio else ""
            conto_destinazione = inn.portafoglio.nome if inn.portafoglio else ""
            writer.writerow([
                data,
                conto_origine,          # Conto = origine
                conto_destinazione,     # Categoria = destinazione
                descrizione,
                importo,
                "trasferimento",
            ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=albert_backup.csv"}
    )