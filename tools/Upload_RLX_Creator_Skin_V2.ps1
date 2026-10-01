$ErrorActionPreference = "Stop"

$Repo = "RlxTechs/rlx-portfolio"
$RepoUrl = "https://github.com/$Repo.git"
$Branch = "main"
$TargetRelative = "assets/skins/rlx-creator-skin.glb"
$DefaultSkin = "C:\Users\ASUS\Downloads\Meshy_AI_Meshy_Merged_Animations (2)-rigged.glb"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " RLX CREATOR KIT - UPLOADER V2" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git n'est pas installe ou n'est pas dans le PATH."
}

$SkinPath = $DefaultSkin
if (-not (Test-Path -LiteralPath $SkinPath)) {
    Add-Type -AssemblyName System.Windows.Forms
    $dlg = New-Object System.Windows.Forms.OpenFileDialog
    $dlg.Filter = "Fichiers GLB (*.glb)|*.glb|Tous les fichiers (*.*)|*.*"
    $dlg.Title = "Choisis le skin GLB pour RLX Creator Kit"
    if ($dlg.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
        throw "Aucun fichier choisi."
    }
    $SkinPath = $dlg.FileName
}

$File = Get-Item -LiteralPath $SkinPath
$SizeMB = [Math]::Round($File.Length / 1MB, 2)
Write-Host "Skin : $($File.FullName)" -ForegroundColor White
Write-Host "Taille : $SizeMB MB" -ForegroundColor White

$SecureToken = Read-Host "Colle ton GitHub Fine-grained token" -AsSecureString
$BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureToken)
try {
    $PlainToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
}
if ([string]::IsNullOrWhiteSpace($PlainToken)) {
    throw "Token vide."
}

$Temp = Join-Path $env:TEMP ("RLXCreatorUpload-" + [guid]::NewGuid().ToString("N"))
$AskPass = Join-Path $Temp "askpass.cmd"
$RepoDir = Join-Path $Temp "repo"

New-Item -ItemType Directory -Force -Path $Temp | Out-Null

@"
@echo off
echo %~1 | findstr /I "Username" >nul
if %errorlevel%==0 (
  echo x-access-token
) else (
  echo %RLX_GITHUB_TOKEN%
)
"@ | Set-Content -LiteralPath $AskPass -Encoding ASCII

$env:RLX_GITHUB_TOKEN = $PlainToken
$env:GIT_ASKPASS = $AskPass
$env:GIT_TERMINAL_PROMPT = "0"

try {
    Write-Host ""
    Write-Host "[1/5] Connexion au depot GitHub..." -ForegroundColor Yellow
    & git clone --depth 1 --branch $Branch $RepoUrl $RepoDir
    if ($LASTEXITCODE -ne 0) { throw "Clone GitHub impossible. Verifie le token et la permission Contents: Read and write." }

    Set-Location $RepoDir
    & git config user.name "RLX Creator Uploader"
    & git config user.email "142737930+RlxTechs@users.noreply.github.com"

    Write-Host "[2/5] Preparation du fichier..." -ForegroundColor Yellow
    $Target = Join-Path $RepoDir ($TargetRelative -replace '/', [IO.Path]::DirectorySeparatorChar)
    New-Item -ItemType Directory -Force -Path (Split-Path $Target) | Out-Null

    if ($File.Length -ge 95MB) {
        Write-Host "Le fichier approche/depasse la limite GitHub normale. Activation Git LFS..." -ForegroundColor Yellow
        & git lfs version | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Le GLB fait $SizeMB MB. Installe Git LFS (git-lfs.com), puis relance ce script."
        }
        & git lfs install --local
        & git lfs track "assets/skins/*.glb"
        & git add .gitattributes
    }

    Copy-Item -LiteralPath $SkinPath -Destination $Target -Force

    Write-Host "[3/5] Ajout au commit..." -ForegroundColor Yellow
    & git add -- $TargetRelative
    if ($LASTEXITCODE -ne 0) { throw "git add a echoue." }

    $Status = & git status --porcelain
    if (-not $Status) {
        Write-Host "Le skin GitHub est deja identique. Aucun nouveau commit necessaire." -ForegroundColor Green
    } else {
        & git commit -m "Update RLX Creator Kit default skin"
        if ($LASTEXITCODE -ne 0) { throw "git commit a echoue." }

        Write-Host "[4/5] Envoi vers GitHub..." -ForegroundColor Yellow
        & git push origin $Branch
        if ($LASTEXITCODE -ne 0) {
            throw "git push a echoue. Le skin N'A PAS ete envoye."
        }
    }

    Write-Host "[5/5] Verification..." -ForegroundColor Yellow
    $Commit = (& git rev-parse HEAD).Trim()
    if (-not (Test-Path -LiteralPath $Target)) { throw "Le fichier n'est pas present apres le push." }

    Write-Host ""
    Write-Host "SUCCES REEL : skin publie dans GitHub." -ForegroundColor Green
    Write-Host "Commit : $Commit" -ForegroundColor Green
    Write-Host "Fichier : $TargetRelative" -ForegroundColor Green
    Write-Host "URL publique apres deploiement Netlify :" -ForegroundColor Cyan
    Write-Host "https://rlx-kingdom.netlify.app/assets/skins/rlx-creator-skin.glb" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "RLX Creator Kit essaiera automatiquement de charger ce fichier." -ForegroundColor White
}
catch {
    Write-Host ""
    Write-Host "ECHEC : $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Aucun faux message de succes ne sera affiche." -ForegroundColor Red
    exit 1
}
finally {
    Set-Location $env:USERPROFILE
    $env:RLX_GITHUB_TOKEN = $null
    $env:GIT_ASKPASS = $null
    $env:GIT_TERMINAL_PROMPT = $null
    $PlainToken = $null
    Remove-Item -LiteralPath $Temp -Recurse -Force -ErrorAction SilentlyContinue
}
