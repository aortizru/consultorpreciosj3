from __future__ import annotations

import os
import queue
import threading
from contextlib import contextmanager
from typing import Any, Iterator

import pyodbc
from dotenv import load_dotenv


load_dotenv()


SQLSERVER_DATABASE = "J3System01"
SQLSERVER_USER = "SA"


class DatabaseError(Exception):
    """Error controlado para no filtrar detalles internos de SQL Server al cliente."""


class Database:
    QUERY_PRODUCTO = """
        SELECT
            AdmBarras.BarrasCodigo,
            ArticulosNombre,
            REPLACE(CONVERT(VARCHAR, CONVERT(MONEY, ArticulosVenta),1),'.00','') AS ArticuloVenta
        FROM AdmBarras
        INNER JOIN AdmArticulos
        ON AdmBarras.ArticulosID=AdmArticulos.ArticulosID
        WHERE AdmBarras.BarrasCodigo = ?
    """

    def __init__(self, pool_size: int = 5) -> None:
        self.pool_size = pool_size
        self._pool: queue.Queue[pyodbc.Connection] = queue.Queue(maxsize=pool_size)
        self._created_connections = 0
        self._lock = threading.Lock()
        self.connection_string = os.getenv(
            "SQLSERVER_CONNECTION_STRING",
            (
                "DRIVER={ODBC Driver 17 for SQL Server};"
                f"SERVER={os.getenv('SQLSERVER_SERVER', '127.0.0.1')};"
                f"DATABASE={SQLSERVER_DATABASE};"
                f"UID={SQLSERVER_USER};"
                f"PWD={os.getenv('SQLSERVER_PASSWORD', '')};"
                "TrustServerCertificate=yes;"
            ),
        )
        self.connection_string = self._normalize_connection_string(self.connection_string)

    def _normalize_connection_string(self, connection_string: str) -> str:
        return (
            connection_string.replace("Data Source=", "SERVER=")
            .replace("Initial Catalog=", "DATABASE=")
            .replace("User ID=", "UID=")
            .replace("Password=", "PWD=")
        )

    def _create_connection(self) -> pyodbc.Connection:
        return pyodbc.connect(self.connection_string, timeout=5, autocommit=True)

    @contextmanager
    def get_connection(self) -> Iterator[pyodbc.Connection]:
        connection: pyodbc.Connection | None = None

        try:
            try:
                connection = self._pool.get_nowait()
            except queue.Empty:
                with self._lock:
                    if self._created_connections < self.pool_size:
                        connection = self._create_connection()
                        self._created_connections += 1

                if connection is None:
                    connection = self._pool.get(timeout=10)

            yield connection
        except pyodbc.Error as exc:
            if connection is not None:
                try:
                    connection.close()
                finally:
                    with self._lock:
                        self._created_connections -= 1
                connection = None
            raise DatabaseError(str(exc)) from exc
        except queue.Empty as exc:
            raise DatabaseError("No hay conexiones disponibles") from exc
        finally:
            if connection is not None:
                self._pool.put(connection)

    def buscar_producto(self, codigo: str) -> dict[str, Any] | None:
        with self.get_connection() as connection:
            cursor = connection.cursor()
            cursor.execute(self.QUERY_PRODUCTO, codigo)
            row = cursor.fetchone()
            cursor.close()

        if row is None:
            return None

        return {
            "codigo": row.BarrasCodigo,
            "nombre": row.ArticulosNombre,
            "precio": row.ArticuloVenta,
        }

    def buscar_productos(self, termino: str) -> list[dict[str, Any]]:
        termino = termino.strip()

        if len(termino) < 2:
            return []

        tokens = [token for token in termino.split() if len(token) > 1][:6]
        if not tokens:
            return []

        starts_with = f"{termino}%"
        contains = f"%{termino}%"
        token_conditions = " AND ".join(
            "AdmArticulos.ArticulosNombre LIKE ?" for _ in tokens
        )
        token_params = [f"%{token}%" for token in tokens]
        query = f"""
            SELECT TOP 10
                CONVERT(VARCHAR(50), AdmBarras.BarrasCodigo) AS BarrasCodigo,
                ArticulosNombre,
                REPLACE(CONVERT(VARCHAR, CONVERT(MONEY, ArticulosVenta),1),'.00','') AS ArticuloVenta
            FROM AdmBarras
            INNER JOIN AdmArticulos
            ON AdmBarras.ArticulosID=AdmArticulos.ArticulosID
            WHERE CONVERT(VARCHAR(50), AdmBarras.BarrasCodigo) LIKE ?
            OR AdmArticulos.ArticulosNombre LIKE ?
            OR ({token_conditions})
            ORDER BY
                CASE
                    WHEN CONVERT(VARCHAR(50), AdmBarras.BarrasCodigo) = ? THEN 0
                    WHEN CONVERT(VARCHAR(50), AdmBarras.BarrasCodigo) LIKE ? THEN 1
                    WHEN AdmArticulos.ArticulosNombre LIKE ? THEN 2
                    ELSE 3
                END,
                AdmArticulos.ArticulosNombre
        """

        with self.get_connection() as connection:
            cursor = connection.cursor()
            cursor.execute(
                query,
                starts_with,
                contains,
                *token_params,
                termino,
                starts_with,
                contains,
            )
            rows = cursor.fetchall()
            cursor.close()

        return [
            {
                "codigo": row.BarrasCodigo,
                "nombre": row.ArticulosNombre,
                "precio": row.ArticuloVenta,
            }
            for row in rows
        ]

    def close_pool(self) -> None:
        while not self._pool.empty():
            connection = self._pool.get_nowait()
            connection.close()

        with self._lock:
            self._created_connections = 0
