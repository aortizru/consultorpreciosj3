import logging

from fastapi import FastAPI, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from database import Database, DatabaseError


app = FastAPI(title="Consultor de Precios CompraYa")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")
database = Database()
logger = logging.getLogger("uvicorn.error")


@app.on_event("shutdown")
def shutdown_event() -> None:
    database.close_pool()


@app.get("/", response_class=HTMLResponse)
def index(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/producto/{codigo}")
def consultar_producto(codigo: str) -> dict[str, str | bool]:
    try:
        producto = database.buscar_producto(codigo.strip())
    except DatabaseError as exc:
        logger.exception("Error consultando producto: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "mensaje": "Error consultando la base de datos.",
            },
        )

    if producto is None:
        return {
            "success": False,
            "mensaje": "Producto no encontrado",
        }

    return {
        "success": True,
        "codigo": producto["codigo"],
        "nombre": producto["nombre"],
        "precio": f"${producto['precio']}",
    }


@app.get("/buscar")
def buscar_productos(q: str = Query(..., min_length=2)) -> dict[str, object]:
    try:
        productos = database.buscar_productos(q)
    except DatabaseError as exc:
        logger.exception("Error buscando productos: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "mensaje": "Error consultando la base de datos.",
            },
        )

    return {
        "success": True,
        "productos": [
            {
                "codigo": producto["codigo"],
                "nombre": producto["nombre"],
                "precio": f"${producto['precio']}",
            }
            for producto in productos
        ],
    }
