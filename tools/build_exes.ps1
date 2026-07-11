$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $PSScriptRoot
$installerSource = Join-Path $PSScriptRoot "InstalarTodo.cs"
$starterSource = Join-Path $PSScriptRoot "IniciarServicio.cs"
$installerExe = Join-Path $projectDir "InstalarTodo.exe"
$starterExe = Join-Path $projectDir "IniciarServicio.exe"

Write-Host "Compilando InstalarTodo.exe..."
Add-Type -TypeDefinition (Get-Content $installerSource -Raw) -OutputType ConsoleApplication -OutputAssembly $installerExe

Write-Host "Compilando IniciarServicio.exe..."
Add-Type -TypeDefinition (Get-Content $starterSource -Raw) -OutputType ConsoleApplication -OutputAssembly $starterExe

Write-Host ""
Write-Host "Listo:"
Write-Host " - $installerExe"
Write-Host " - $starterExe"
