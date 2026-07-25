param(
  [switch]$SinInstalarDependencias
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host '== SonarQube Dashboard: generando VSIX ==' -ForegroundColor Cyan

if (-not $SinInstalarDependencias) {
  if (Test-Path 'package-lock.json') {
    Write-Host 'Instalando dependencias con npm ci...'
    npm ci
  }
  else {
    Write-Host 'Instalando dependencias con npm install...'
    npm install
  }

  if ($LASTEXITCODE -ne 0) {
    throw 'No se pudieron instalar las dependencias.'
  }
}

Write-Host 'Compilando TypeScript...'
npm run compile
if ($LASTEXITCODE -ne 0) {
  throw 'La compilación ha fallado.'
}

$version = node -p "require('./package.json').version"
if ($LASTEXITCODE -ne 0) {
  throw 'No se pudo leer la versión de package.json.'
}

$output = "sonarqube-dashboard-$version.vsix"
if (Test-Path $output) {
  Remove-Item $output -Force
}

Write-Host "Empaquetando $output..."
npx --yes @vscode/vsce package --out $output
if ($LASTEXITCODE -ne 0) {
  throw 'No se pudo generar el archivo VSIX.'
}

Write-Host "VSIX generado: $((Resolve-Path $output).Path)" -ForegroundColor Green
