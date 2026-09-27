# Pingward

Pingward is a self-hosted uptime monitor and public status page. Run it on your own domain or subdomain, add monitors from the browser, and share a clear view of your services. It uses one SQLite database and does not require a hosted Pingward account or an external Pingward server.

## Features

- HTTP/HTTPS checks with an exact expected status code, and TCP port checks
- Public status page with 90-day uptime history, response times, and automatic refresh
- Groups with dedicated `/status/:slug` pages and iframe embeds at `/embed/:id`
- Optional custom domain for each group
- News, maintenance, incident, and resolved updates
- Light, dark, and system themes; grid and list layouts; uptime bars and Git-style graphs
- One administrator account per installation, created in the browser on first launch
- Alerts for state changes through your own SMTP server
- SQLite storage, Docker Compose deployment, and no external runtime services

## Quick start with Docker

```sh
git clone https://github.com/ChristianRelf/Pingward.git
cd Pingward
bash scripts/up.sh
```

The script starts at host port 3000. If that port is occupied, it tries 3001, then 3002, and so on, and prints the selected URL. Open that URL to see the status page, then visit `/admin` to create the administrator account. The selected port is saved in `.pingward-port` for the next launch. The database lives in the `pingward-data` Docker volume. Keep this volume when updating the container.

If the instance will be reachable from the internet before you finish setup, set a random `SETUP_TOKEN` in a `.env` file next to `compose.yaml` before starting the container. For example, use `openssl rand -hex 24` to generate one. The setup form will ask for it. Remove the variable after creating the admin account. Without a setup token, the first visitor to `/admin` can create the account.

For a domain or subdomain, point DNS to your server and put a reverse proxy in front of the host port printed by the script. Set `TRUST_PROXY=1` in a `.env` file next to `compose.yaml` when that proxy forwards HTTPS and is the only path to Pingward. Then set **Public URL** under **Appearance**. Pingward uses the request hostname for group custom domains, so point each group domain at the same proxy and forward the original `Host` header. The reverse proxy handles TLS certificates.

Example Nginx proxy configuration:

```nginx
server {
    listen 443 ssl;
    server_name status.example.com;
    # Configure your TLS certificate here.
    location / {
        proxy_pass http://127.0.0.1:3000; # Use the port printed by scripts/up.sh.
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Set `PINGWARD_BIND_ADDRESS=127.0.0.1` in `.env` when the proxy runs on the same host and should be the only public entry point. If it runs in another container, use a shared Docker network instead. `docker compose up` directly uses port 3000 unless you set `PINGWARD_HOST_PORT`; use `bash scripts/up.sh` for automatic fallback.

## Run from source

Node.js 24 or later is required for the built-in SQLite module.

```sh
npm ci
npm run dev
```

The Vite frontend starts at `http://localhost:5173` and proxies `/api` to the backend. If port 3000 is occupied, the development command starts the backend on the next available port and updates the proxy. It prints the actual frontend URL. For a single-process production run:

```sh
npm run build
npm start
```

Set `DATA_DIR` to choose where `pingward.sqlite` is stored; it defaults to `./data`. The app creates the directory automatically. `PORT` defaults to `3000`; `npm start` also tries subsequent ports if it is occupied. Set `STRICT_PORT=1` to fail instead of falling back. The Docker container uses strict port 3000 internally while `scripts/up.sh` selects the available host port.

## Using Pingward

1. Visit `/admin` and create the admin account with a password of at least 12 characters.
2. Add an HTTP URL (such as `https://example.com/health`) or a TCP host and port under **Monitors**. The minimum interval is 30 seconds.
3. Create groups under **Groups**, then edit monitors to assign them to one or more groups. Copy an iframe snippet from a group card to embed its status elsewhere.
4. Publish updates under **Updates**. Use **Appearance** for the page theme, layout, and history style.
5. Enter your SMTP server, sender, and recipient under **Notifications**. Save, then send a test email. Pingward sends alerts when a monitor goes down or recovers. A newly added healthy monitor does not send an alert.

The admin dashboard is on the same host as the public page. There is no outbound connection to Pingward infrastructure. HTTP checks contact only the URLs you configure, and SMTP alerts contact only the mail server you configure. The GitHub link in the public footer is a normal outbound link for visitors who choose to click it.

## Data and backups

The SQLite database holds settings, monitor history, sessions, and SMTP credentials. Protect access to the volume and back it up regularly. History older than 91 days is deleted automatically. To make a consistent backup of a running instance, use SQLite's backup command against the database file, or stop the container before copying the volume. Restoring the database file into the data volume restores the instance.

Only an administrator can add check targets. Treat the admin account as trusted: monitors intentionally make outbound HTTP or TCP connections from your server.

## Architecture

The backend is an Express API in `server/`; the checker is in `server/checker.js`, persistence in `server/db.js`, and session handling in `server/auth.js`. The frontend is a React app in `src/`. In production, Express serves the built frontend and API from one port. SQLite and the monitor scheduler run in the same process, so run **one Pingward container per database**.

Useful commands:

```sh
npm test
npm run build
npm audit
npm run format:check
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow. Pingward is MIT licensed.
