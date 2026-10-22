# WebDoc

**WebDoc** is an open-source, self-contained demo platform for scholarly
publishing: a public documentation site, a hidden CMS, and a Rust API packaged
into one portable binary.

It is built for teams that want to evaluate a complete journal/partner
publishing workflow without operating a separate front-end server, CMS host,
reverse proxy, or asset pipeline. The public UI, admin UI, API and uploaded
assets can all be served by a single `webdoc` process.

> The repository ships with fictional journals, partners, logos and demo
> content. Replace the sample data, credentials and secrets before production
> use.

## Features

- **Public site** — homepage, documentation tree, article topics, search,
  contact form, cookie preferences, language selector.
- **Hidden CMS** — content tree, homepage HTML, site identity,
  appearance/theme, languages, backup and restore.
- **Database-backed i18n** — locales, dictionaries and the public-UI language
  subset/default are stored in MongoDB and edited in the CMS; no rebuild needed.
- **Homepage** — stored as HTML in MongoDB, cannot be deleted and can be reset to the bundled default. The CMS has a single homepage editor; custom public pages are not supported.
- **Appearance controls** — colors, fonts, background image, header, footer,
  navigation, CTA and system/light/dark theme modes. The CMS can
  choose which theme modes the public UI offers and its default; a single
  mode hides the public theme switch. The CMS has its own dark-mode switch.
- **Partners API** — read-only `/api/partners` (alias `/api/journals`) retained
  for compatibility; partner records are not managed in the CMS.
- **Single binary** — UI and CMS are embedded with `rust-embed`; optional
  `UI_DIST` / `ADMIN_DIST` overrides for frontend development.
- **Portable data** — uploads resolve next to the package or under
  `WEBDOC_DATA_DIR`; ZIP backup includes MongoDB collections and uploads.
- **HTTP caching** — strong ETags/304 for API JSON, static assets and uploads.
- **Autostart CLI** — generates systemd units or crontab blocks from the
  current runtime configuration.
- **amd64 + arm64 releases** — glibc and fully static musl builds from one command.

## Stack

| Layer | Technology |
| --- | --- |
| Public UI | React 18, React Router, Vite, VitePress-derived CSS |
| CMS | React 18, React Router, Vite |
| API | Rust, axum, MongoDB driver |
| Database | MongoDB |
| Packaging | `rust-embed`, `cargo-zigbuild`, tar.gz |
| Auth | JWT + Argon2 |

## Repository layout

```
webdoc/
├── webdoc-ui/          # public website
├── webdoc-admin/       # hidden CMS at /admin
├── webdoc-api/         # Rust API + embedded UI/CMS
│   ├── src/
│   └── seed_data/      # docs, layout, i18n, appearance, journals, site
├── scripts/
│   ├── build.sh        # UI/CMS + Rust + amd64/arm64 packages
│   ├── release.sh      # GitHub release upload
│   └── webdoc.service.example
├── LICENSE
└── README.md
```

## Quick start (development)

Requirements: Rust toolchain, Node.js 18+, npm, MongoDB.

```bash
# 1. Start MongoDB (example: local service)
#    mongodb://127.0.0.1:27017

# 2. API — creates admin + translations; add --seed for demo content
cd webdoc-api
cp .env.example .env
cargo run

# 3. Public UI (new terminal)
cd webdoc-ui
npm install
npm run dev            # http://localhost:5173

# 4. CMS (new terminal)
cd webdoc-admin
npm install
npm run dev            # http://localhost:5174/admin/
```

The API listens on `http://127.0.0.1:18620`. Both Vite dev servers proxy
`/api` to it.

Default demo login: **admin / admin123**. Change `JWT_SECRET`,
`ADMIN_PASSWORD` and `ADMIN_USERNAME` in `.env` before exposing the service.

Useful URLs:

| URL | Description |
| --- | --- |
| `/` | Public site |
| `/admin/` | CMS |
| `/api/health` | Health check |
| `/api/docs/tree` | Documentation tree |
| `/api/settings/appearance` | Public appearance config |
| `/api/i18n` | Enabled locales + public-UI default |

## Empty install by default

A new database contains **no demo articles, partners or custom pages**. On startup
WebDoc bootstraps only:

- the admin account (`--admin-username` / `--admin-password`)
- interface translations (English + Vietnamese)
- default settings served by code until saved in the CMS

Add `--seed` to load the demo documents, partners and homepage content for
evaluation:

```bash
webdoc --seed --host 127.0.0.1 --port 18620 \
       --mongodb-url "mongodb://127.0.0.1:27017" --mongodb-db webdoc
```

Without `--seed`, documentation URLs return 404 until content is created in
the CMS; the homepage shows the default layout with an empty partner list.

## Configuration

Copy `webdoc-api/.env.example` to `webdoc-api/.env` and adjust:

| Variable | Default | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017` | MongoDB connection string |
| `MONGODB_DB` | `webdoc` | Database name |
| `WEBDOC_HOST` | `127.0.0.1` | HTTP bind host |
| `PORT` | `18620` | HTTP port |
| `API_PREFIX` | `/api` | API URL prefix |
| `ADMIN_PREFIX` | `/admin` | CMS URL prefix |
| `JWT_SECRET` | `dev-secret-change-me` | JWT signing secret |
| `ADMIN_USERNAME` | `admin` | Seeded/reset admin username |
| `ADMIN_PASSWORD` | `admin123` | Seeded admin password |
| `WEBDOC_DATA_DIR` | package `data/` or XDG dir | Portable data root |
| `UPLOAD_DIR` | `WEBDOC_DATA_DIR/uploads` | Upload directory override |
| `CORS_ORIGINS` | localhost dev origins | Extra comma-separated origins |
| `WEBDOC_CACHE_DIR` | `/tmp/webdoc` | Public response cache root |
| `WEBDOC_CACHE_TTL_SECS` | `120` | Cache lifetime in seconds |
| `WEBDOC_SEED` | `false` | Opt-in demo content on an empty DB |
| `UI_DIST` / `ADMIN_DIST` | embedded | Optional dev frontend dirs |

### Public response cache

Successful public `GET` JSON responses are cached for about **2 minutes** to
avoid repeated MongoDB queries. Each query (`path + query string`) is written
to its **own file**:

```
/tmp/webdoc/<run-hash>/<sha256-of-path-and-query>.json
```

There is no monolithic cache file, so reading one query only touches one small
file. At startup WebDoc creates a new run hash and removes every other run
directory, keeping only the current one. Only HTTP 200 responses with valid
JSON are cached; 4xx/5xx and malformed responses are never stored. Any
successful CMS write clears the current run cache so edits appear immediately.

Upload resolution order:

1. `UPLOAD_DIR`
2. `WEBDOC_DATA_DIR/uploads`
3. `<package>/data/uploads`
4. `$XDG_DATA_HOME/webdoc/uploads` (or `~/.local/share/webdoc/uploads`)

## Build the single binary

```bash
./scripts/build.sh
```

By default **four targets** are produced in one run:

| Target | Use |
| --- | --- |
| `x86_64-unknown-linux-gnu` | amd64 VPS with glibc |
| `x86_64-unknown-linux-musl` | amd64 VPS, fully static |
| `aarch64-unknown-linux-gnu` | arm64 VPS with glibc |
| `aarch64-unknown-linux-musl` | arm64 VPS, fully static |

Build artifacts are staged under `dist/`, then the upload-ready files are moved
to a clean `releases/` directory:

```
dist/
└── webdoc-1.0.0-<target>/          # staged package (not uploaded)

releases/
├── webdoc-1.0.0-x86_64-unknown-linux-gnu.tar.gz
├── webdoc-1.0.0-x86_64-unknown-linux-musl.tar.gz
├── webdoc-1.0.0-aarch64-unknown-linux-gnu.tar.gz
├── webdoc-1.0.0-aarch64-unknown-linux-musl.tar.gz
├── webdoc-x86_64-unknown-linux-gnu
├── webdoc-x86_64-unknown-linux-musl
├── webdoc-aarch64-unknown-linux-gnu
├── webdoc-aarch64-unknown-linux-musl
└── SHA256SUMS
```

Cross-compiling requires:

```bash
cargo install cargo-zigbuild
rustup target add aarch64-unknown-linux-gnu aarch64-unknown-linux-musl
rustup target add x86_64-unknown-linux-musl
# Zig: https://ziglang.org/download/ or your package manager
```

Rebuild selected targets:

```bash
TARGETS="aarch64-unknown-linux-musl" ./scripts/build.sh
TARGETS="x86_64-unknown-linux-gnu x86_64-unknown-linux-musl" ./scripts/build.sh
```

Run the extracted package from any working directory:

```bash
mkdir -p /opt/webdoc
tar -xzf releases/webdoc-1.0.0-x86_64-unknown-linux-musl.tar.gz -C /opt/webdoc --strip-components=1
cd /tmp
WEBDOC_DATA_DIR=/var/lib/webdoc \
MONGODB_URI=mongodb://127.0.0.1:27017 \
/opt/webdoc/bin/webdoc --mongodb-db webdoc
```

## Install with mise

```bash
mise use -g github:manhavn/webdoc
```

Pin a specific release if required:

```bash
mise use -g github:manhavn/webdoc@1.0.0
```

mise selects the matching release asset for the current machine. The release
contains GNU and static musl builds for amd64 and arm64.

Then configure and run:

```bash
export WEBDOC_DATA_DIR="$HOME/.local/share/webdoc"
webdoc --host 127.0.0.1 --port 18620 --mongodb-url "mongodb://127.0.0.1:27017" --mongodb-db webdoc
webdoc --version
```

Every runtime setting can be supplied as a CLI flag: `--host`, `--port`,
`--api-prefix`, `--admin-prefix`, `--mongodb-url`, `--mongodb-db`,
`--jwt-secret`, `--admin-username`, `--admin-password`, `--data-dir`,
`--upload-dir`, `--cache-dir`, `--cache-ttl`, `--cors-origins`,
`--ui-dist`, `--admin-dist`. CLI values override environment variables and are
written into generated systemd/cron autostart configuration.

## CLI, daemon and autostart

```bash
webdoc --help

# Full foreground configuration
webdoc --host 0.0.0.0 --port 18620 \
       --api-prefix /api --admin-prefix /admin \
       --mongodb-url "mongodb://user:pass@127.0.0.1:27017/?authSource=admin" \
       --mongodb-db webdoc \
       --jwt-secret "replace-with-a-long-random-secret" \
       --admin-username admin --admin-password "replace-me" \
       --data-dir /var/lib/webdoc --upload-dir /var/lib/webdoc/uploads \
       --cache-dir /tmp/webdoc --cache-ttl 120 \
       --cors-origins "https://example.com"

# Same flags + autostart: the values are written into unit/cron
webdoc --autostart true --autostart-mode both --no-logs \
       --host 0.0.0.0 --port 18620 \
       --api-prefix /api --admin-prefix /admin \
       --mongodb-url "mongodb://127.0.0.1:27017" --mongodb-db webdoc \
       --jwt-secret "replace-with-a-long-random-secret" \
       --admin-username admin --admin-password "replace-me" \
       --data-dir /var/lib/webdoc --upload-dir /var/lib/webdoc/uploads \
       --cache-dir /tmp/webdoc --cache-ttl 120

# Preview generated configuration (does not modify the host)
webdoc --mongodb-url "mongodb://db:27017" --print-systemd
webdoc --mongodb-url "mongodb://db:27017" --print-cron

# Install autostart for the same configuration
webdoc --autostart true --host 0.0.0.0 --port 18620 --mongodb-url "mongodb://db:27017" --mongodb-db webdoc --no-logs
webdoc --autostart true --autostart-mode cron --mongodb-url "mongodb://db:27017" --no-logs
webdoc --autostart true --autostart-mode both --no-logs

# Remove unit/cron and stop the daemon
webdoc --autostart false

# Manual background process
webdoc --daemon
webdoc --daemon --no-logs
```

Generated systemd units run in the foreground (`Type=simple`) with
`WorkingDirectory`, `WEBDOC_DATA_DIR`, `WEBDOC_HOST`, `PORT`, prefixes and the effective
MongoDB URL/database. An optional `<data>/webdoc.env` can hold
`JWT_SECRET`, `ADMIN_PASSWORD`, etc. Cron uses a marked block:
`# >>> webdoc autostart >>>`.

If invoked through a mise shim, the generated configuration points at the shim
so version upgrades do not leave a deleted executable path behind. User units
need `loginctl enable-linger "$USER"` to run at boot without an active login.

## API overview

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | — | Health check |
| GET | `/api/docs/tree` | — | Documentation tree |
| GET | `/api/docs/page?path=...` | — | One documentation page |
| GET | `/api/partners` | — | Partner list (`/api/journals` alias retained) |
| GET | `/api/settings/{site,layout,appearance}` | — | Public configuration |
| GET | `/api/i18n` | — | Locales + public-UI default |
| GET | `/api/i18n/:code` | — | Translation dictionaries |
| POST | `/api/contact` | — | Contact form |
| POST | `/api/auth/login` | — | Admin login |
| GET | `/api/admin/stats` | Bearer | Dashboard counts |
| CRUD | `/api/admin/docs` | Bearer | Content tree |
| CRUD | `/api/admin/i18n` | Bearer | Languages + UI subset/default |
| GET/PUT | `/api/admin/{site,layout,appearance}` | Bearer | CMS configuration |
| POST | `/api/admin/upload` | Bearer | Image upload |
| GET/POST | `/api/admin/export` / `import` | Bearer | ZIP backup/restore |

> The `/journals` API aliases are retained for compatibility with older
> clients. The MongoDB collection is still named `journals`.

## Data and backup

MongoDB collections: `users`, `settings`, `docs`, `partners`/`journals`,
`contacts`, `layout`, `pages`, `i18n`.

The CMS **Backup & restore** page exports a ZIP containing JSON collections and
uploaded files. The i18n and appearance settings are included through the
`settings` collection.

## Testing

```bash
cd webdoc-api && cargo test
cd webdoc-admin && npm test
```

Frontend builds:

```bash
cd webdoc-ui && npm run build
cd webdoc-admin && npm run build
```

## Release

```bash
./scripts/build.sh
./scripts/release.sh          # uses the tag pointing at HEAD (e.g. v1.0.0)
./scripts/release.sh v1.0.0   # explicit tag
```

`release.sh` uploads all tar.gz packages and raw binaries from `releases/`
plus `SHA256SUMS` with `gh release create`. Upload the same nine files when
publishing manually: 4 `.tar.gz` packages, 4 raw binaries and `SHA256SUMS`.
Set `MONGODB_DB` (or use `--mongodb-db`) per environment.

## License

MIT — see [LICENSE](LICENSE).

Demo assets, logos, journal/partner names and contact details are fictional and
provided for evaluation only.
