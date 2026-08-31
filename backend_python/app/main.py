import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import auth, categorie, portafogli, transazioni, backup, notifiche, eliminazione

app = FastAPI()

# CORS configurabile via variabile d'ambiente (produzione):
#   CORS_ORIGINS="https://albert.tuodominio.it,https://www.albert.tuodominio.it"
# Se non impostata, in sviluppo accetta tutte le origini.
cors_env = os.environ.get("CORS_ORIGINS", "").strip()
if cors_env:
    allow_origins = [o.strip() for o in cors_env.split(",") if o.strip()]
else:
    allow_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=allow_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Autenticazione"])
app.include_router(categorie.router, prefix="/api/categorie", tags=["Categorie"])
app.include_router(portafogli.router, prefix="/api/portafogli", tags=["Portafogli"])
app.include_router(transazioni.router, prefix="/api/transazioni", tags=["Transazioni"])
app.include_router(backup.router, prefix="/api/backup", tags=["Backup"])
app.include_router(notifiche.router, prefix="/api/notifiche", tags=["Notifiche"])
app.include_router(eliminazione.router, prefix="/api/eliminazione", tags=["Eliminazione"])


@app.get("/")
def read_root():
    return {"message": "Benvenuto nel tuo backend!"}
