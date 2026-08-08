from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import auth, categorie, portafogli, transazioni, backup

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Autenticazione"])
app.include_router(categorie.router, prefix="/api/categorie", tags=["Categorie"])
app.include_router(portafogli.router, prefix="/api/portafogli", tags=["Portafogli"])
app.include_router(transazioni.router, prefix="/api/transazioni", tags=["Transazioni"])
app.include_router(backup.router, prefix="/api/backup", tags=["Backup"])

@app.get("/")
def read_root():
    return {"message": "Benvenuto nel tuo backend!"}