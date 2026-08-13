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

# ── Mapping tipo notifica ──
# 1=invito_portafoglio  2=info  3=messaggio
TIPO_NOTIFICA = {1: 'invito_portafoglio', 2: 'info', 3: 'messaggio'}
TIPO_NOTIFICA_REV = {v: k for k, v in TIPO_NOTIFICA.items()}

# ── Mapping stato invito ──
# 1=in_attesa  2=accettato  3=rifiutato  4=annullato
STATO_INVITO = {1: 'in_attesa', 2: 'accettato', 3: 'rifiutato', 4: 'annullato'}
STATO_INVITO_REV = {v: k for k, v in STATO_INVITO.items()}

# ── Mapping ruolo nel portafoglio ──
# 1=proprietario  2=cointestatario
RUOLO_PORTAFOGLIO = {1: 'proprietario', 2: 'cointestatario'}
RUOLO_PORTAFOGLIO_REV = {v: k for k, v in RUOLO_PORTAFOGLIO.items()}

# Tabella di join N:N tra Utente e Portafoglio
utenti_portafogli = Table(
    "utenti_portafogli",
    Base.metadata,
    Column("id_utente", Integer, ForeignKey("utenti.id_utente", ondelete="CASCADE"), primary_key=True),
    Column("id_portafoglio", Integer, ForeignKey("portafogli.id_portafoglio", ondelete="CASCADE"), primary_key=True),
    Column("ruolo", SmallInteger, nullable=False, default=1),  # 1=proprietario, 2=cointestatario
    Column("data_aggiunta", DateTime(timezone=True), server_default=func.now()),
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
    notifiche = relationship("Notifica", back_populates="utente", foreign_keys="Notifica.id_utente")


class Portafoglio(Base):
    __tablename__ = "portafogli"

    id_portafoglio = Column(Integer, primary_key=True, index=True)
    nome           = Column(String(100), nullable=False)
    valore         = Column(Numeric(10, 2), nullable=False)
    tipo           = Column(SmallInteger, nullable=False, default=3)

    # Relazioni
    utenti      = relationship("Utente", secondary=utenti_portafogli, back_populates="portafogli")
    transazioni = relationship("Transazione", back_populates="portafoglio")
    inviti      = relationship("InvitoPortafoglio", back_populates="portafoglio")


class Categoria(Base):
    __tablename__ = "categorie"
    __table_args__ = (UniqueConstraint('nome', 'tipo', name='categorie_nome_tipo_key'),)

    id_categoria = Column(Integer, primary_key=True, index=True)
    nome         = Column(String(100), nullable=False)
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
    direzione        = Column(SmallInteger, nullable=False, default=1)  # 1=uscita (sottrae), 2=entrata (aggiunge)
    importo          = Column(Numeric(10, 2), nullable=False)
    descrizione      = Column(Text)
    data_transazione = Column(Date, default=func.current_date())
    ora_transazione  = Column(Time, default=func.current_time())
    nascosto         = Column(Boolean, default=False)
    link_allegato    = Column(Text)
    id_transazione_collegata = Column(Integer, ForeignKey("transazioni.id_transazione", ondelete="SET NULL"), nullable=True)

    # Relazioni
    utente      = relationship("Utente", back_populates="transazioni")
    portafoglio = relationship("Portafoglio", back_populates="transazioni")
    categoria   = relationship("Categoria", back_populates="transazioni")
    collegata   = relationship("Transazione", remote_side=[id_transazione], post_update=True)


class Notifica(Base):
    __tablename__ = "notifiche"

    id_notifica    = Column(Integer, primary_key=True, index=True)
    id_utente      = Column(Integer, ForeignKey("utenti.id_utente", ondelete="CASCADE"), nullable=False)
    id_mittente    = Column(Integer, ForeignKey("utenti.id_utente", ondelete="SET NULL"), nullable=True)
    tipo           = Column(SmallInteger, nullable=False, default=2)
    titolo         = Column(String(150), nullable=False)
    messaggio      = Column(Text)
    riferimento_id = Column(Integer)  # es. id_invito
    letto          = Column(Boolean, nullable=False, default=False)
    data_creazione = Column(DateTime(timezone=True), server_default=func.now())

    # Relazioni
    utente   = relationship("Utente", back_populates="notifiche", foreign_keys=[id_utente])
    mittente = relationship("Utente", foreign_keys=[id_mittente])


class InvitoPortafoglio(Base):
    __tablename__ = "inviti_portafogli"

    id_invito      = Column(Integer, primary_key=True, index=True)
    id_portafoglio = Column(Integer, ForeignKey("portafogli.id_portafoglio", ondelete="CASCADE"), nullable=False)
    id_invitante   = Column(Integer, ForeignKey("utenti.id_utente", ondelete="CASCADE"), nullable=False)
    email_invitato = Column(String(100), nullable=False)
    id_invitato    = Column(Integer, ForeignKey("utenti.id_utente", ondelete="SET NULL"), nullable=True)
    stato          = Column(SmallInteger, nullable=False, default=1)  # 1=in_attesa, 2=accettato, 3=rifiutato, 4=annullato
    data_creazione = Column(DateTime(timezone=True), server_default=func.now())
    data_risposta  = Column(DateTime(timezone=True), nullable=True)

    # Relazioni
    portafoglio = relationship("Portafoglio", back_populates="inviti")
    invitante   = relationship("Utente", foreign_keys=[id_invitante])
    invitato    = relationship("Utente", foreign_keys=[id_invitato])