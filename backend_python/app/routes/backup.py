from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import date as date_type, datetime
from io import BytesIO, StringIO
import csv, io
from ..database import get_db
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
                    _debug(f"  riga {idx}: riuso portafoglio esistente '{nome_cat}' (id={pf.id_portafoglio})")
                else:
                    pf_dest = Portafoglio(nome=nome_cat, valore=0, tipo=3)  # 3=conti default
                    db.add(pf); db.flush()
                    user.portafogli.append(pf)
                    created_pf += 1
                    _debug(f"  riga {idx}: CREATO portafoglio '{nome_cat}' (id={pf.id_portafoglio})")
                pf_cache[key_pf] = pf_dest
            pf_dest = pf_cache[key_pf]

            nota = f"Trasferimento da {pf.nome} a {pf_dest.nome}"

            cat = db.query(Categoria).filter(Categoria.nome == "Trasferimento in uscita", Categoria.tipo == 3).first()
            if not cat:
                cat = Categoria(nome="Trasferimento in uscita", tipo=3); db.add(cat_out); db.flush()
            

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
                cat = Categoria(nome="Trasferimento in entrata", tipo=3); db.add(cat_in); db.flush()
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

        created_tr += 1

        # Stampa di debug ogni 200 righe (per non spammare il log)
        if idx % 200 == 0:
            _debug(f"  riga {idx}/{len(rows)}: conto='{nome_conto}' cat='{nome_cat}' "
                   f"tipo={tipo_tr} dir={direzione} importo={importo} data={data_tr}")

    # IMPORTANTE: applica le transazioni pending al DB prima di ricalcolare i saldi,
    # altrimenti le query sotto non le vedono (la sessione ha autoflush=False)
    db.flush()
    _debug(f"Flush eseguito. Transazioni create: {created_tr}")

    # Aggiorna saldi di tutti i portafogli toccati (usando la direzione, come nel resto del sistema)
    _debug("=== Ricalcolo saldi portafogli ===")
    for pf in pf_cache.values():
        entrate = db.query(Transazione).filter(
            Transazione.id_portafoglio == pf.id_portafoglio,
            Transazione.id_utente == user.id_utente,
            Transazione.direzione == 2,
            Transazione.nascosto == False,
        ).all()
        uscite = db.query(Transazione).filter(
            Transazione.id_portafoglio == pf.id_portafoglio,
            Transazione.id_utente == user.id_utente,
            Transazione.direzione == 1,
            Transazione.nascosto == False,
        ).all()
        tot_entrate = sum(float(t.importo) for t in entrate)
        tot_uscite = sum(float(t.importo) for t in uscite)
        saldo = round(tot_entrate - tot_uscite, 2)
        pf.valore = saldo
        _debug(f"  saldo '{pf.nome}' (id={pf.id_portafoglio}): "
               f"entrate={tot_entrate} uscite={tot_uscite} -> {saldo}")

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
):
    """Esporta tutte le transazioni in CSV."""
    transazioni = db.query(Transazione).filter(
        Transazione.id_utente == user.id_utente,
        Transazione.nascosto == False,
    ).order_by(Transazione.data_transazione.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Data", "Conto", "Categoria", "Descrizione", "Importo", "Tipo"])

    for t in transazioni:
        writer.writerow([
            str(t.data_transazione) if t.data_transazione else "",
            t.portafoglio.nome if t.portafoglio else "",
            t.categoria.nome if t.categoria else "",
            t.descrizione or "",
            str(float(t.importo)) if t.importo else "0",
            TIPO_TRANSAZIONE.get(t.tipo, 'spesa'),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=albert_backup.csv"}
    )
