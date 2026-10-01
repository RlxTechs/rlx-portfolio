# RLX Creator Kit GLB uploader
# 1) Va sur https://github.com/settings/tokens et cree un token avec permission repo/content write
# 2) Lance ce script dans PowerShell

$ErrorActionPreference = 'Stop'
$Repo = 'RlxTechs/rlx-portfolio'
$Branch = 'main'
$TargetPath = 'assets/skins/rlx-creator-skin.glb'
$SkinPath = 'C:\Users\ASUS\Downloads\Meshy_AI_Meshy_Merged_Animations (2)-rigged.glb'

if (!(Test-Path $SkinPath)) {
  $SkinPath = Read-Host 'Chemin complet du fichier GLB'
}
if (!(Test-Path $SkinPath)) { throw "Fichier introuvable: $SkinPath" }

$Token = Read-Host 'Colle ton GitHub token' -AsSecureString
$BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Token)
$PlainToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

$Bytes = [IO.File]::ReadAllBytes($SkinPath)
$Base64 = [Convert]::ToBase64String($Bytes)
$Api = "https://api.github.com/repos/$Repo/contents/$TargetPath"
$Headers = @{ Authorization = "Bearer $PlainToken"; Accept = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28'; 'User-Agent' = 'RLX-CreatorKit-Uploader' }

$Sha = $null
try {
  $Current = Invoke-RestMethod -Method GET -Uri ($Api + "?ref=$Branch") -Headers $Headers
  $Sha = $Current.sha
} catch { }

$Body = @{ message = 'Upload RLX Creator Kit default GLB skin'; content = $Base64; branch = $Branch } 
if ($Sha) { $Body.sha = $Sha }

Invoke-RestMethod -Method PUT -Uri $Api -Headers $Headers -Body ($Body | ConvertTo-Json -Depth 5) -ContentType 'application/json' | Out-Null
Write-Host ''
Write-Host 'Skin envoye avec succes.' -ForegroundColor Green
Write-Host 'URL brute: https://raw.githubusercontent.com/RlxTechs/rlx-portfolio/main/assets/skins/rlx-creator-skin.glb'
Write-Host 'Attends le redeploiement Netlify, puis ouvre https://rlx-kingdom.netlify.app/'
