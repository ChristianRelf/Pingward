#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

# Git Bash and WSL do not always see the Docker Desktop Compose plugin even when
# it is available to PowerShell. Use the native Windows installer in that case.
windows_shell=0
windows_path=""
case "$(uname -s 2>/dev/null || true)" in
  MINGW*|MSYS*|CYGWIN*)
    windows_shell=1
    if command -v cygpath >/dev/null 2>&1; then
      windows_path="$(cygpath -w "$PWD/install.ps1")"
    fi
    ;;
  Linux*)
    if command -v wslpath >/dev/null 2>&1 &&
       [[ "$(uname -r 2>/dev/null || true)" == *[Mm]icrosoft* ]] &&
       { ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; }; then
      windows_shell=1
      windows_path="$(wslpath -w "$PWD/install.ps1")"
    fi
    ;;
esac
if (( windows_shell )); then
  [[ -n "$windows_path" ]] || { echo 'Could not convert the installer path for Windows. Run install.ps1 from PowerShell.' >&2; exit 1; }
  command -v powershell.exe >/dev/null 2>&1 || { echo 'PowerShell was not found. Run install.ps1 from Windows PowerShell.' >&2; exit 1; }
  ps_args=()
  while (( $# )); do
    case "$1" in
      --port|--bind|--timeout)
        (( $# >= 2 )) || { echo "Error: $1 needs a value." >&2; exit 1; }
        case "$1" in
          --port) ps_args+=(-Port "$2") ;;
          --bind) ps_args+=(-BindAddress "$2") ;;
          --timeout) ps_args+=(-TimeoutSeconds "$2") ;;
        esac
        shift 2
        ;;
      --no-build) ps_args+=(-NoBuild); shift ;;
      --yes) ps_args+=(-Yes); shift ;;
      -h|--help) ps_args+=(-Help); shift ;;
      *) echo "Error: Unknown option: $1. Run bash install.sh --help." >&2; exit 1 ;;
    esac
  done
  echo 'Windows detected; continuing with the PowerShell installer.'
  exec powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$windows_path" "${ps_args[@]}"
fi

usage() {
  cat <<'HELP'
Pingward installer

Usage: bash install.sh [options]

Options:
  --port PORT       Start looking for a host port here (default: 3000)
  --bind ADDRESS    Host IPv4 address to bind (default: 0.0.0.0)
  --no-build        Start the existing Docker image without rebuilding it
  --timeout SEC     Seconds to wait for the app to become ready (default: 90)
  -h, --help        Show this help

Run this command again to update Pingward. Existing settings and SQLite data are kept.
HELP
}

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

requested_port=""
requested_bind=""
build=1
timeout=90
while (( $# )); do
  case "$1" in
    --port|--bind|--timeout)
      (( $# >= 2 )) || die "$1 needs a value."
      case "$1" in
        --port) requested_port="$2" ;;
        --bind) requested_bind="$2" ;;
        --timeout) timeout="$2" ;;
      esac
      shift 2
      ;;
    --no-build) build=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown option: $1. Run bash install.sh --help." ;;
  esac
done

valid_port() {
  [[ "$1" =~ ^[0-9]{1,5}$ ]] || return 1
  (( 10#$1 >= 1 && 10#$1 <= 65535 ))
}

valid_bind() {
  [[ "$1" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || return 1
  local octet
  local -a octets
  IFS=. read -r -a octets <<< "$1"
  for octet in "${octets[@]}"; do
    (( 10#$octet <= 255 )) || return 1
  done
}

env_file="$PWD/.env"
read_setting() {
  local key="$1" line value=""
  [[ -f "$env_file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" =~ ^[[:space:]]*${key}[[:space:]]*=(.*)$ ]]; then
      value="${BASH_REMATCH[1]}"
    fi
  done < "$env_file"
  value="${value%$'\r'}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  if [[ "$value" == \"*\" || "$value" == \'*\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "$value"
}

set_setting() {
  local key="$1" value="$2" line replaced=0 temp
  temp="$(mktemp "${env_file}.tmp.XXXXXX")"
  chmod 600 "$temp"
  if [[ -f "$env_file" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      if [[ "$line" =~ ^[[:space:]]*${key}[[:space:]]*= ]]; then
        if (( ! replaced )); then
          printf '%s=%s\n' "$key" "$value" >> "$temp"
          replaced=1
        fi
      else
        printf '%s\n' "$line" >> "$temp"
      fi
    done < "$env_file"
  fi
  if (( ! replaced )); then printf '%s=%s\n' "$key" "$value" >> "$temp"; fi
  mv "$temp" "$env_file"
  chmod 600 "$env_file"
}

get_lan_addresses() {
  local interface address found=0
  local -a fallback_addresses
  if command -v ip >/dev/null 2>&1; then
    while IFS= read -r interface; do
      [[ -n "$interface" ]] || continue
      while IFS= read -r address; do
        if [[ -n "$address" ]]; then
          printf '%s\n' "$address"
          found=1
        fi
      done < <(ip -o -4 addr show dev "$interface" scope global 2>/dev/null | awk '{ sub(/\/.*/, "", $4); print $4 }')
    done < <(ip -o -4 route show default 2>/dev/null | awk '{ for (i = 1; i < NF; i++) if ($i == "dev") { print $(i + 1); break } }' | sort -u)
  elif command -v route >/dev/null 2>&1 && command -v ipconfig >/dev/null 2>&1; then
    interface="$(route -n get default 2>/dev/null | awk '/interface:/{ print $2; exit }')"
    if [[ -n "$interface" ]]; then
      address="$(ipconfig getifaddr "$interface" 2>/dev/null || true)"
      if [[ -n "$address" ]]; then
        printf '%s\n' "$address"
        found=1
      fi
    fi
  fi
  if (( ! found )) && command -v hostname >/dev/null 2>&1; then
    read -r -a fallback_addresses <<< "$(hostname -I 2>/dev/null || true)"
    for address in "${fallback_addresses[@]}"; do
      if valid_bind "$address" && [[ "$address" != 127.* && "$address" != 169.254.* && "$address" != 0.* ]]; then
        printf '%s\n' "$address"
      fi
    done
  fi
}

echo '[1/4] Checking Docker'
command -v docker >/dev/null 2>&1 || die 'Docker is missing. Linux: https://docs.docker.com/engine/install/ ; macOS: https://docs.docker.com/desktop/setup/install/mac-install/ . Install it, then rerun this command.'
docker compose version >/dev/null 2>&1 || die 'Docker Compose is missing. Linux: https://docs.docker.com/compose/install/linux/ ; macOS: update Docker Desktop. Then rerun this command.'
docker info >/dev/null 2>&1 || die 'Cannot reach Docker. Start Docker Desktop or the Docker Engine service, then rerun this command. On Linux, check Docker group access: https://docs.docker.com/engine/install/linux-postinstall/ .'

port="${requested_port:-${PINGWARD_HOST_PORT:-}}"
if [[ -z "$port" ]]; then port="$(read_setting PINGWARD_HOST_PORT)"; fi
if [[ -z "$port" && -f .pingward-port ]]; then port="$(<.pingward-port)"; fi
port="${port:-3000}"
valid_port "$port" || die 'Port must be an integer from 1 to 65535.'
port="$((10#$port))"

bind="${requested_bind:-${PINGWARD_BIND_ADDRESS:-}}"
if [[ -z "$bind" ]]; then bind="$(read_setting PINGWARD_BIND_ADDRESS)"; fi
bind="${bind:-0.0.0.0}"
valid_bind "$bind" || die 'Bind address must be a valid IPv4 address, such as 127.0.0.1.'

valid_port "$timeout" || die 'Timeout must be an integer from 1 to 65535 seconds.'
timeout="$((10#$timeout))"

echo '[2/4] Securing administrator setup'
generated_token=""
if [[ -n "${SETUP_TOKEN:-}" ]]; then
  if [[ "$SETUP_TOKEN" =~ ^[A-Za-z0-9._-]+$ ]]; then
    set_setting SETUP_TOKEN "$SETUP_TOKEN"
    echo 'Saved the supplied setup token in .env.'
  else
    echo 'Using SETUP_TOKEN from the environment; keep it set on future runs until setup is complete.'
  fi
elif [[ -n "$(read_setting SETUP_TOKEN)" ]]; then
  echo 'Keeping the existing setup token in .env.'
else
  if command -v openssl >/dev/null 2>&1; then
    generated_token="$(openssl rand -hex 24)"
  elif command -v od >/dev/null 2>&1 && command -v tr >/dev/null 2>&1; then
    generated_token="$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')"
  else
    die 'Cannot generate a setup token. Install OpenSSL or provide SETUP_TOKEN.'
  fi
  set_setting SETUP_TOKEN "$generated_token"
  echo 'Created a setup token in .env (file permissions: owner only).'
fi

compose() {
  PINGWARD_HOST_PORT="$port" PINGWARD_BIND_ADDRESS="$bind" docker compose "$@"
}

echo '[3/4] Starting Pingward'
if (( build )); then compose build; fi
while (( port <= 65535 )); do
  if output="$(compose up -d --no-build 2>&1)"; then
    printf '%s\n' "$output"
    break
  fi
  if [[ "$output" == *'port is already allocated'* ||
        "$output" == *'address already in use'* ||
        "$output" == *'failed to bind host port'* ||
        "$output" == *'Ports are not available'* ]]; then
    echo "Port $port is occupied; trying $((port + 1))."
    ((port += 1))
    continue
  fi
  printf '%s\n' "$output" >&2
  die 'Docker could not start Pingward. The existing data volume was left in place.'
done
(( port <= 65535 )) || die 'No available host port was found.'

echo '[4/4] Waiting for Pingward to be ready'
container_id="$(compose ps -q pingward)"
[[ -n "$container_id" ]] || die 'Docker did not create a Pingward container.'
ready=0
for (( attempt=0; attempt<timeout; attempt++ )); do
  if docker exec "$container_id" node -e "fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(2000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
    ready=1
    break
  fi
  if (( attempt > 0 && attempt % 5 == 0 )); then echo "Still waiting (${attempt}s)..."; fi
  sleep 1
done
if (( ! ready )); then
  compose logs --tail=40 pingward >&2 || true
  die 'Pingward did not become ready. Check the container logs above; existing data was kept.'
fi

set_setting PINGWARD_HOST_PORT "$port"
set_setting PINGWARD_BIND_ADDRESS "$bind"
printf '%s\n' "$port" > .pingward-port

display_host='localhost'
printf '\nPingward is ready.\n'
if [[ "$bind" == '0.0.0.0' ]]; then
  printf 'On this server: http://localhost:%s\n' "$port"
  lan_addresses=()
  while IFS= read -r address; do
    [[ -n "$address" ]] && lan_addresses+=("$address")
  done < <(get_lan_addresses)
  if (( ${#lan_addresses[@]} )); then
    display_host="${lan_addresses[0]}"
    for address in "${lan_addresses[@]}"; do
      printf 'On your network: http://%s:%s\n' "$address" "$port"
    done
  else
    printf 'To open Pingward from another device, find this server\047s IPv4 address and use http://<server-ip>:%s\n' "$port"
  fi
elif [[ "$bind" == '127.0.0.1' ]]; then
  printf 'On this server only: http://localhost:%s\n' "$port"
  echo 'To allow other devices, rerun with --bind 0.0.0.0.'
else
  display_host="$bind"
  printf 'On your network: http://%s:%s\n' "$bind" "$port"
fi

setup_state="$(docker exec "$container_id" node -e "fetch('http://127.0.0.1:3000/api/bootstrap').then(r=>r.json()).then(d=>console.log(d.needs_setup?'setup':'ready')).catch(()=>process.exit(1))" 2>/dev/null)" || setup_state='unknown'
if [[ "$setup_state" == 'setup' ]]; then
  printf 'Create the admin account at http://%s:%s/admin\n' "$display_host" "$port"
  if [[ -n "$generated_token" ]]; then
    printf 'Setup token: %s\n' "$generated_token"
  elif [[ -n "${SETUP_TOKEN:-}" ]]; then
    echo 'Use the SETUP_TOKEN from your environment on the setup form.'
  else
    echo 'Use the SETUP_TOKEN from .env on the setup form.'
  fi
elif [[ "$setup_state" == 'ready' ]]; then
  echo 'Your existing admin account and data are ready.'
  printf 'Admin dashboard: http://%s:%s/admin\n' "$display_host" "$port"
else
  printf 'Open http://%s:%s/admin to finish setup or sign in.\n' "$display_host" "$port"
  echo 'The setup token is stored in .env.'
fi
echo 'For a domain or subdomain, point your HTTPS reverse proxy to this host port.'
