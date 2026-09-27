# Pingward

Pingward is a self-hosted uptime monitor and public status page. Run it on your own domain or subdomain, add monitors from the browser, and share a clear view of your services. It uses one SQLite database and does not require a hosted Pingward account or an external Pingward server.

## Features

- HTTP/HTTPS checks with an exact expected status code, and TCP port checks
- Public status page with 90-day uptime history, day and incident tooltips, response times, and automatic refresh
- Groups that expand on the main page or link to dedicated `/status/:slug` pages, plus iframe embeds at `/embed/:id`
- Per-monitor preset icons or uploaded PNG, JPEG, and WebP logos stored in SQLite
- Optional custom domain for each group
- News, maintenance, incident, and resolved updates
- Light, dark, and system themes; grid and list layouts; uptime bars and Git-style graphs
- One administrator account per installation, created in the browser on first launch
- Alerts for state changes through your own SMTP server
- SQLite storage, Docker Compose deployment, and no external runtime services

## Quick start on Windows

Open **PowerShell** in the Pingward folder and run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
```

The installer checks for Docker Desktop and Docker Compose. If Docker Desktop is missing and [WinGet](https://learn.microsoft.com/windows/package-manager/winget/) is available, it asks before installing Docker Desktop. Otherwise it opens the [official Docker Desktop setup guide](https://docs.docker.com/desktop/setup/install/windows-install/) and tells you what to do. Complete any Docker Desktop first-run or Windows restart prompts, then run the same command again. If Docker asks for WSL 2, [install it from an administrator PowerShell](https://learn.microsoft.com/windows/wsl/install) with `wsl --install` and restart Windows if requested. Docker Desktop includes Compose; a separate Compose plugin is not needed on Windows.

The installer starts Docker Desktop when possible, checks that Linux containers are enabled, builds Pingward, and chooses port 3000 or the next available port. It prints the app URL and the administrator setup token. You can run it again after updates without losing your data. Run `powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Help` for options, including `-Port 4000`, `-BindAddress 127.0.0.1`, and `-NoBuild`.

If you already use `bash install.sh` from Git Bash, it hands off to the Windows PowerShell installer automatically. WSL does the same when Docker Compose is unavailable in WSL.

## Quick start on Linux or macOS

```sh
git clone https://github.com/ChristianRelf/Pingward.git
cd Pingward
bash install.sh
```

On Linux, install [Docker Engine](https://docs.docker.com/engine/install/) and the [Compose plugin](https://docs.docker.com/compose/install/linux/) first. On macOS, install [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/), which includes Compose. Start Docker before running the script.

The installer checks Docker and Compose, builds the app, selects port 3000 or the next available port, and waits until Pingward responds. It prints the exact status and admin URLs. It generates a first-run setup token in `.env` and displays it after startup; enter it when creating your administrator account. The file is restricted to your user on Linux and macOS. The installer saves the chosen host port and bind address in `.env`, so a later `docker compose up` uses the same port.

Run `bash install.sh` again after pulling updates. It keeps the existing setup token, settings, database, and port. SQLite data lives in the `pingward-data` Docker volume. For a quick restart without a rebuild, use `bash install.sh --no-build`. Other options are shown with `bash install.sh --help`.

You can set a starting port or bind address explicitly:

```sh
bash install.sh --port 4000 --bind 127.0.0.1
```

The installer tries subsequent ports if the requested one is occupied. It preserves other values already present in `.env`. If you supply `SETUP_TOKEN` yourself in `.env` or the environment, the installer uses it; remove that token after the admin account exists if you no longer need it.

For a domain or subdomain, point DNS to your server and put a reverse proxy in front of the host port printed by the script. Set `TRUST_PROXY=1` in a `.env` file next to `compose.yaml` when that proxy forwards HTTPS and is the only path to Pingward. Then set **Public URL** under **Appearance**. Pingward uses the request hostname for group custom domains, so point each group domain at the same proxy and forward the original `Host` header. The reverse proxy handles TLS certificates.

Example Nginx proxy configuration:

```nginx
server {
    listen 443 ssl;
    server_name status.example.com;
    # Configure your TLS certificate here.
    location / {
        proxy_pass http://127.0.0.1:3000; # Use the port printed by install.sh.
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Use `--bind 127.0.0.1` when the proxy runs on the same host and should be the only public entry point. If it runs in another container, use a shared Docker network instead.

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

Set `DATA_DIR` to choose where `pingward.sqlite` is stored; it defaults to `./data`. The app creates the directory automatically. `PORT` defaults to `3000`; `npm start` also tries subsequent ports if it is occupied. Set `STRICT_PORT=1` to fail instead of falling back. The Docker container uses strict port 3000 internally while `install.sh` selects the available host port.

## Using Pingward

1. Visit `/admin` and create the admin account with a password of at least 12 characters.
2. Add an HTTP URL (such as `https://example.com/health`) or a TCP host and port under **Monitors**. Choose a preset logo or upload a PNG, JPEG, or WebP image up to 512 KB. The minimum interval is 30 seconds.
3. Create groups under **Groups** and choose **On main status page** for an expandable section or **Separate page** for a dedicated link. Edit monitors to assign them to one or more groups. Copy an iframe snippet from a group card to embed its status elsewhere.
4. Publish updates under **Updates**. Use **Appearance** for the page theme, layout, and history style.
5. Enter your SMTP server, sender, and recipient under **Notifications**. Save, then send a test email. Pingward sends alerts when a monitor goes down or recovers. A newly added healthy monitor does not send an alert.

The admin dashboard is on the same host as the public page. There is no outbound connection to Pingward infrastructure. HTTP checks contact only the URLs you configure, and SMTP alerts contact only the mail server you configure. The GitHub link in the public footer is a normal outbound link for visitors who choose to click it.

## Data and backups

The SQLite database holds settings, monitor history, uploaded logos, sessions, and SMTP credentials. Protect access to the volume and back it up regularly. History older than 91 days is deleted automatically. To make a consistent backup of a running instance, use SQLite's backup command against the database file, or stop the container before copying the volume. Restoring the database file into the data volume restores the instance.

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
