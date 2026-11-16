<#
.SYNOPSIS
  Build a shareable development package (whitelist copy + sensitive-file guards).

.DESCRIPTION
  Only whitelisted paths are copied, so .env.local / node_modules / dist / .artifacts can never
  end up inside the archive. Three checks run before zipping:
    1. no forbidden directory names anywhere in the staging tree;
    2. no .env*.local files;
    3. every secret-looking key in .env.example (any name containing PASSWORD,
       API_KEY, SECRET or TOKEN) must be empty, and server/db/10_legacy_v1.sql
       must exist.

  Output: _deliver\cloud-shadow-web-<timestamp>.zip  (archive root == project root)

  NOTE: this file is intentionally ASCII-only. Windows PowerShell 5.1 reads
  BOM-less scripts as ANSI, so non-ASCII literals would be mangled.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\pack.ps1
#>
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$stamp = Get-Date -Format 'yyyyMMdd-HHmm'
$deliverDir = Join-Path $root '_deliver'
$staging = Join-Path $deliverDir "cloud-shadow-web-$stamp"
$zipPath = "$staging.zip"

$whitelist = @(
  'src'
  'scripts'
  'docs'
  'server/src'
  'server/db'
  'server/scripts'
  'server/static-server.js'
  'server/package.json'
  'server/package-lock.json'
  'index.html'
  'package.json'
  'package-lock.json'
  'vite.config.js'
  'README.md'
  'CONVENTIONS.md'
  'HANDOFF.md'
  '.env.example'
  '.gitignore'
)

Write-Host "project root : $root"
Write-Host "output dir   : $deliverDir"
Write-Host ""

if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging -Force | Out-Null

$copied = 0
foreach ($item in $whitelist) {
  $source = Join-Path $root $item
  if (-not (Test-Path -LiteralPath $source)) {
    Write-Warning "skipped (missing): $item"
    continue
  }
  $target = Join-Path $staging $item
  $parent = Split-Path -Parent $target
  if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
  Copy-Item -LiteralPath $source -Destination $target -Recurse -Force
  $copied += 1
}

# Launcher scripts have non-ASCII names, so match them by extension instead of literal.
$batFiles = Get-ChildItem -LiteralPath $root -File -Filter '*.bat'
foreach ($bat in $batFiles) {
  Copy-Item -LiteralPath $bat.FullName -Destination (Join-Path $staging $bat.Name) -Force
  $copied += 1
}

# --- guard 1: forbidden directories / env files ---
$forbiddenDirs = @('node_modules', 'dist', '.artifacts', '.npm-cache', '.acl-recovery', '.git', '_deliver')
$badDirs = Get-ChildItem -LiteralPath $staging -Recurse -Force -Directory |
  Where-Object { $forbiddenDirs -contains $_.Name }
$badFiles = Get-ChildItem -LiteralPath $staging -Recurse -Force -File |
  Where-Object { $_.Name -match '^\.env\..*local$' }
if ($badDirs -or $badFiles) {
  $names = @($badDirs.FullName) + @($badFiles.FullName)
  throw ("staging contains paths that must not be shipped:`n" + ($names -join "`n"))
}

# --- guard 2: no real secrets in .env.example ---
# Match by key shape, not by an explicit list: a hardcoded list silently missed
# PIYING_IMAGE_API_KEY when that field was added later. Any key whose name contains
# PASSWORD / API_KEY / SECRET / TOKEN must be empty before packaging.
$envExample = Join-Path $staging '.env.example'
if (Test-Path -LiteralPath $envExample) {
  $hit = Select-String -LiteralPath $envExample -Pattern '^[A-Z0-9_]*(PASSWORD|API_KEY|SECRET|TOKEN)[A-Z0-9_]*=\s*\S'
  if ($hit) {
    $keys = ($hit | ForEach-Object { ($_.Line -split '=', 2)[0] }) -join ', '
    throw (".env.example has non-empty secret values ($keys); refusing to package.")
  }
} else {
  throw '.env.example is missing.'
}

# --- guard 3: legacy SQL must be present ---
$sql = Join-Path $staging 'server/db/10_legacy_v1.sql'
if (-not (Test-Path -LiteralPath $sql)) {
  throw 'server/db/10_legacy_v1.sql is missing; teammates cannot create the database.'
}

if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $zipPath -CompressionLevel Optimal

$files = Get-ChildItem -LiteralPath $staging -Recurse -File
$zipItem = Get-Item -LiteralPath $zipPath
$rawMB = [math]::Round((($files | Measure-Object Length -Sum).Sum / 1MB), 2)
$zipMB = [math]::Round(($zipItem.Length / 1MB), 2)

Write-Host ""
Write-Host "PACKAGE OK" -ForegroundColor Green
Write-Host ("  top-level items : {0}" -f $copied)
Write-Host ("  files           : {0}" -f $files.Count)
Write-Host ("  uncompressed    : {0} MB" -f $rawMB)
Write-Host ("  archive         : {0} ({1} MB)" -f $zipPath, $zipMB)
Write-Host ""
Write-Host "top level:"
Get-ChildItem -LiteralPath $staging -Force | Sort-Object Name | ForEach-Object {
  $kind = if ($_.PSIsContainer) { '[dir] ' } else { '      ' }
  Write-Host ("  {0}{1}" -f $kind, $_.Name)
}
