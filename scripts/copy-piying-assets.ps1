# 实现功能：把 testdemo 里已验收的皮影素材同步到主工程的 public/ 目录
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File scripts/copy-piying-assets.ps1
# 说明：public/cv/vendor（wasm + 姿态模型，约 44MB）不进 git，clone 后跑一次本脚本即可。
#       角色与砌末图、过场 BGM 也一并复制，保证 /curtain 页面开箱可用。

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'testdemo'
$dst = Join-Path $root 'public'

if (-not (Test-Path $src)) {
  Write-Error "找不到 testdemo 目录：$src（素材来源于此，请先恢复该目录）"
  exit 1
}

$copies = @(
  @{ From = 'piying-rig\characters\general\manifest.json'; To = 'piying\characters\general\manifest.json' },
  @{ From = 'piying-rig\characters\general\assets';        To = 'piying\characters\general\assets' },
  @{ From = 'piying-rig\characters\warrior\manifest.json'; To = 'piying\characters\warrior\manifest.json' },
  @{ From = 'piying-rig\characters\warrior\assets';        To = 'piying\characters\warrior\assets' },
  @{ From = 'piying-rig\characters\warrior\source\puppet.png'; To = 'piying\characters\warrior\source\puppet.png' },
  @{ From = 'piying-rig\characters\index.json';            To = 'piying\characters\index.json' },
  @{ From = 'piying-rig\scenery\index.json';               To = 'piying\scenery\index.json' },
  @{ From = 'piying-rig\scenery\assets';                   To = 'piying\scenery\assets' },
  @{ From = 'piying-rig\audio\library\3460690259_BGM\audio-320k.mp3'; To = 'piying\audio\battle-bgm.mp3' },
  @{ From = 'CV\vendor\tasks-vision\vision_bundle.mjs';    To = 'cv\vendor\tasks-vision\vision_bundle.mjs' },
  @{ From = 'CV\vendor\tasks-vision\wasm';                 To = 'cv\vendor\tasks-vision\wasm' },
  @{ From = 'CV\vendor\models';                            To = 'cv\vendor\models' }
)

foreach ($item in $copies) {
  $from = Join-Path $src $item.From
  $to = Join-Path $dst $item.To
  if (-not (Test-Path $from)) {
    Write-Warning "跳过（源不存在）：$($item.From)"
    continue
  }
  $parent = Split-Path -Parent $to
  if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  if (Test-Path $from -PathType Container) {
    New-Item -ItemType Directory -Force -Path $to | Out-Null
    Copy-Item (Join-Path $from '*') $to -Recurse -Force
  } else {
    Copy-Item $from $to -Force
  }
  Write-Host "OK  $($item.From) → public\$($item.To)"
}

$size = (Get-ChildItem -Recurse -File $dst -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1MB
Write-Host ("完成：public/ 共 {0:N1} MB" -f $size)
