from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from .database import Base

class Utente(Base):
    __tablename__ = "utenti"

    id_utente      = Column(Integer, primary_key=True, index=True)
    nome           = Column(String, index=True)
    cognome        = Column(String, index=True)
    email          = Column(String, unique=True, index=True)
    password_hash  = Column(String)
    data_creazione = Column(DateTime(timezone=True), server_default=func.now())