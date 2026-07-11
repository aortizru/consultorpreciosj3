# Consultor de Precios CompraYa

Aplicacion web responsive con FastAPI, SQL Server y escaneo de codigos usando `html5-qrcode`.

## Requisitos

- Python 3.12
- SQL Server accesible en `192.168.0.199`
- ODBC Driver 17 for SQL Server instalado en el equipo servidor

## Ejecutar

```bash
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8080
```

Luego abre:

```text
http://localhost:8080
```

Para usar la camara desde un celular, el navegador debe tener permiso de camara y acceder a un origen permitido por el navegador.

## HTTPS para camara en celular

Los navegadores moviles no permiten usar la camara desde una URL LAN en HTTP, por ejemplo `http://192.168.0.50:8080`.

Si abres `https://192.168.0.50:8080` mientras Uvicorn esta ejecutandose sin certificado SSL, Uvicorn mostrara:

```text
WARNING: Invalid HTTP request received.
```

Eso significa que el navegador envio una peticion HTTPS a un servidor que solo esta escuchando HTTP.

Para servir HTTPS necesitas un certificado y una llave:

```bash
uvicorn app:app --host 0.0.0.0 --port 8443 --ssl-certfile cert.pem --ssl-keyfile key.pem
```

Despues abre desde el celular:

```text
https://IP_DEL_PC:8443
```

Para produccion o uso estable en celulares, usa un certificado confiable para el dispositivo o publica la app detras de un proxy HTTPS.

### Crear certificado local de prueba

Busca la IP del PC en la red local y genera los archivos `cert.pem` y `key.pem`:

```powershell
python generar_certificado.py 192.168.0.50
```

Cambia `192.168.0.50` por la IP real del PC.

Si tienes OpenSSL instalado, tambien puedes usar:

```powershell
.\generar_certificado.ps1 -Ip 192.168.0.50
```

Luego ejecuta:

```powershell
python -m uvicorn app:app --host 0.0.0.0 --port 8443 --ssl-certfile cert.pem --ssl-keyfile key.pem
```
