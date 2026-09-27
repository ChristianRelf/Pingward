[CmdletBinding()]
param(
  [int]$Port = 0,
  [string]$BindAddress = '',
  [switch]$NoBuild,
  [ValidateRange(1, 600)][int]$TimeoutSeconds = 90,
  [switch]$Yes,
  [switch]$Help
)

$ErrorActionPreference = 'Stop'
$DockerGuide = 'https://docs.docker.com/desktop/setup/install/windows-install/'
$WslGuide = 'https://learn.microsoft.com/windows/wsl/install'
Set-Location -LiteralPath $PSScriptRoot
$EnvPath = Join-Path $PSScriptRoot '.env'
$PortPath = Join-Path $PSScriptRoot '.pingward-port'
$Utf8 = New-Object System.Text.UTF8Encoding -ArgumentList $false

function Show-Help {
  Write-Host @'
Pingward installer for Windows PowerShell

Usage: powershell -ExecutionPolicy Bypass -File .\install.ps1 [options]

Options:
  -Port 4000             Start looking for a host port here (default: 3000)
  -BindAddress 127.0.0.1 Bind only this IPv4 address (default: 0.0.0.0)
  -NoBuild               Start the existing image without rebuilding
  -TimeoutSeconds 120    Wait this long for Pingward to respond (default: 90)
  -Yes                   Accept the Docker Desktop installation prompt
  -Help                  Show this help

Run again after pulling updates. Your settings and SQLite data are kept.
'@
}

function Fail([string]$Message) { throw $Message }

function Get-Setting([string]$Name) {
  if (-not (Test-Path -LiteralPath $EnvPath)) { return '' }
  $value = ''
  $pattern = '^\s*' + [regex]::Escape($Name) + '\s*=(.*)$'
  foreach ($line in [System.IO.File]::ReadAllLines($EnvPath)) {
    if ($line -match $pattern) { $value = $Matches[1].Trim() }
  }
  if ($value.Length -ge 2) {
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
  }
  return $value
}

function Set-Setting([string]$Name, [string]$Value) {
  $lines = New-Object 'System.Collections.Generic.List[string]'
  $pattern = '^\s*' + [regex]::Escape($Name) + '\s*='
  $replaced = $false
  if (Test-Path -LiteralPath $EnvPath) {
    foreach ($line in [System.IO.File]::ReadAllLines($EnvPath)) {
      if ($line -match $pattern) {
        if (-not $replaced) {
          [void]$lines.Add("$Name=$Value")
          $replaced = $true
        }
      } else {
        [void]$lines.Add($line)
      }
    }
  }
  if (-not $replaced) { [void]$lines.Add("$Name=$Value") }
  [System.IO.File]::WriteAllLines($EnvPath, $lines.ToArray(), $Utf8)
}

function Get-DockerCandidates {
  $candidates = New-Object 'System.Collections.Generic.List[string]'
  foreach ($name in @('docker.exe', 'docker')) {
    $command = Get-Command $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { [void]$candidates.Add($command.Source) }
  }
  if ($env:LOCALAPPDATA) {
    [void]$candidates.Add((Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'))
  }
  if ($env:ProgramFiles) {
    [void]$candidates.Add((Join-Path $env:ProgramFiles 'Docker\Docker\resources\bin\docker.exe'))
  }
  return $candidates | Select-Object -Unique
}

function Find-DockerWithCompose {
  foreach ($candidate in Get-DockerCandidates) {
    if (-not (Test-Path -LiteralPath $candidate)) { continue }
    try {
      $oldPreference = $ErrorActionPreference
      $ErrorActionPreference = 'Continue'
      $null = & $candidate compose version 2>&1
      $code = $LASTEXITCODE
      $ErrorActionPreference = $oldPreference
      if ($code -eq 0) { return $candidate }
    } catch {
      $ErrorActionPreference = $oldPreference
    }
  }
  return $null
}

function Get-DesktopApp {
  $paths = @()
  if ($env:LOCALAPPDATA) {
    $paths += Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe'
  }
  if ($env:ProgramFiles) {
    $paths += Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
  }
  foreach ($path in $paths) {
    if (Test-Path -LiteralPath $path) { return $path }
  }
  return $null
}

function Ask([string]$Question) {
  if ($Yes) { return $true }
  try { $answer = Read-Host "$Question [y/N]" } catch { return $false }
  return ($answer -match '^[Yy]')
}

function Show-DockerInstructions {
  Write-Host 'Install Docker Desktop for Windows, choose the WSL 2 backend, start Docker Desktop, then rerun this installer.'
  Write-Host "Official instructions: $DockerGuide"
  try { Start-Process $DockerGuide | Out-Null } catch { }
}

function Capture-Docker([string[]]$Arguments) {
  $oldPreference = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = & $script:DockerExe @Arguments 2>&1 | Out-String
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $oldPreference
  }
  return @{ Code = $code; Output = [string]$output }
}

function Wait-Docker([int]$Seconds) {
  for ($attempt = 0; $attempt -lt $Seconds; $attempt += 3) {
    $status = Capture-Docker -Arguments @('info', '--format', '{{.OSType}}')
    if ($status.Code -eq 0) { return $status.Output.Trim() }
    Start-Sleep -Seconds 3
  }
  return ''
}

if ($Help) { Show-Help; exit 0 }

try {
  Write-Host '[1/4] Checking Docker Desktop and Compose'
  $DockerExe = Find-DockerWithCompose
  if (-not $DockerExe) {
    Write-Host 'Docker Desktop with Compose was not found in Windows PowerShell.'
    $winget = Get-Command winget.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $winget) {
      Show-DockerInstructions
      Fail 'WinGet is unavailable, so Docker Desktop needs to be installed manually.'
    }
    if (-not (Ask 'Install or update Docker Desktop with WinGet now?')) {
      Show-DockerInstructions
      Fail 'Docker Desktop is required to run Pingward with Docker.'
    }
    $desktopApp = Get-DesktopApp
    $wingetAction = if ($desktopApp) { 'upgrade' } else { 'install' }
    Write-Host "Running: winget $wingetAction --id Docker.DockerDesktop --exact --source winget"
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
      & $winget.Source $wingetAction --id Docker.DockerDesktop --exact --source winget
      $wingetExitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $oldPreference }
    if ($wingetExitCode -ne 0) {
      Show-DockerInstructions
      Fail 'WinGet could not finish Docker Desktop installation. Complete the official installer, then rerun Pingward setup.'
    }
    $DockerExe = Find-DockerWithCompose
    if (-not $DockerExe) {
      Show-DockerInstructions
      Fail 'Docker Desktop was installed, but Compose is not available yet. Restart PowerShell after completing Docker Desktop setup, then rerun this installer.'
    }
  }

  $engine = Capture-Docker -Arguments @('info', '--format', '{{.OSType}}')
  if ($engine.Code -ne 0) {
    Write-Host 'Starting Docker Desktop. Complete its first-run prompts if they appear.'
    $start = Capture-Docker -Arguments @('desktop', 'start')
    if ($start.Code -ne 0) {
      $desktopApp = Get-DesktopApp
      if ($desktopApp) { Start-Process -FilePath $desktopApp | Out-Null }
    }
    $engineType = Wait-Docker 120
    if (-not $engineType) {
      Write-Host 'Docker Desktop did not become ready. Open it and complete any first-run or restart prompts.'
      Write-Host 'If Docker asks for WSL 2, open PowerShell as Administrator, run: wsl --install'
      Write-Host 'Restart Windows if requested, then start Docker Desktop and rerun this installer.'
      Write-Host "WSL 2 setup: $WslGuide"
      Fail 'Start Docker Desktop, then rerun this installer.'
    }
  } else {
    $engineType = $engine.Output.Trim()
  }
  if ($engineType -ne 'linux') {
    Write-Host 'Pingward needs Docker Desktop in Linux containers mode.'
    if (-not (Ask 'Switch Docker Desktop to Linux containers now?')) {
      Fail 'Use the Docker Desktop menu to switch to Linux containers, then rerun this installer.'
    }
    $switch = Capture-Docker -Arguments @('desktop', 'engine', 'use', 'linux')
    if ($switch.Code -ne 0 -or (Wait-Docker 120) -ne 'linux') {
      Fail 'Could not switch Docker Desktop to Linux containers. Use the Docker Desktop menu, then rerun this installer.'
    }
  }

  $chosenPort = 0
  if ($PSBoundParameters.ContainsKey('Port')) { $chosenPort = $Port }
  elseif ($env:PINGWARD_HOST_PORT) { $chosenPort = [int]$env:PINGWARD_HOST_PORT }
  elseif (Get-Setting 'PINGWARD_HOST_PORT') { $chosenPort = [int](Get-Setting 'PINGWARD_HOST_PORT') }
  elseif (Test-Path -LiteralPath $PortPath) { $chosenPort = [int]([System.IO.File]::ReadAllText($PortPath).Trim()) }
  else { $chosenPort = 3000 }
  if ($chosenPort -lt 1 -or $chosenPort -gt 65535) { Fail 'Port must be between 1 and 65535.' }

  $bind = $BindAddress
  if (-not $bind) { $bind = $env:PINGWARD_BIND_ADDRESS }
  if (-not $bind) { $bind = Get-Setting 'PINGWARD_BIND_ADDRESS' }
  if (-not $bind) { $bind = '0.0.0.0' }
  $parsedAddress = $null
  if ($bind -notmatch '^\d{1,3}(\.\d{1,3}){3}$' -or
      -not [System.Net.IPAddress]::TryParse($bind, [ref]$parsedAddress) -or
      $parsedAddress.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
    Fail 'BindAddress must be an IPv4 address, such as 127.0.0.1.'
  }

  Write-Host '[2/4] Securing administrator setup'
  $generatedToken = ''
  if ($env:SETUP_TOKEN) {
    if ($env:SETUP_TOKEN -match '^[A-Za-z0-9._-]+$') {
      Set-Setting 'SETUP_TOKEN' $env:SETUP_TOKEN
      Write-Host 'Saved the supplied setup token in .env.'
    } else {
      Write-Host 'Using SETUP_TOKEN from the environment. Keep it set until setup is complete.'
    }
  } elseif (Get-Setting 'SETUP_TOKEN') {
    Write-Host 'Keeping the existing setup token in .env.'
  } else {
    $bytes = New-Object byte[] 24
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $generatedToken = [System.BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
    Set-Setting 'SETUP_TOKEN' $generatedToken
    Write-Host 'Created a setup token in .env.'
  }

  Write-Host '[3/4] Building and starting Pingward'
  if (-not $NoBuild) {
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
      & $DockerExe compose build
      $buildExitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $oldPreference }
    if ($buildExitCode -ne 0) { Fail 'Docker could not build Pingward. See the build output above.' }
  }
  $started = $false
  while ($chosenPort -le 65535) {
    $env:PINGWARD_HOST_PORT = [string]$chosenPort
    $env:PINGWARD_BIND_ADDRESS = $bind
    $up = Capture-Docker -Arguments @('compose', 'up', '-d', '--no-build')
    if ($up.Code -eq 0) {
      Write-Host $up.Output.Trim()
      $started = $true
      break
    }
    if ($up.Output -match '(?i)port is already allocated|address already in use|failed to bind host port|ports are not available') {
      Write-Host "Port $chosenPort is occupied; trying $($chosenPort + 1)."
      $chosenPort++
      continue
    }
    Write-Host $up.Output
    Fail 'Docker could not start Pingward. The existing data volume was left in place.'
  }
  if (-not $started) { Fail 'No available host port was found.' }

  Write-Host '[4/4] Waiting for Pingward to be ready'
  $container = Capture-Docker -Arguments @('compose', 'ps', '-q', 'pingward')
  $containerId = $container.Output.Trim()
  if ($container.Code -ne 0 -or -not $containerId) { Fail 'Docker did not create a Pingward container.' }
  $healthScript = "fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(2000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
  $ready = $false
  for ($attempt = 0; $attempt -lt $TimeoutSeconds; $attempt++) {
    $health = Capture-Docker -Arguments @('exec', $containerId, 'node', '-e', $healthScript)
    if ($health.Code -eq 0) { $ready = $true; break }
    if ($attempt -gt 0 -and $attempt % 5 -eq 0) { Write-Host "Still waiting ($attempt`s)..." }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) {
    $logs = Capture-Docker -Arguments @('compose', 'logs', '--tail=40', 'pingward')
    Write-Host $logs.Output
    Fail 'Pingward did not become ready. Existing data was kept.'
  }

  Set-Setting 'PINGWARD_HOST_PORT' ([string]$chosenPort)
  Set-Setting 'PINGWARD_BIND_ADDRESS' $bind
  [System.IO.File]::WriteAllText($PortPath, "$chosenPort`n", $Utf8)
  $displayHost = if ($bind -eq '0.0.0.0' -or $bind -eq '127.0.0.1') { 'localhost' } else { $bind }
  Write-Host "`nPingward is ready at http://${displayHost}:$chosenPort"

  $bootstrapScript = "fetch('http://127.0.0.1:3000/api/bootstrap').then(r=>r.json()).then(d=>console.log(d.needs_setup?'setup':'ready')).catch(()=>process.exit(1))"
  $bootstrap = Capture-Docker -Arguments @('exec', $containerId, 'node', '-e', $bootstrapScript)
  if ($bootstrap.Code -eq 0 -and $bootstrap.Output.Trim() -eq 'setup') {
    Write-Host "Create the admin account at http://${displayHost}:$chosenPort/admin"
    if ($generatedToken) { Write-Host "Setup token: $generatedToken" }
    elseif ($env:SETUP_TOKEN) { Write-Host 'Use SETUP_TOKEN from your environment on the setup form.' }
    else { Write-Host 'Use SETUP_TOKEN from .env on the setup form.' }
  } elseif ($bootstrap.Code -eq 0 -and $bootstrap.Output.Trim() -eq 'ready') {
    Write-Host 'Your existing admin account and data are ready.'
  } else {
    Write-Host "Open http://${displayHost}:$chosenPort/admin to finish setup or sign in."
    Write-Host 'The setup token is stored in .env.'
  }
  Write-Host 'For a domain or subdomain, point your HTTPS reverse proxy to this host port.'
} catch {
  Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
