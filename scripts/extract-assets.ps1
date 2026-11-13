<#
.SYNOPSIS
  Populate assets/images from the source project directory or its zip.

.DESCRIPTION
  The web project is self-contained, but the 603 MB image set is intentionally excluded from git.
  Two ways to fill it, tried in this order:
    1) -SourceDir : copy from an extracted source project (fastest, uses robocopy)
    2) -ZipPath   : extract storage/assets/legacy-import/images/** out of the source zip

  Defaults point at the current source project location; override either one as needed.

  NOTE: this file must stay UTF-8 **with BOM**. Windows PowerShell 5.1 reads BOM-less files as
  ANSI, which mangles the non-ASCII default paths and silently breaks the script. (.bat is the
  opposite: never add a BOM there, cmd would choke on its first line.)

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\extract-assets.ps1

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\extract-assets.ps1 -ZipPath "..\某处\源工程.zip"

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\extract-assets.ps1 -SourceDir "..\某处\images"
#>
param(
  # 默认值一律写成「相对工程根」的路径（源工程、旧 zip 都与本工程同级），
  # 不再把盘符绝对路径焊死在脚本里；需要时用参数覆盖。
  [string]$SourceDir = '..\PiYingGameWeChat\storage\assets\legacy-import\images',
  [string]$ZipPath = '..\聚萤分享\Cloud-Shadow-2026-08-03.zip',
  [string]$Destination = ''
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
if (-not $Destination) { $Destination = Join-Path $root 'assets\images' }

# 相对路径统一相对工程根解析（绝对路径原样保留，便于临时指定任意位置）
if ($SourceDir -and -not [System.IO.Path]::IsPathRooted($SourceDir)) {
  $SourceDir = [System.IO.Path]::GetFullPath((Join-Path $root $SourceDir))
}
if ($ZipPath -and -not [System.IO.Path]::IsPathRooted($ZipPath)) {
  $ZipPath = [System.IO.Path]::GetFullPath((Join-Path $root $ZipPath))
}
if (-not [System.IO.Path]::IsPathRooted($Destination)) {
  $Destination = [System.IO.Path]::GetFullPath((Join-Path $root $Destination))
}

Write-Host "source dir : $SourceDir"
Write-Host "source zip : $ZipPath"
Write-Host "destination: $Destination"

New-Item -ItemType Directory -Path $Destination -Force | Out-Null
$copied = 0
$failed = 0

# 显式传了 -ZipPath 就优先用 zip；否则只要目录源存在就复制（更快）
$explicitZip = $PSBoundParameters.ContainsKey('ZipPath')
if (-not $explicitZip -and $SourceDir -and (Test-Path -LiteralPath $SourceDir)) {
  Write-Host 'mode: copy from directory'
  $null = robocopy $SourceDir $Destination /E /NFL /NDL /NJH /NP /R:1 /W:1
  $code = $LASTEXITCODE
  # robocopy exit codes: 0..7 are success bit flags, >=8 means failure
  if ($code -ge 8) {
    Write-Error "robocopy failed with code $code"
    exit 1
  }
  $copied = (Get-ChildItem -LiteralPath $Destination -Recurse -File -ErrorAction SilentlyContinue).Count
}
elseif ($ZipPath -and (Test-Path -LiteralPath $ZipPath)) {
  Write-Host 'mode: extract from zip'
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
  $marker = '/storage/assets/legacy-import/images/'
  $entries = $zip.Entries | Where-Object {
    $_.FullName.Contains($marker) -and $_.Name -ne ''
  }
  if (-not $entries) {
    $zip.Dispose()
    Write-Error 'no images/** entries found inside the zip'
    exit 1
  }
  Write-Host ("entries to extract: {0}" -f $entries.Count)
  $destPrefix = $Destination.TrimEnd('\') + '\'
  foreach ($entry in $entries) {
    $idx = $entry.FullName.IndexOf($marker)
    if ($idx -lt 0) { continue }
    $relative = $entry.FullName.Substring($idx + $marker.Length)
    if ([string]::IsNullOrWhiteSpace($relative)) { continue }
    $relWin = $relative -replace '/', '\'
    # Zip Slip 防护：拒绝 .. 段与绝对路径，并校验规范化后的目标仍在 Destination 内
    $segments = $relWin -split '\\'
    if ($segments -contains '..' -or [System.IO.Path]::IsPathRooted($relWin)) {
      $failed++
      Write-Warning ("skipped unsafe entry (path traversal): " + $entry.FullName)
      continue
    }
    $target = [System.IO.Path]::GetFullPath((Join-Path $Destination $relWin))
    if (-not $target.StartsWith($destPrefix)) {
      $failed++
      Write-Warning ("skipped unsafe entry (outside destination): " + $entry.FullName)
      continue
    }
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
}
else {
  Write-Error ("Neither source is available.`n  -SourceDir : " + $SourceDir + "`n  -ZipPath   : " + $ZipPath + "`nPass one of them explicitly.")
  exit 1
}

$files = Get-ChildItem -LiteralPath $Destination -Recurse -File -ErrorAction SilentlyContinue
$sizeMB = 0
if ($files) { $sizeMB = [math]::Round((($files | Measure-Object Length -Sum).Sum / 1MB), 0) }

Write-Host ""
Write-Host ("done. copied: {0}, failed: {1}" -f $copied, $failed) -ForegroundColor Green
Write-Host ("destination files: {0}, size: {1} MB" -f $files.Count, $sizeMB)

if ($failed -gt 0) { exit 1 }
