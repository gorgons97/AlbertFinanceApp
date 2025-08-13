from fastapi import FastAPI
from .routes import auth

app = FastAPI()

app.include_router(auth.router, prefix="/api/auth", tags=["Autenticazione"])

@app.get("/")
def read_root():
    return {"message": "Benvenuto nel tuo backend!"}