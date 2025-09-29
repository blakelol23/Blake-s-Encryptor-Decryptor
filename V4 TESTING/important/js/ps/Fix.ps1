param(
    [string]$ProjectRoot = "C:\Users\$env:USERNAME\Downloads\V4 TESTING",
    [string]$SourceZipUrl = "https://github.com/blakelol23/Blake-s-Encryptor-Decryptor/archive/refs/heads/main.zip",
    [string]$GitHubBranch = "main",
    [string]$EndpointUrl = "https://script.google.com/macros/s/AKfycbzGQXAyxv-HowUX-Ulf0-ceZvMbVu8c-jvje982xbxtQOn44i0LqunzcTfT8aHbc-J4TQ/exec",
    [string]$VCEndpointUrl = "https://script.google.com/macros/s/AKfycbyNFNmKjtMrzh7wQMDF81jPE_6JuA9LEYRIYeoYCGETkOstm0OWZYSPptv4MmU6JoXN_Q/exec",
    [string]$SourceSubPath = 'V4 TESTING',
    [string]$TargetSubPath = '',
    # Include common web assets so icons/images (e.g., favicon.ico) are copied by default
    [string[]]$Extensions = @('js','html','css','ico','png','svg','jpg','jpeg','gif','webp','webmanifest'),
    # Filenames to preserve during deletion (case-insensitive match on leaf name)
    [string[]]$PreserveNames = @('favicon.ico'),
    [switch]$AllFiles,
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
Write-Host "[Fix.ps1] TargetRoot: $TargetRoot" -ForegroundColor Cyan

# Load config values if requested
$CfgSourceZip = ""; $CfgRepo = ""; $CfgBranch = ""; $CfgEndpoint = ""; $CfgVCEndpoint = ""
if ($UseConfig) {
    try {
        # Prefer important\js\config.js; fallback to js\config.js
        $cfgPath1 = Join-Path $ProjectRoot 'important\js\config.js'
        $cfgPath2 = Join-Path $ProjectRoot 'js\config.js'
        $cfgPath = if (Test-Path $cfgPath1) { $cfgPath1 } elseif (Test-Path $cfgPath2) { $cfgPath2 } else { $null }
        if ($cfgPath) {
            $cfg = Get-Content -Raw $cfgPath
            function Get-ConfigValue([string]$content, [string]$name) {
                $m = [regex]::Match($content, 'window\.__' + [regex]::Escape($name) + "__\s*=\s*'([^']*)';")
                if ($m.Success) { return $m.Groups[1].Value } else { return "" }
            }
            $CfgSourceZip = Get-ConfigValue $cfg 'MS_SOURCEZIP'
            $CfgRepo = Get-ConfigValue $cfg 'MS_GITHUB_REPO'
            $CfgBranch = Get-ConfigValue $cfg 'MS_GITHUB_BRANCH'
            $CfgEndpoint = Get-ConfigValue $cfg 'MS_ENDPOINT'
            $CfgVCEndpoint = Get-ConfigValue $cfg 'VC_ENDPOINT'
        }
    } catch { Write-Warning "[Fix.ps1] Could not read config.js: $($_.Exception.Message)" }
}

# Decide effective values (param > config)
if (-not [string]::IsNullOrWhiteSpace($CfgBranch)) { $CfgBranch = $CfgBranch } else { $CfgBranch = 'main' }
$EffectiveSourceZipUrl = if ($SourceZipUrl) { $SourceZipUrl } elseif ($GitHubRepo) { "https://github.com/$GitHubRepo/archive/refs/heads/$GitHubBranch.zip" } elseif ($CfgSourceZip) { $CfgSourceZip } elseif ($CfgRepo) { "https://github.com/$CfgRepo/archive/refs/heads/$CfgBranch.zip" } else { "" }
$EffectiveEndpoint = if ($EndpointUrl) { $EndpointUrl } elseif ($CfgEndpoint) { $CfgEndpoint } else { "" }
$EffectiveVCEndpoint = if ($VCEndpointUrl) { $VCEndpointUrl } elseif ($CfgVCEndpoint) { $CfgVCEndpoint } else { "" }

if (-not $EffectiveSourceZipUrl) {
    Write-Error "[Fix.ps1] No SourceZipUrl provided. Pass -SourceZipUrl, or -GitHubRepo, or use -UseConfig with config.js values (__MS_SOURCEZIP__ or __MS_GITHUB_REPO__)."
    exit 1
}

Write-Host "[Fix.ps1] SourceZipUrl: $EffectiveSourceZipUrl" -ForegroundColor Cyan
if ($EffectiveEndpoint) { Write-Host "[Fix.ps1] EndpointUrl: $EffectiveEndpoint" -ForegroundColor Cyan }
if ($EffectiveVCEndpoint) { Write-Host "[Fix.ps1] VCEndpointUrl: $EffectiveVCEndpoint" -ForegroundColor Cyan }

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

# Determine the correct source root inside the archive
$SourceRoot = $ContentRoot
if ($SourceSubPath) {
    $candidate = Join-Path $ContentRoot $SourceSubPath
    if (Test-Path $candidate) { $SourceRoot = $candidate }
}

# Determine the target root (where files will be installed)
$TargetRoot = if ($TargetSubPath) { Join-Path $ProjectRoot $TargetSubPath } else { $ProjectRoot }

# Build source file list to install
$extSet = @{}
foreach ($e in $Extensions) { $extSet[('.' + ($e.TrimStart('.')).ToLower())] = $true }
$sourceFiles = if ($AllFiles) {
    Get-ChildItem -Path $SourceRoot -Recurse -File
} else {
    Get-ChildItem -Path $SourceRoot -Recurse -File | Where-Object { $extSet.ContainsKey($_.Extension.ToLower()) }
}

# Build target file list to delete
$targetFiles = if ($AllFiles) {
    Get-ChildItem -Path $TargetRoot -Recurse -File
} else {
    $pattern = $Extensions | ForEach-Object { '*.' + ($_ -replace '^\.', '') }
    Get-ChildItem -Path $TargetRoot -Recurse -File -Include $pattern
}

# Abort if no source files were found (safety)
if (-not $sourceFiles -or $sourceFiles.Count -eq 0) {
    Write-Error "[Fix.ps1] No source files found to install from: $SourceRoot. Check -SourceSubPath (currently '$SourceSubPath') or use -AllFiles."
    Write-Host "Hint: If your zip already contains the app at the root, run with: -SourceSubPath ''" -ForegroundColor Yellow
    exit 1
}

# Show summary and ask for consent
Write-Host "[Fix.ps1] Ready to update project files" -ForegroundColor Yellow
Write-Host "  ProjectRoot : $ProjectRoot" -ForegroundColor DarkGray
Write-Host "  TargetRoot  : $TargetRoot" -ForegroundColor DarkGray
Write-Host "  SourceRoot  : $SourceRoot" -ForegroundColor DarkGray
Write-Host "  Mode        : " -NoNewline
if ($AllFiles) { Write-Host "ALL files" -ForegroundColor Cyan } else { Write-Host ("Extensions = " + ($Extensions -join ', ')) -ForegroundColor Cyan }
Write-Host ("  Will DELETE  : {0} files" -f $targetFiles.Count) -ForegroundColor Red
Write-Host ("  Will INSTALL : {0} files" -f $sourceFiles.Count) -ForegroundColor Green
$consent = Read-Host "Type YES to proceed (anything else to abort)"
if ($consent -ne 'YES') { Write-Host '[Fix.ps1] Aborted by user.' -ForegroundColor Yellow; exit 0 }

# Delete target files
Write-Host "[Fix.ps1] Deleting target files..." -ForegroundColor Red
if ($PreserveNames -and $PreserveNames.Count -gt 0) {
    # Use a simple hashtable of lowercase names for compatibility with Constrained Language Mode
    $preserveSet = @{}
    foreach ($n in $PreserveNames) {
        if ($n) {
            $k = ($n.Trim()).ToLower()
            if ($k) { $preserveSet[$k] = $true }
        }
    }
} else {
    $preserveSet = $null
}

foreach ($t in $targetFiles) {
    try {
        if ($preserveSet -and $preserveSet.ContainsKey($t.Name.ToLower())) {
            Write-Host ("Preserving: {0}" -f $t.FullName) -ForegroundColor DarkYellow
            continue
        }
        Remove-Item -LiteralPath $t.FullName -Force
    } catch {
        Write-Warning "Failed to delete: $($t.FullName) - $($_.Exception.Message)"
    }
}

# Install new files (preserve structure)
Write-Host "[Fix.ps1] Installing new files..." -ForegroundColor Green
try {
    foreach ($f in $sourceFiles) {
        $relPath = $f.FullName.Substring($SourceRoot.Length)
        $rel = ($relPath -replace '^[\\/]+','')
        # If the relative path starts with the SourceSubPath and TargetRoot already points inside it, strip the prefix to avoid nesting
        if ($SourceSubPath -and ($rel -like "$SourceSubPath\*" -or $rel -like "$SourceSubPath/*")) {
            $rel = $rel.Substring($SourceSubPath.Length).TrimStart('\\','/')
        }
        $dest = Join-Path $TargetRoot $rel
        $destDir = Split-Path -Parent $dest
        if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
        Copy-Item -Path $f.FullName -Destination $dest -Force
    }
} catch {
    Write-Error "[Fix.ps1] Install failed: $($_.Exception.Message)"; exit 1
}

# Write/update config.js for endpoints if resolved
$ConfigDir = Join-Path $ProjectRoot 'important\js'
if (Test-Path $ConfigDir) {
    $ConfigPath = Join-Path $ConfigDir 'config.js'
    $cfgContent = ""
    if (Test-Path $ConfigPath) {
        try { $cfgContent = Get-Content -Raw $ConfigPath } catch { $cfgContent = "" }
    }

    function Set-LineContent([string]$content, [string]$pattern, [string]$replacement) {
          if (-not $replacement) { return $content }
        if ($content -and ($content -match $pattern)) {
            return [regex]::Replace($content, $pattern, $replacement)
        } else {
            if (-not $content) { $content = "" }
            if ($content -notmatch $pattern) { return $content + "`n" + $replacement + "`n" } else { return $content }
        }
    }

    $newContent = $cfgContent
    if ($EffectiveEndpoint) { $newContent = Set-LineContent $newContent "window\.__MS_ENDPOINT__\s*=\s*'[^']*';" "window.__MS_ENDPOINT__ = '$EffectiveEndpoint';" }
    if ($EffectiveVCEndpoint) { $newContent = Set-LineContent $newContent "window\.__VC_ENDPOINT__\s*=\s*'[^']*';" "window.__VC_ENDPOINT__ = '$EffectiveVCEndpoint';" }

    if ($newContent -ne $cfgContent) {
        Set-Content -Path $ConfigPath -Value $newContent -Encoding UTF8
        Write-Host "[Fix.ps1] Updated config.js (__MS_ENDPOINT__/__VC_ENDPOINT__)." -ForegroundColor Green
    } else {
        Write-Host "[Fix.ps1] config.js endpoints already up-to-date." -ForegroundColor DarkGreen
    }
} else {
    Write-Warning "[Fix.ps1] Skipping config.js update: directory not found -> $ConfigDir"
}

Write-Host "[Fix.ps1] Done. Please reload the app in your browser." -ForegroundColor Green
Write-Host "[Fix.ps1] Using SourceZip: $EffectiveSourceZipUrl" -ForegroundColor DarkGray
Write-Host "[Fix.ps1] If you provided an endpoint, the app picks it up via js/config.js." -ForegroundColor Green
