param(
    [string]$ProjectRoot = ".",
    [string]$SourceZipUrl = "",
    [string]$GitHubRepo = "",
    [string]$GitHubBranch = "main",
    [string]$EndpointUrl = "",
    [switch]$UseConfig,
    [switch]$NoBackup
)

# Resolve paths
$ErrorActionPreference = 'Stop'
try {
    $ProjectRoot = (Resolve-Path -Path $ProjectRoot).Path
} catch { }

$stamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
$TmpRoot = Join-Path $env:TEMP ("msfix-" + $stamp)
$ZipPath = Join-Path $TmpRoot "src.zip"
$UnzipPath = Join-Path $TmpRoot "unzipped"

Write-Host "[Fix.ps1] ProjectRoot: $ProjectRoot" -ForegroundColor Cyan

# Load config values if requested
$CfgSourceZip = ""; $CfgRepo = ""; $CfgBranch = ""; $CfgEndpoint = ""
if ($UseConfig) {
    try {
        $cfgPath = Join-Path $ProjectRoot 'V3 TESTING\js\config.js'
        if (Test-Path $cfgPath) {
            $cfg = Get-Content -Raw $cfgPath
            function Get-ConfigValue([string]$content, [string]$name) {
                $m = [regex]::Match($content, 'window\.__' + [regex]::Escape($name) + "__\s*=\s*'([^']*)';")
                if ($m.Success) { return $m.Groups[1].Value } else { return "" }
            }
            $CfgSourceZip = Get-ConfigValue $cfg 'MS_SOURCEZIP'
            $CfgRepo = Get-ConfigValue $cfg 'MS_GITHUB_REPO'
            $CfgBranch = Get-ConfigValue $cfg 'MS_GITHUB_BRANCH'
            $CfgEndpoint = Get-ConfigValue $cfg 'MS_ENDPOINT'
        }
    } catch { Write-Warning "[Fix.ps1] Could not read config.js: $($_.Exception.Message)" }
}

# Decide effective values (param > config)
if (-not [string]::IsNullOrWhiteSpace($CfgBranch)) { $CfgBranch = $CfgBranch } else { $CfgBranch = 'main' }
$EffectiveSourceZipUrl = if ($SourceZipUrl) { $SourceZipUrl } elseif ($GitHubRepo) { "https://github.com/$GitHubRepo/archive/refs/heads/$GitHubBranch.zip" } elseif ($CfgSourceZip) { $CfgSourceZip } elseif ($CfgRepo) { "https://github.com/$CfgRepo/archive/refs/heads/$CfgBranch.zip" } else { "" }
$EffectiveEndpoint = if ($EndpointUrl) { $EndpointUrl } elseif ($CfgEndpoint) { $CfgEndpoint } else { "" }

if (-not $EffectiveSourceZipUrl) {
    Write-Error "[Fix.ps1] No SourceZipUrl provided. Pass -SourceZipUrl, or -GitHubRepo, or use -UseConfig with config.js values (__MS_SOURCEZIP__ or __MS_GITHUB_REPO__)."
    exit 1
}

Write-Host "[Fix.ps1] SourceZipUrl: $EffectiveSourceZipUrl" -ForegroundColor Cyan
if ($EffectiveEndpoint) { Write-Host "[Fix.ps1] EndpointUrl: $EffectiveEndpoint" -ForegroundColor Cyan }

# Prepare temp dirs
New-Item -ItemType Directory -Path $TmpRoot -Force | Out-Null

# Optional backup
if (-not $NoBackup) {
    $backupZip = Join-Path $ProjectRoot ("backup-" + $stamp + ".zip")
    Write-Host "[Fix.ps1] Creating backup: $backupZip" -ForegroundColor Yellow
    try {
        if (Test-Path $backupZip) { Remove-Item $backupZip -Force }
        Compress-Archive -Path (Join-Path $ProjectRoot '*') -DestinationPath $backupZip -Force
    } catch {
        Write-Warning "[Fix.ps1] Backup failed: $($_.Exception.Message)"
    }
}

# Download zip
Write-Host "[Fix.ps1] Downloading latest package..." -ForegroundColor Yellow
try {
    # Ensure TLS 1.2 support on Windows PowerShell
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }
    Invoke-WebRequest -Uri $EffectiveSourceZipUrl -OutFile $ZipPath -UseBasicParsing
} catch {
    Write-Error "[Fix.ps1] Download failed: $($_.Exception.Message)"; exit 1
}

# Extract
Write-Host "[Fix.ps1] Extracting package..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $UnzipPath -Force | Out-Null
try {
    Expand-Archive -Path $ZipPath -DestinationPath $UnzipPath -Force
} catch {
    Write-Error "[Fix.ps1] Extraction failed: $($_.Exception.Message)"; exit 1
}

# Determine content root (handle zips with a single top-level folder)
$children = Get-ChildItem -Path $UnzipPath
if ($children.Count -eq 1 -and $children[0].PSIsContainer) {
    $ContentRoot = $children[0].FullName
} else {
    $ContentRoot = $UnzipPath
}

# Copy files into project root
Write-Host "[Fix.ps1] Updating project files..." -ForegroundColor Yellow
try {
    Copy-Item -Path (Join-Path $ContentRoot '*') -Destination $ProjectRoot -Recurse -Force
} catch {
    Write-Error "[Fix.ps1] Copy failed: $($_.Exception.Message)"; exit 1
}

# Write/update config.js for MessageService if endpoint resolved
if ($EffectiveEndpoint) {
    $ConfigDir = Join-Path $ProjectRoot 'V3 TESTING\js'
    if (-not (Test-Path $ConfigDir)) { New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null }
    $ConfigPath = Join-Path $ConfigDir 'config.js'
    $cfgContent = ""
    if (Test-Path $ConfigPath) {
        try { $cfgContent = Get-Content -Raw $ConfigPath } catch { $cfgContent = "" }
    }
    # Replace or append endpoint line
    $pattern = "window\.__MS_ENDPOINT__\s*=\s*'[^']*';"
    $replacement = "window.__MS_ENDPOINT__ = '$EffectiveEndpoint';"
    if ($cfgContent -and ($cfgContent -match $pattern)) {
        $newContent = [regex]::Replace($cfgContent, $pattern, $replacement)
    } else {
        if (-not $cfgContent) { $cfgContent = "" }
        if ($cfgContent -notmatch "window\.__MS_ENDPOINT__\s*=") {
            $newContent = $cfgContent + "`n$replacement`n"
        } else {
            $newContent = $cfgContent
        }
    }
    Set-Content -Path $ConfigPath -Value $newContent -Encoding UTF8
    Write-Host "[Fix.ps1] Updated config.js (__MS_ENDPOINT__)." -ForegroundColor Green
}

Write-Host "[Fix.ps1] Done. Please reload the app in your browser." -ForegroundColor Green
Write-Host "[Fix.ps1] Using SourceZip: $EffectiveSourceZipUrl" -ForegroundColor DarkGray
Write-Host "[Fix.ps1] If you provided an endpoint, the app picks it up via js/config.js." -ForegroundColor Green
