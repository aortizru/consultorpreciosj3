param(
    [Parameter(Mandatory = $true)]
    [string]$Ip
)

$certPath = Join-Path $PSScriptRoot "cert.pem"
$keyPath = Join-Path $PSScriptRoot "key.pem"

if (Get-Command openssl -ErrorAction SilentlyContinue) {
    openssl req `
        -x509 `
        -newkey rsa:2048 `
        -keyout $keyPath `
        -out $certPath `
        -days 365 `
        -nodes `
        -subj "/CN=$Ip" `
        -addext "subjectAltName=IP:$Ip,DNS:localhost"

    Write-Host "Certificado creado:"
    Write-Host $certPath
    Write-Host $keyPath
    exit 0
}

Write-Error "No se encontro openssl. Instala OpenSSL o Git for Windows y vuelve a ejecutar este script."
exit 1
