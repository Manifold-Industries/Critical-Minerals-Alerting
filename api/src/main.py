from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import get_settings
from src.router.assets import router as assets_router
from src.router.disruption import router as disruption_router
from src.router.exposure import router as exposure_router

settings = get_settings()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(disruption_router)
app.include_router(assets_router)
app.include_router(exposure_router)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"service": settings.app_name}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
