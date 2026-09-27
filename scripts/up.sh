#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -n "${PINGWARD_HOST_PORT:-}" ]]; then
  port="$PINGWARD_HOST_PORT"
elif [[ -f .pingward-port ]]; then
  port="$(<.pingward-port)"
else
  port=3000
fi

if [[ ! "$port" =~ ^[0-9]+$ ]] || (( port < 1 || port > 65535 )); then
  echo "PINGWARD_HOST_PORT must be an integer from 1 to 65535." >&2
  exit 1
fi

docker compose build

while (( port <= 65535 )); do
  if output="$(PINGWARD_HOST_PORT="$port" docker compose up -d --no-build 2>&1)"; then
    printf '%s\n' "$output"
    printf '%s\n' "$port" > .pingward-port
    echo "Pingward is available at http://localhost:$port"
    exit 0
  fi

  if [[ "$output" == *"port is already allocated"* ||
        "$output" == *"address already in use"* ||
        "$output" == *"failed to bind host port"* ||
        "$output" == *"Ports are not available"* ]]; then
    echo "Port $port is in use; trying $((port + 1))."
    ((port += 1))
    continue
  fi

  printf '%s\n' "$output" >&2
  exit 1
done

echo "No available port found through 65535." >&2
exit 1
