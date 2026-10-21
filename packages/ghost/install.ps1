# Ghost CLI installer — Windows (PowerShell 5.1+; uses built-in curl.exe + tar.exe, no npm)
#   curl -fsSL https://raw.githubusercontent.com/arko33/ghostinthecodebase/main/packages/ghost/install.ps1 -o ghost-install.ps1
#   powershell -ExecutionPolicy Bypass -File ghost-install.ps1
# Result: `ghost` command on user PATH, recorder files in %USERPROFILE%\.ghost\lib
$ErrorActionPreference = "Stop"

$Repo = "arko33/ghostinthecodebase"
$Ref  = if ($env:GHOST_REF) { $env:GHOST_REF } else { "main" }
$GhostLib = Join-Path $HOME ".ghost\lib"
$GhostBin = Join-Path $HOME ".ghost\bin"
$Tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("gh-" + [Guid]::NewGuid().ToString("N"))

Write-Host "==> Downloading Ghost recorder (branch: $Ref)"
New-Item -ItemType Directory -Force -Path $Tmp, $GhostLib, $GhostBin | Out-Null
$Tgz = Join-Path $Tmp "ghost.tar.gz"
& curl.exe -fsSL "https://codeload.github.com/$Repo/tar.gz/refs/heads/$Ref" -o $Tgz
if ($LASTEXITCODE -ne 0) { throw "download failed (curl exit $LASTEXITCODE)" }

& tar -xzf $Tgz -C $Tmp
$Src = Get-ChildItem -Path $Tmp -Recurse -Directory -Filter ghost |
       Where-Object { $_.FullName -like "*packages\ghost" -or $_.FullName -like "*packages/ghost" } |
       Select-Object -First 1
if (-not $Src) { throw "packages/ghost not found in tarball" }

Write-Host "==> Installing to $GhostLib"
Copy-Item -Path (Join-Path $Src.FullName "*") -Destination $GhostLib -Recurse -Force

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host ""
  Write-Host "x Node.js >= 18 is required (the CLI is a plain node script)." -ForegroundColor Red
  Write-Host "  Install it from https://nodejs.org, then re-run this installer." -ForegroundColor Red
  exit 1
}

$Shim = Join-Path $GhostBin "ghost.cmd"
Set-Content -Path $Shim -Value "@echo off`r`nnode `"$GhostLib\ghost.mjs`" %*" -Encoding ascii
Write-Host "==> Shim written: $Shim"

# Add to the user PATH if not already present
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$GhostBin*") {
  [Environment]::SetEnvironmentVariable("Path", "$UserPath;$GhostBin", "User")
  Write-Host "==> Added to user PATH: $GhostBin"
}

$env:Path = "$env:Path;$GhostBin"
Write-Host ""
Write-Host "v Ghost recorder installed:" -ForegroundColor Green
Write-Host "   files : $GhostLib"
Write-Host "   shim  : $Shim"
Write-Host ""
Write-Host "   Usage (from ANY project directory):"
Write-Host "     ghost status        # summary of repo + cloud pairing"
Write-Host "     ghost watch         # record/live session (see README)"
Write-Host "     ghost sessions      # list recorded sessions"
Write-Host "     ghost setup         # optionally pair with Ghost Cloud"
Write-Host ""
Write-Host "   Open a NEW terminal (PATH refresh), then run: ghost status"

Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
