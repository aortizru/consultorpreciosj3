from __future__ import annotations

import sys

from database import Database, DatabaseError


def main() -> int:
    termino = sys.argv[1] if len(sys.argv) > 1 else "papa"
    database = Database(pool_size=1)

    try:
      productos = database.buscar_productos(termino)
    except DatabaseError as exc:
      print("ERROR SQL SERVER:")
      print(exc)
      return 1
    finally:
      database.close_pool()

    print(f"Resultados para: {termino}")
    for producto in productos:
      print(f"{producto['codigo']} - {producto['nombre']} - ${producto['precio']}")

    if not productos:
      print("Sin resultados.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
