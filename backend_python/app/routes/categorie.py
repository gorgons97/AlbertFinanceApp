from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, validator
from ..database import get_db
from ..models import Categoria, Utente, TIPO_CATEGORIA, TIPO_CATEGORIA_REV
from .auth import get_current_user

router = APIRouter()

TIPI_VALIDI = list(TIPO_CATEGORIA_REV.keys())  # ['spesa', 'guadagno', 'trasferimento']


def _tipo_str(tipo_int: int) -> str:
    return TIPO_CATEGORIA.get(tipo_int, 'spesa')


def _tipo_int(tipo_str: str) -> int:
    return TIPO_CATEGORIA_REV.get(tipo_str, 1)


class CategoriaCreate(BaseModel):
    nome: str
    tipo: str = 'spesa'

    @validator('tipo')
    def valida_tipo(cls, v):
        if v not in TIPI_VALIDI:
            raise ValueError(f"Tipo non valido. Scegli tra: {', '.join(TIPI_VALIDI)}")
        return v


class CategoriaUpdate(BaseModel):
    nome: str
    tipo: str = 'spesa'

    @validator('tipo')
    def valida_tipo(cls, v):
        if v not in TIPI_VALIDI:
            raise ValueError(f"Tipo non valido. Scegli tra: {', '.join(TIPI_VALIDI)}")
        return v


class CategoriaOut(BaseModel):
    id_categoria: int
    nome: str
    tipo: str

    class Config:
        orm_mode = True


def _categoria_to_out(cat: Categoria) -> dict:
    return {
        "id_categoria": cat.id_categoria,
        "nome": cat.nome,
        "tipo": _tipo_str(cat.tipo),
    }


# GET /api/categorie — lista categorie dell'utente
@router.get("/", response_model=list[CategoriaOut])
def lista_categorie(
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return [_categoria_to_out(c) for c in user.categorie]


# GET /api/categorie?tipo=spesa — filtra per tipo
@router.get("/per-tipo/{tipo_str}", response_model=list[CategoriaOut])
def lista_categorie_per_tipo(
    tipo_str: str,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if tipo_str not in TIPI_VALIDI:
        raise HTTPException(status_code=400, detail=f"Tipo non valido. Scegli tra: {', '.join(TIPI_VALIDI)}")
    tipo_int = _tipo_int(tipo_str)
    return [_categoria_to_out(c) for c in user.categorie if c.tipo == tipo_int]


# POST /api/categorie — aggiungi una nuova categoria
@router.post("/", status_code=status.HTTP_201_CREATED, response_model=CategoriaOut)
def crea_categoria(
    data: CategoriaCreate,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    nome = data.nome.strip().capitalize()
    if not nome:
        raise HTTPException(status_code=400, detail="Il nome non puo' essere vuoto")

    # Controlla se esiste gia' per questo utente
    for cat in user.categorie:
        if cat.nome.lower() == nome.lower():
            raise HTTPException(status_code=400, detail="Categoria gia' esistente")

    tipo_int = _tipo_int(data.tipo)

    # Cerca se esiste gia' una categoria globale con stesso nome e tipo
    existing = db.query(Categoria).filter(
        Categoria.nome.ilike(nome),
        Categoria.tipo == tipo_int
    ).first()
    if existing:
        user.categorie.append(existing)
        db.commit()
        db.refresh(existing)
        return _categoria_to_out(existing)

    nuova = Categoria(nome=nome, tipo=tipo_int)
    db.add(nuova)
    db.flush()
    user.categorie.append(nuova)
    db.commit()
    db.refresh(nuova)
    return _categoria_to_out(nuova)


# PUT /api/categorie/{id} — modifica una categoria
@router.put("/{categoria_id}", response_model=CategoriaOut)
def modifica_categoria(
    categoria_id: int,
    data: CategoriaUpdate,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cat = db.query(Categoria).filter(Categoria.id_categoria == categoria_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria non trovata")
    if cat not in user.categorie:
        raise HTTPException(status_code=403, detail="Categoria non associata al tuo account")

    nome = data.nome.strip().capitalize()
    if not nome:
        raise HTTPException(status_code=400, detail="Il nome non puo' essere vuoto")

    for c in user.categorie:
        if c.id_categoria != categoria_id and c.nome.lower() == nome.lower():
            raise HTTPException(status_code=400, detail="Categoria gia' esistente")

    existing = db.query(Categoria).filter(
        Categoria.nome.ilike(nome),
        Categoria.id_categoria != categoria_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Esiste gia' una categoria con questo nome")

    cat.nome = nome
    cat.tipo = _tipo_int(data.tipo)
    db.commit()
    db.refresh(cat)
    return _categoria_to_out(cat)


# DELETE /api/categorie/{id} — rimuovi una categoria dell'utente
@router.delete("/{categoria_id}")
def rimuovi_categoria(
    categoria_id: int,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cat = db.query(Categoria).filter(Categoria.id_categoria == categoria_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria non trovata")
    if cat not in user.categorie:
        raise HTTPException(status_code=403, detail="Categoria non associata al tuo account")

    user.categorie.remove(cat)
    db.commit()
    return {"message": f"Categoria '{cat.nome}' rimossa"}