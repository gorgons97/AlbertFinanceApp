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

    # Cache per evitare query duplicate
    pf_cache = {pf.nome.lower(): pf for pf in user.portafogli}
    cat_cache = {}

    created_pf = 0
    created_cat = 0
    created_tr = 0

    for row in rows:
        # Col 0: data, Col 1: conto, Col 2: categoria, Col 3: nota, Col 4: importo, Col 5: tipo
        nome_conto = str(row[1]).strip() if row[1] else ""
        nome_cat = str(row[2]).strip() if row[2] else ""
        nota = str(row[3]).strip() if row[3] else ""
        importo = _parse_importo(row[4])
        tipo_str = str(row[5]).strip().lower() if row[5] else "spesa"

        if not nome_conto or importo <= 0:
            continue

        # Mappa il tipo
        if tipo_str in ('guadagno', 'income', 'entrata'):
            tipo_tr = 2
        elif tipo_str in ('trasferimento', 'trasferimento uscita', 'transfer'):
            tipo_tr = 3
        else:
            tipo_tr = 1  # spesa

        # Portafoglio: crea se non esiste (default conti)
        key_pf = nome_conto.lower()
        if key_pf not in pf_cache:
            # Evita duplicati nel DB
            existing = db.query(Portafoglio).filter(
                Portafoglio.nome.ilike(nome_conto)
            ).first()
            if existing and existing in user.portafogli:
                pf = existing
            else:
                pf = Portafoglio(nome=nome_conto, valore=0, tipo=3)  # 3=conti default
                db.add(pf); db.flush()
                user.portafogli.append(pf)
                created_pf += 1
            pf_cache[key_pf] = pf
        pf = pf_cache[key_pf]

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
            cat_cache[key_cat] = cat
        cat = cat_cache[key_cat]

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
            importo=importo,
            descrizione=nota,
            data_transazione=data_tr,
        )
        db.add(tr)
        created_tr += 1

    # Aggiorna saldi di tutti i portafogli toccati
    for pf in pf_cache.values():
        entrate = db.query(Transazione).filter(
            Transazione.id_portafoglio == pf.id_portafoglio,
            Transazione.id_utente == user.id_utente,
            Transazione.tipo == 2, Transazione.nascosto == False
        ).all()
        uscite = db.query(Transazione).filter(
            Transazione.id_portafoglio == pf.id_portafoglio,
            Transazione.id_utente == user.id_utente,
            Transazione.tipo.in_([1, 3]), Transazione.nascosto == False
        ).all()
        pf.valore = round(
            sum(float(t.importo) for t in entrate) - sum(float(t.importo) for t in uscite), 2
        )

    db.commit()

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