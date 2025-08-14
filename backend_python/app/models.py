from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from .database import Base

class Utente(Base):
    __tablename__ = "utenti"

    id_utente = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    data_creazione = Column(DateTime(timezone=True), server_default=func.now())

class Portafoglio(Base):
    __tablename__ = "portafogli"

    id_portafoglio = Column(Integer, primary_key=True, index=True)
    nome = Column(String, index=True)
    saldo_iniziale = Column(Float, default=0.0)
    id_utente = Column(Integer, ForeignKey("utenti.id_utente"))
    data_creazione = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relazione inversa con la tabella Utente
    utente = relationship("Utente", back_populates="portafoglio")

    # Relazione con la tabella Transazione
    transazioni = relationship("Transazione", back_populates="portafoglio", cascade="all, delete-orphan")

class Categoria(Base):
    __tablename__ = "categorie"

    id_categoria = Column(Integer, primary_key=True, index=True)
    nome = Column(String, unique=True, index=True)
    tipo = Column(String) # es. "Entrata" o "Spesa"
    data_creazione = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relazione con la tabella Transazione
    transazioni = relationship("Transazione", back_populates="categoria")

class Transazione(Base):
    __tablename__ = "transazioni"

    id_transazione = Column(Integer, primary_key=True, index=True)
    descrizione = Column(String, index=True)
    ammontare = Column(Float)
    data_transazione = Column(DateTime(timezone=True), server_default=func.now())

    id_portafoglio = Column(Integer, ForeignKey("portafogli.id_portafoglio"))
    id_categoria = Column(Integer, ForeignKey("categorie.id_categoria"))
    
    # Relazioni inverse
    portafoglio = relationship("Portafoglio", back_populates="transazioni")
    categoria = relationship("Categoria", back_populates="transazioni")
