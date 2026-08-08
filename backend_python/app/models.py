from sqlalchemy import Column, Integer, SmallInteger, String, DateTime, Numeric, Date, Time, Boolean, Text, ForeignKey, Table, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base

# ── Mapping tipo portafoglio ──
# 1=generale  2=contanti  3=conti  4=carta di credito  5=risparmi
TIPO_PORTAFOGLIO = {
    1: 'generale', 2: 'contanti', 3: 'conti',
    4: 'carta di credito', 5: 'risparmi',
}
TIPO_PORTAFOGLIO_REV = {v: k for k, v in TIPO_PORTAFOGLIO.items()}

# ── Mapping tipo transazione ──
# 1=spesa  2=guadagno  3=trasferimento
TIPO_TRANSAZIONE = {1: 'spesa', 2: 'guadagno', 3: 'trasferimento'}
TIPO_TRANSAZIONE_REV = {v: k for k, v in TIPO_TRANSAZIONE.items()}

# ── Mapping tipo categoria ──
# 1=spesa  2=guadagno  3=trasferimento
TIPO_CATEGORIA = {1: 'spesa', 2: 'guadagno', 3: 'trasferimento'}
TIPO_CATEGORIA_REV = {v: k for k, v in TIPO_CATEGORIA.items()}

# Tabella di join N:N tra Utente e Portafoglio
utenti_portafogli = Table(
    "utenti_portafogli",
    Base.metadata,
    Column("id_utente", Integer, ForeignKey("utenti.id_utente", ondelete="CASCADE"), primary_key=True),
    Column("id_portafoglio", Integer, ForeignKey("portafogli.id_portafoglio", ondelete="CASCADE"), primary_key=True),
)

# Tabella di join N:N tra Utente e Categoria
utenti_categorie = Table(
    "utenti_categorie",
    Base.metadata,
    Column("id_utente", Integer, ForeignKey("utenti.id_utente", ondelete="CASCADE"), primary_key=True),
    Column("id_categoria", Integer, ForeignKey("categorie.id_categoria", ondelete="CASCADE"), primary_key=True),
)


class Utente(Base):
    __tablename__ = "utenti"

    id_utente      = Column(Integer, primary_key=True, index=True)
    nome           = Column(String, index=True)
    cognome        = Column(String, index=True)
    email          = Column(String, unique=True, index=True)
    password_hash  = Column(String)
    data_creazione = Column(DateTime(timezone=True), server_default=func.now())

    # Relazioni
    portafogli = relationship("Portafoglio", secondary=utenti_portafogli, back_populates="utenti")
    categorie  = relationship("Categoria", secondary=utenti_categorie, back_populates="utenti")
    transazioni = relationship("Transazione", back_populates="utente")


class Portafoglio(Base):
    __tablename__ = "portafogli"

    id_portafoglio = Column(Integer, primary_key=True, index=True)
    nome           = Column(String(100), nullable=False)
    valore         = Column(Numeric(10, 2), nullable=False)
    tipo           = Column(SmallInteger, nullable=False, default=3)

    # Relazioni
    utenti      = relationship("Utente", secondary=utenti_portafogli, back_populates="portafogli")
    transazioni = relationship("Transazione", back_populates="portafoglio")


class Categoria(Base):
    __tablename__ = "categorie"

    id_categoria = Column(Integer, primary_key=True, index=True)
    nome         = Column(String(100), unique=True, nullable=False)
    tipo         = Column(SmallInteger, nullable=False, default=1)  # 1=spesa, 2=guadagno, 3=trasferimento

    # Relazioni
    utenti      = relationship("Utente", secondary=utenti_categorie, back_populates="categorie")
    transazioni = relationship("Transazione", back_populates="categoria")


class Transazione(Base):
    __tablename__ = "transazioni"

    id_transazione   = Column(Integer, primary_key=True, index=True)
    id_utente        = Column(Integer, ForeignKey("utenti.id_utente", ondelete="CASCADE"), nullable=False)
    id_portafoglio   = Column(Integer, ForeignKey("portafogli.id_portafoglio", ondelete="CASCADE"), nullable=False)
    id_categoria     = Column(Integer, ForeignKey("categorie.id_categoria", ondelete="RESTRICT"), nullable=False)
    tipo             = Column(SmallInteger, nullable=False, default=1)  # 1=spesa, 2=guadagno, 3=trasferimento
    importo          = Column(Numeric(10, 2), nullable=False)
    descrizione      = Column(Text)
    data_transazione = Column(Date, default=func.current_date())
    ora_transazione  = Column(Time, default=func.current_time())
    nascosto         = Column(Boolean, default=False)
    link_allegato    = Column(Text)
    # Per trasferimenti: link alla transazione collegata
    id_transazione_collegata = Column(Integer, ForeignKey("transazioni.id_transazione", ondelete="SET NULL"), nullable=True)

    # Relazioni
    utente      = relationship("Utente", back_populates="transazioni")
    portafoglio = relationship("Portafoglio", back_populates="transazioni")
    categoria   = relationship("Categoria", back_populates="transazioni")
    # Transazione collegata (per trasferimenti)
    collegata   = relationship("Transazione", remote_side=[id_transazione], post_update=True)