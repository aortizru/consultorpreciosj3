from __future__ import annotations

import ipaddress
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


def main() -> int:
    if len(sys.argv) != 2:
        print("Uso: python generar_certificado.py IP_DEL_PC")
        print("Ejemplo: python generar_certificado.py 192.168.1.19")
        return 1

    ip = ipaddress.ip_address(sys.argv[1])
    output_dir = Path(__file__).resolve().parent
    cert_path = output_dir / "cert.pem"
    key_path = output_dir / "key.pem"

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name(
        [
            x509.NameAttribute(NameOID.COUNTRY_NAME, "CO"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "CompraYa Local"),
            x509.NameAttribute(NameOID.COMMON_NAME, str(ip)),
        ]
    )

    certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.now(timezone.utc) - timedelta(minutes=1))
        .not_valid_after(datetime.now(timezone.utc) + timedelta(days=365))
        .add_extension(
            x509.SubjectAlternativeName(
                [
                    x509.IPAddress(ip),
                    x509.DNSName("localhost"),
                ]
            ),
            critical=False,
        )
        .sign(private_key, hashes.SHA256())
    )

    key_path.write_bytes(
        private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    cert_path.write_bytes(certificate.public_bytes(serialization.Encoding.PEM))

    print(f"Certificado creado: {cert_path}")
    print(f"Llave creada: {key_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
