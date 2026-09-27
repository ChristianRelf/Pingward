# Contributing to Pingward

Thanks for helping make self-hosted status pages easier to use.

## Development

1. Use Node.js 24 or later and run `npm ci`.
2. Run `npm run dev` and open `http://localhost:5173`.
3. Make a focused change. Keep management inside the web app and avoid required external services.
4. Run `npm test`, `npm run build`, `npm audit`, and `npm run format:check` before opening a pull request.

The API is in `server/index.js`; monitoring logic is in `server/checker.js`; SQLite schema and read helpers are in `server/db.js`. The frontend entry point is `src/main.jsx`, with separate public, admin, auth, and form components in `src/`. Styles are in `src/style.css`. A local `data/` directory is ignored by Git. Set `DATA_DIR` to a temporary directory when testing manually with disposable data.

For new check types, add input validation and a check implementation in `server/checker.js`, expose the fields in the monitor editor, and cover the API behavior with a test. For new public page options, add a default in `server/db.js`, validate it in the settings endpoint, and expose it in Appearance.

Please keep pull requests small, describe how you verified the change, and include screenshots for visual changes. Avoid committing credentials, database files, or generated `dist/` assets.
