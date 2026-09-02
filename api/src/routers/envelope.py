"""The response envelope every endpoint uses: {success, data, error}."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


def ok(data: object) -> dict:
    return {"success": True, "data": data, "error": None}


def fail(error: str) -> dict:
    return {"success": False, "data": None, "error": error}


def install_error_handlers(app: FastAPI) -> None:
    """Render HTTP errors (including routing 404s) in the envelope."""

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_envelope(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=fail(str(exc.detail)))
