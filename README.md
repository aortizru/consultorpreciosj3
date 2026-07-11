# Consultor de Precios J3

Aplicacion web responsive tipo PWA para consultar precios desde SQL Server, con busqueda por nombre/codigo y escaneo de codigos de barras desde camara.

## Requisitos

- Windows 10/11
- Python 3.12
- ODBC Driver 17 for SQL Server
- Acceso al servidor SQL Server

## 1. Instalar Python 3.12 en Windows

1. Descarga Python 3.12 desde:

```text
https://www.python.org/downloads/
```

2. Ejecuta el instalador.
3. Marca la opcion:

```text
Add python.exe to PATH
```

4. Instala Python.
5. Cierra y vuelve a abrir PowerShell.
6. Verifica:

```powershell
python --version
```

Debe mostrar Python 3.12.x.

## 2. Instalar ODBC Driver para SQL Server

Instala Microsoft ODBC Driver 17 for SQL Server:

```text
https://learn.microsoft.com/sql/connect/odbc/download-odbc-driver-for-sql-server
```

Verifica que el driver instalado sea compatible con:

```text
ODBC Driver 17 for SQL Server
```

## 3. Preparar el proyecto

En PowerShell, entra a la carpeta del proyecto:

```powershell
cd "C:\ruta\al\proyecto\ConsultorPrecioCompraYa"
```

Crea un entorno virtual:

```powershell
python -m venv .venv
```

Activalo:

```powershell
.\.venv\Scripts\Activate.ps1
```

Si PowerShell bloquea scripts, ejecuta:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Luego activa de nuevo el entorno virtual.

Instala dependencias:

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## 4. Configurar conexion SQL Server

Copia el archivo de ejemplo:

```powershell
Copy-Item .env.example .env
```

Edita `.env`:

```text
SQLSERVER_SERVER=IP_O_SERVIDOR
SQLSERVER_DATABASE=J3System01
SQLSERVER_USER=SA
SQLSERVER_PASSWORD=TU_PASSWORD
```

El archivo `.env` no se sube a Git porque contiene datos sensibles.

## 5. Probar conexion y busqueda

Prueba una busqueda directa:

```powershell
python probar_db.py zanahoria
```

Si hay error, PowerShell mostrara el detalle de SQL Server u ODBC.

## 6. Ejecutar en PC local

Para probar desde el mismo PC:

```powershell
python -m uvicorn app:app --host 0.0.0.0 --port 8080 --reload
```

Abre:

```text
http://localhost:8080
```

## 7. Usar camara desde celular

Los navegadores moviles requieren HTTPS para usar la camara cuando entras desde una IP de red local.

Busca la IP del PC:

```powershell
ipconfig
```

Genera certificado local:

```powershell
python generar_certificado.py 192.168.1.19
```

Cambia `192.168.1.19` por la IP real del PC.

Ejecuta con HTTPS:

```powershell
python -m uvicorn app:app --host 0.0.0.0 --port 8443 --ssl-certfile cert.pem --ssl-keyfile key.pem --reload
```

Desde el celular abre:

```text
https://IP_DEL_PC:8443
```

Como el certificado es local/autofirmado, el navegador puede mostrar una advertencia de seguridad. Para pruebas puedes aceptarla.

## 8. Notas

- `cert.pem`, `key.pem` y `.env` no deben subirse a Git.
- Para uso estable en produccion, usa un certificado HTTPS confiable.
- Si una camara abre con gran angular, usa el selector de camara dentro del escaner y la app recordara la camara preferida.
