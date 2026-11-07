<#
.SYNOPSIS
  Extract the image assets subtree from the source project zip into assets/images.

.DESCRIPTION
  The web project is self-contained, but the 603 MB image set is intentionally excluded from git.
  This script pulls only storage/assets/legacy-import/images/** out of the source zip,
  preserving the directory layout the middleware expects.

  Source zip default:
    D:\JuYingShare\Cloud-Shadow-2026-08-03.zip  (configured via -ZipPath)

  NOTE: ASCII-only on purpose. Windows PowerShell 5.1 reads BOM-less scripts as ANSI,
  so non-ASCII literals would be mangled.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\extract-assets.ps1

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\extract-assets.ps1 -ZipPath D:\path\src.zip
#>
param(
  [string]$ZipPath = 'D:\聚萤分享\Cloud-Shadow-2026-08-03.zip',
  [string]$Destination = ''
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
if (-not $Destination) { $Destination = Join-Path $root 'assets\images' }

Write-Host "source zip : $ZipPath"
Write-Host "destination: $Destination"

if (-not (Test-Path -LiteralPath $ZipPath)) {
  Write-Error "source zip not found: $ZipPath"
  exit 1
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)

# Match any top-level folder name; keep only the images subtree.
$entries = $zip.Entries | Where-Object {
  $_.FullName -match '/storage/assets/legacy-import/images/' -and $_.Name -ne ''
}

if (-not $entries) {
  $zip.Dispose()
  Write-Error 'no images/** entries found inside the zip'
  exit 1
}

Write-Host ("entries to extract: {0}" -f $entries.Count)

$copied = 0
$failed = 0
foreach ($entry in $entries) {
  # strip everything up to and including .../legacy-import/images/
  $marker = '/storage/assets/legacy-import/images/'
  $idx = $entry.FullName.IndexOf($marker)
  if ($idx -lt 0) { continue }
  $relative = $entry.FullName.Substring($idx + $marker.Length)
  if ([string]::IsNullOrWhiteSpace($relative)) { continue }

  $target = Join-Path $Destination ($relative -replace '/', '\')
  $dir = Split-Path $target -Parent
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  try {
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
    $copied++
  } catch {
    $failed++
    if ($failed -le 3) { Write-Warning ("failed: " + $relative + " -> " + $_.Exception.Message) }
  }
}
$zip.Dispose()

$files = Get-ChildItem -LiteralPath $Destination -Recurse -File -ErrorAction SilentlyContinue
$sizeMB = 0
if ($files) { $sizeMB = [math]::Round((($files | Measure-Object Length -Sum).Sum / 1MB), 0) }

Write-Host ""
Write-Host ("extracted: {0}, failed: {1}" -f $copied, $failed) -ForegroundColor Green
Write-Host ("destination files: {0}, size: {1} MB" -f $files.Count, $sizeMB)

if ($failed -gt 0) { exit 1 }
