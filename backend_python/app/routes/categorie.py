from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models import Categoria, Utente
from .auth import get_current_user

router = APIRouter()


class CategoriaCreate(BaseModel):
    nome: str


class CategoriaUpdate(BaseModel):
    nome: str


class CategoriaOut(BaseModel):
    id_categoria: int
    nome: str

    class Config:
        orm_mode = True


# GET /api/categorie — lista categorie dell'utente
@router.get("/", response_model=list[CategoriaOut])
def lista_categorie(
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return user.categorie


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

    # Controlla se la categoria esiste gia' (globale o dell'utente)
    for cat in user.categorie:
        if cat.nome.lower() == nome.lower():
            raise HTTPException(status_code=400, detail="Categoria gia' esistente")

    # Cerca se esiste gia' una categoria globale con lo stesso nome
    existing = db.query(Categoria).filter(Categoria.nome.ilike(nome)).first()
    if existing:
        # Associa la categoria esistente all'utente
        user.categorie.append(existing)
        db.commit()
        db.refresh(existing)
        return existing

    # Crea nuova categoria
    nuova = Categoria(nome=nome)
    db.add(nuova)
    db.flush()  # per ottenere l'id
    user.categorie.append(nuova)
    db.commit()
    db.refresh(nuova)
    return nuova


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

    # Controlla duplicati (escludendo se stessa)
    for c in user.categorie:
        if c.id_categoria != categoria_id and c.nome.lower() == nome.lower():
            raise HTTPException(status_code=400, detail="Categoria gia' esistente")

    # Controlla anche tra le categorie globali
    existing = db.query(Categoria).filter(
        Categoria.nome.ilike(nome),
        Categoria.id_categoria != categoria_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Esiste gia' una categoria con questo nome")

    cat.nome = nome
    db.commit()
    db.refresh(cat)
    return cat


# DELETE /api/categorie/{id} — rimuovi una categoria dell'utente
@router.delete("/{categoria_id}")
def rimuovi_categoria(
    categoria_id: int,
    user: Utente = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Cerca la categoria tra quelle dell'utente
    cat = db.query(Categoria).filter(Categoria.id_categoria == categoria_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoria non trovata")
    if cat not in user.categorie:
        raise HTTPException(status_code=403, detail="Categoria non associata al tuo account")

    user.categorie.remove(cat)
    db.commit()
    return {"message": f"Categoria '{cat.nome}' rimossa"}
