"""FastAPI application: wiring, lifespan and health endpoints."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import get_settings
from src.data_loader import DataLoadError, GraphRepository
from src.routers.entities import router as entities_router
from src.routers.envelope import install_error_handlers

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    """Load the seed data once at startup; refuse to start on bad data."""
    settings = get_settings()
    try:
        application.state.repository = GraphRepository.load(settings.data_dir)
    except DataLoadError:
        logger.exception("failed to load seed data from %s", settings.data_dir)
        raise
    yield


settings = get_settings()

app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
install_error_handlers(app)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"service": settings.app_name}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(entities_router)
