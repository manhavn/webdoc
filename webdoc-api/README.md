# WebDoc API

Rust backend for the WebDoc scientific-journal website and its admin CMS.
Built with [axum](https://github.com/tokio-rs/axum) 0.8 and the official
MongoDB Rust driver.

The API exposes public read endpoints for the marketing site, JWT-protected
admin endpoints for the CMS, file uploads, and — when the front-end builds are
present — serves the public site at `/` and the CMS at `/admin`.

## Requirements

- Rust 1.80+
- MongoDB 6+ running locally (or a connection string to a remote deployment)

## Quick start

```bash
cd webdoc-api
cp .env.example .env          # optional: defaults match the values below
cargo run
```

The server listens on `http://127.0.0.1:18620` by default. On the first boot it
connects to MongoDB and creates indexes. Core bootstrap on an empty database:

- administrator account (`ADMIN_USERNAME` / `ADMIN_PASSWORD`)
- interface translations (`en`, `vi`) from `src/seed_data/i18n.json`

Demo content is opt-in with `--seed`:

- 12 fictional demo partners
- demo site settings, appearance and two static pages (`gioi-thieu`, `contact`)
- the documentation tree: 42 nodes (4 root sections, nested groups and pages)
  loaded from `src/seed_data/docs.json`
- demo navigation in `appearance_demo.json`

Bootstrap/demo seeding only fills empty collections, so restarting never
overwrites existing content.

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017` | MongoDB connection string |
| `MONGODB_DB` | `webdoc` | Database name |
| `WEBDOC_HOST` | `127.0.0.1` | HTTP bind host |
| `PORT` | `18620` | HTTP port |
| `API_PREFIX` | `/api` | Public API prefix |
| `ADMIN_PREFIX` | `/admin` | CMS static prefix |
| `JWT_SECRET` | `dev-secret-change-me` | HS256 signing secret — change in production |
| `ADMIN_USERNAME` | `admin` | Username created on first boot |
| `ADMIN_PASSWORD` | `admin123` | Password created on first boot |
| `WEBDOC_SEED` | `false` | Opt-in demo content |
| `UPLOAD_DIR` | auto | Directory for uploaded images (served at `/uploads`) |
| `WEBDOC_DATA_DIR` | — | Data directory; uploads go to `<dir>/uploads` |
| `CORS_ORIGINS` | — | Extra comma-separated allowed origins |
| `UI_DIST` | — | Optional external public-site build (dev override) |
| `ADMIN_DIST` | — | Optional external CMS build (dev override) |

The upload directory is resolved independently of the current directory:
`UPLOAD_DIR` → `WEBDOC_DATA_DIR/uploads` → `<package>/data/uploads` (when the
portable package's `data` directory exists) → `$XDG_DATA_HOME/webdoc/uploads`
(or `~/.local/share/webdoc/uploads`). It is created on startup.

The release binary embeds both front-end builds, so `UI_DIST` / `ADMIN_DIST`
are only needed during front-end development (or when testing `cargo run`
before the front ends have been built).

Built-in CORS origins: `http://localhost:5173`, `http://localhost:5174`,
`http://127.0.0.1:5173`, `http://127.0.0.1:5174`, plus `CORS_ORIGINS`.

When the whole site runs on one domain, keep `API_PREFIX=/api` and
`ADMIN_PREFIX=/admin`; the frontend build must use `VITE_API_BASE=/api` and,
for the CMS, `VITE_ADMIN_BASE=/admin/`. `/api` and `/admin` are reserved so the
public SPA fallback never serves HTML for them.
Use `*` in `CORS_ORIGINS` to allow every origin (development only).

## Static hosting

- `/uploads/*` → resolved upload directory (safe path validation, ETag)
- `/admin` and `/admin/*` → embedded CMS build (or external `ADMIN_DIST`),
  SPA fallback to `index.html`
- any other unmatched path → embedded public build (or external `UI_DIST`),
  SPA fallback to `index.html`

`/api/*` routes are always matched before the SPA fallback, and unknown API
paths return `404 {"error":"API endpoint not found"}` instead of the HTML shell.
No nginx/caddy or external `dist` directory is required in production.

### Caching

- API JSON `GET` responses carry a strong `ETag` (SHA-256) and honour
  `If-None-Match` with an empty `304`; `Cache-Control: no-cache`
  (`private, no-cache` under `/api/admin/*` and `/api/auth/*`).
- Static files carry an `ETag`; Vite's hashed `assets/*` are served with
  `public, max-age=31536000, immutable`, `index.html`/SPA fallbacks with
  `no-cache`.
- `/uploads/*` uses a `mtime + size` ETag, `304` support and
  `Cache-Control: public, max-age=86400`.
- Non-GET requests, ZIP export and multipart import are streamed unchanged.

### Building a release

From the project root:

```bash
./scripts/build.sh          # UI + CMS + Rust for amd64/arm64 GNU+musl -> releases/
./scripts/release.sh          # uses current HEAD tag
./scripts/release.sh v1.0.0   # explicit tag
```

The binary is `webdoc` (`webdoc-api/target/release/webdoc`). `build.rs` copies
`../webdoc-ui/dist` and `../webdoc-admin/dist` into `embed/` before `rust-embed`
reads them; the embed directories are committed empty via `.gitkeep`.

### Service management CLI

The binary can install its own autostart configuration and run detached:

```bash
webdoc --print-systemd            # ready-to-use unit, no changes
webdoc --print-cron               # marked crontab block, no changes
webdoc --autostart true --no-logs # user unit (or system unit as root)
webdoc --autostart true --autostart-mode both
webdoc --autostart false          # stop/disable/remove unit + cron block
webdoc --daemon --no-logs         # manual background process, pid file

# Override MongoDB for both the current run and generated autostart config
webdoc --mongodb-url "mongodb://127.0.0.1:27017" --mongodb-db webdoc
webdoc --autostart true --mongodb-url "mongodb://db:27017" --mongodb-db webdoc --no-logs
```

If the invoked path is a mise shim (`.../mise/shims/webdoc`) it is used
verbatim; if the binary runs from `.../mise/installs/.../bin/webdoc`, the
generated config points at `$MISE_DATA_DIR/shims/webdoc` (or
`~/.local/share/mise/shims/webdoc`) with a warning when the shim is missing.
Systemd units run in the foreground (no `--daemon`); cron uses
`@reboot <shim> --daemon [--no-logs]`. Generated configs set
`WorkingDirectory`, `WEBDOC_DATA_DIR`, `PORT`, `API_PREFIX`, `ADMIN_PREFIX`,
`MONGODB_URI` and `MONGODB_DB`; `--mongodb-url`/`--mongodb-db` override them
for the current run and are written into the generated autostart config. These
commands do not connect to MongoDB.

### Public response cache

Public `GET` JSON responses are cached for 120 seconds in
`/tmp/webdoc/<run-hash>/`, one file per `path + query string`. Old run
directories are deleted at startup. Only successful (HTTP 200) valid JSON is
stored; the CMS (`/admin/*`) and auth endpoints are never cached, and admin
writes clear the current run cache.

```text
WEBDOC_CACHE_DIR=/tmp/webdoc
WEBDOC_CACHE_TTL_SECS=120
```

### CLI configuration

Every runtime setting also has a CLI flag; flags override environment values
and are written into generated systemd/cron config:

```text
--host --port --api-prefix --admin-prefix
--mongodb-url --mongodb-db
--jwt-secret --admin-username --admin-password
--data-dir --upload-dir --cache-dir --cache-ttl
--cors-origins --ui-dist --admin-dist
```

## Authentication

```http
POST /api/auth/login
Content-Type: application/json

{"username": "admin", "password": "admin123"}
```

Returns `{"token": "...", "user": {"id", "username", "role"}}`. The JWT is
HS256 with claims `sub`, `username`, `role`, `exp` and is valid for 24 hours.
Send it on admin requests as `Authorization: Bearer <token>`.

`GET /api/auth/me` returns the current user. Missing or invalid tokens receive
`401 {"error": "Unauthorized"}`.

## API endpoints

All errors are JSON: `{"error": "message"}` with an appropriate status code.

### Public

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/health` | `{"status":"ok"}` |
| GET | `/api/partners` (alias `/api/journals`) | `[{id,name,org,logo,url,order}]`, sorted by `order` |
| GET | `/api/settings/layout` | `{slug:"home", sections:[{key,enabled,order,data}]}` |
| GET | `/api/settings/site` | `{siteName,tagline,hotline,email,address,facebook,youtube,footerText,headerLogo,footerLogo,favicon,ogImage}` |
| GET | `/api/settings/appearance` | Stored theme merged with bundled defaults (colors, fonts, background, header, footer, navigation, pages) |
| GET | `/api/i18n` | Enabled locales: `{defaultLocale,uiDefaultLocale,locales:[{code,name,order,uiEnabled}]}`, sorted by `order`; `defaultLocale` is the CMS default, `uiDefaultLocale` the website default |
| GET | `/api/i18n/:code` | Enabled locale dictionaries: `{code,name,ui,admin}`; 404 when disabled/unknown |
| GET | `/api/pages/:slug` | `{slug,title,content}` |
| GET | `/api/docs/tree` | Published docs nested by `children`; no content |
| GET | `/api/docs/page?path=/…` | Published page: full node, `children`, `breadcrumbs` |
| GET | `/api/docs/by-id/:id` | Same payload as `/api/docs/page` |
| POST | `/api/contact` | `{name,email,phone?,message}` → `{"ok":true}` |

### Admin (Bearer token required)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/admin/stats` | `{docs,docsPublished,docGroups,docPages,docsHidden,journals,contacts,locales,uiLocales}` (`locales` = enabled locales, `uiLocales` = enabled and UI-visible locales) |
| GET/POST | `/api/admin/partners` (alias `/api/admin/journals`) | Partner CRUD |
| GET/PUT/DELETE | `/api/admin/partners/:id` | Partner CRUD |
| ~~GET/PUT~~ | `/api/admin/layout` | Legacy endpoint; no longer exposed in the CMS |
| GET/PUT | `/api/admin/site` | Site settings (partial updates are merged) |
| GET/PUT | `/api/admin/appearance` | Full appearance/theme document, including `navigation` and editable `pages`; PUT replaces it after merging defaults |
| GET/POST | `/api/admin/docs` | Flat list of all docs (full content) / create |
| GET/PUT/DELETE | `/api/admin/docs/:id` | Full node CRUD; delete removes the subtree |
| GET/POST | `/api/admin/i18n` | All locales as full documents (`code,name,enabled,isDefault,uiEnabled,uiDefault,order,ui,admin,created_at,updated_at`) / create |
| GET/PUT/DELETE | `/api/admin/i18n/:code` | Locale detail, partial update, delete |
| POST | `/api/admin/i18n/reset` | Restore the bundled EN/VI core configuration; returns every locale |
| POST | `/api/admin/upload` | Multipart field `file`; PNG/JPEG/WEBP/GIF/SVG, max 5 MB |
| GET | `/api/admin/export` | Download a full ZIP backup (`application/zip`, see below) |
| POST | `/api/admin/import` | Multipart field `file`; restore a backup ZIP, max 512 MB |
| POST | `/api/admin/change-password` | `{currentPassword,newPassword}` → `{"ok":true}` |

### Slugs

Docs slugs are generated from the title: Vietnamese diacritics are removed,
`đ` becomes `d`, and spaces/punctuation become single dashes.

For docs, `path` — not `slug` — is the unique identity. Slugs only need to be
unique among siblings because the sibling path is derived from them.

## Documentation tree

Documentation lives in the `docs` collection. Every node stores `title`,
`slug`, absolute `path`, `parentId`, `group`, `order`, `description`, `content`
(HTML), `published`, `createdAt` and `updatedAt`. `group: true` marks a section
and `group: false` a content page. `path` has a unique index;
`{parentId, order}` is indexed for tree listings.

On first boot the collection is seeded from `src/seed_data/docs.json` (42
nodes). Each seed item has `parentPath`, which the loader resolves to the real
`parentId` of the already generated parent id. The seed is skipped whenever the
collection is non-empty.

### Tree and page shape

`GET /api/docs/tree` returns published nodes nested through `children` and
sorted by `order`, then `title`:

```json
[{
  "id": "24-hex-object-id",
  "title": "Hướng dẫn sử dụng",
  "slug": "huong-dan-su-dung",
  "path": "/huong-dan-su-dung",
  "parentId": null,
  "group": true,
  "order": 1,
  "description": "…",
  "published": true,
  "children": []
}]
```

`GET /api/docs/page?path=/huong-dan-su-dung/tai-khoan` returns the same fields
plus `content`, nested `children` summaries, and `breadcrumbs` with the ancestor
trail from the root to the direct parent (`[{title,path}]`, self excluded):

```json
{
  "id": "…", "title": "Tài khoản", "path": "/huong-dan-su-dung/tai-khoan",
  "content": "<p>…</p>",
  "children": [{ "id": "…", "path": "/huong-dan-su-dung/tai-khoan/dang-ky-dang-nhap", "children": [] }],
  "breadcrumbs": [{ "title": "Hướng dẫn sử dụng", "path": "/huong-dan-su-dung" }]
}
```

Unpublished or unknown paths return `404 {"error": "…"}`. Only published nodes
are ever exposed publicly; children of an unpublished node are promoted to
roots in the tree so the navigation never loses pages.

### Admin payloads

`POST /api/admin/docs` accepts `{title, slug?, path?, parentId?, group?, order?,
description?, content?, published?}`. Defaults: `slug` from `title`, `path` from
the parent path plus the slug (`/<slug>` at the root), `order` after the last
sibling, `group: false`, `published: true`.

`PUT /api/admin/docs/:id` is a partial update. When `title`, `slug`, `path` or
`parentId` changes, the node path is recomputed and every descendant path is
rewritten by replacing the old prefix. `parentId: null` moves a node to the
root. A parent may not be the node itself or one of its descendants, and a path
may not collide with an existing node or subtree — both return
`400 {"error": "…"}`. Reordering is a plain `PUT {order}`.

`DELETE /api/admin/docs/:id` removes the node and its whole subtree and returns
`{"ok":true}` (404 when the node does not exist).

## Interface translations (i18n)

The public site and the CMS load their interface strings from the `i18n`
collection instead of bundled JSON. Each document has the shape:

```json
{
  "_id": "…",
  "code": "en",
  "name": "English",
  "enabled": true,
  "isDefault": true,
  "uiEnabled": true,
  "uiDefault": true,
  "order": 1,
  "ui": { "nav.search": "Search" },
  "admin": { "languages.title": "Languages" },
  "created_at": "2026-10-22T02:05:46.136Z",
  "updated_at": "2026-10-22T02:05:46.136Z"
}
```

`ui` (public site) and `admin` (CMS) are flat objects mapping message keys to
strings; keys keep their dots (for example `nav.search`). Nested objects,
arrays and non-string values are rejected. `code` has a unique index.

There are two independent layers:

- `enabled` / `isDefault` — the CMS layer. Every enabled locale is available
  to the CMS, and `isDefault` is the CMS-wide default (English by default).
- `uiEnabled` / `uiDefault` — the public-website layer. It may be a subset of
  the CMS locales, with its own default. `uiEnabled` may only be `true` while
  `enabled` is `true`.

The collection always keeps these invariants: exactly one `isDefault: true`
document, the default is enabled, at least one locale is enabled, at least one
locale is UI-visible, exactly one UI-visible locale carries `uiDefault: true`,
and changing a default clears the old flag in the same request.

On first boot the collection is seeded from `src/seed_data/i18n.json`
(English and Vietnamese, including the `languages.*` CMS keys) only when it is
empty: English is both the CMS and website default, Vietnamese is enabled and
visible but not a default. The seed is validated before insertion (locale
codes, flat dictionaries, exactly one CMS default that is enabled, exactly one
UI default that is enabled and visible).

### Startup migration

Documents written before the public-UI split have no `uiEnabled` / `uiDefault`
fields. On every boot the API backfills them from the existing CMS flags
(`uiEnabled` ← `enabled`, `uiDefault` ← `isDefault`), clears `uiEnabled` on
globally disabled locales, and then repairs the UI defaults: a missing default
goes to `en` when it is visible, otherwise to the lowest ordered visible
locale; multiple defaults keep `en` or the first one; a default on a hidden
locale is replaced; when nothing is visible, `en` is enabled again. The repair
is idempotent and only writes when an invariant is broken.

### Public endpoints

|Method|Path|Response|
|---|---|---|
|GET|`/api/i18n`|`{defaultLocale,uiDefaultLocale,locales:[{code,name,order,uiEnabled}]}` for all enabled locales, sorted by `order`|
|GET|`/api/i18n/:code`|`{code,name,ui,admin}` for an enabled locale; `404` when the locale is disabled or unknown|

`defaultLocale` follows the CMS `isDefault` flag; `uiDefaultLocale` is the
public website default and only ever points at an enabled, UI-visible locale.
Every enabled locale is listed with its `uiEnabled` flag so the website can
filter its selector; hidden locales are never offered by `uiDefaultLocale`.

Translations are not sensitive, so both endpoints are unauthenticated. The
CMS login page uses them before a token exists.

### Admin endpoints

|Method|Path|Notes|
|---|---|---|
|GET|`/api/admin/i18n`|All locales (including disabled), sorted by `order`, then `name`, as full documents|
|GET|`/api/admin/i18n/:code`|Single full document|
|POST|`/api/admin/i18n`|Body `{code,name,ui,admin,enabled?,isDefault?,uiEnabled?,uiDefault?,order?}`; returns the created document|
|PUT|`/api/admin/i18n/:code`|Partial update `{name?,ui?,admin?,enabled?,isDefault?,uiEnabled?,uiDefault?,order?}`; returns the updated document|
|DELETE|`/api/admin/i18n/:code`|`{"ok":true}`; rejects the CMS default, the UI default and the last enabled/UI-visible locale|
|POST|`/api/admin/i18n/reset`|Restore the bundled EN/VI core configuration; returns every locale|

`POST` validation:

- `code` must match `^[a-z]{2}(-[A-Za-z]{2})?$` (`en`, `pt-BR`) and be unique
  (a duplicate returns `409 {"error": "…"}`);
- `name` must not be blank;
- `ui` and `admin` are required flat string maps;
- `enabled` defaults to `true`; `isDefault` defaults to `false`;
- `uiEnabled` defaults to `enabled`; `uiDefault` defaults to `false`;
- `order` defaults to the last locale's order plus one;
- `isDefault: true` with `enabled: false`, `uiEnabled: true` with
  `enabled: false`, and `uiDefault: true` without `enabled && uiEnabled` are
  rejected.

`PUT` applies only the fields present. Marking a locale as default clears
`isDefault` on every other locale, and marking one as UI default clears
`uiDefault` on every other locale. Disabling a globally enabled locale clears
its `uiEnabled`. These all return `400 {"error": "…"}`:

- disabling or deleting the CMS default, or removing `isDefault` from it;
- hiding (`uiEnabled: false`), disabling or deleting the current UI default;
- removing `uiDefault` from the current UI default;
- setting `uiDefault: true` on a locale that is not enabled and UI-visible;
- disabling/deleting the last enabled locale;
- hiding or deleting the last UI-visible locale.

The error tells the CMS to choose another default first. Unknown codes return
`404`.

`POST /api/admin/i18n/reset` restores English and Vietnamese from
`seed_data/i18n.json` (name, order and both dictionaries), both enabled and
UI-visible, with English as the CMS and website default and Vietnamese as
neither. Every other locale stays in the CMS with its `enabled` flag and
dictionaries untouched, but is forced to `isDefault: false`,
`uiDefault: false` and `uiEnabled: false`, so only EN/VI remain on the public
website. The response is the full admin locale array (`200`, sorted like
`GET /api/admin/i18n`).

Backups include the collection automatically (see below), so locales and their
dictionaries survive export/import.

## Appearance and static pages

Global UI appearance lives in the `settings` collection as a single document
with `{ "key": "appearance", … }`. It is stored separately from the `site`
settings document, so branding/logos and the theme can be edited
independently.

`GET /api/settings/appearance` is public and returns the stored document merged
with the defaults from `src/seed_data/appearance.json`. The admin endpoints
(`GET`/`PUT /api/admin/appearance`, Bearer token required) use the same shape;
`PUT` replaces the complete document. Like every JSON `GET`, the responses
carry a strong `ETag` and honour `If-None-Match` (`304`).

```json
{
  "colors": {
    "primary": "#0f766e", "primaryDark": "#115e59", "accent": "#0891b2",
    "background": "#ffffff", "surface": "#f8fafc", "text": "#0f172a",
    "muted": "#64748b", "border": "#e2e8f0",
    "headerBackground": "#ffffff", "headerText": "#0f172a",
    "footerBackground": "#0b2b2a", "footerText": "#d1fae5"
  },
  "fonts": {
    "body": "Inter, ui-sans-serif, system-ui, sans-serif",
    "heading": "Inter, ui-sans-serif, system-ui, sans-serif",
    "baseSize": "16px", "googleFontsUrl": ""
  },
  "background": { "image": "", "color": "#ffffff", "overlay": 1, "fixed": false },
  "header": {
    "show": true, "sticky": true, "showSearch": true, "showLanguage": true,
    "background": "", "text": "", "ctaLabel": "", "ctaLabelVi": "", "ctaUrl": ""
  },
  "footer": {
    "show": true, "background": "", "text": "", "copyright": "", "note": "",
    "links": [{ "label": "Docs", "labelVi": "Tài liệu", "href": "/docs" }]
  },
  "navigation": [
    {
      "label": "About", "labelVi": "Giới thiệu", "href": "/gioi-thieu",
      "links": [{ "label": "Contact", "labelVi": "Liên hệ", "href": "/lien-he" }]
    }
  ],
  "pages": [
    { "slug": "gioi-thieu", "title": "About", "titleVi": "Giới thiệu", "content": "<p>…</p>" }
  ]
}
```

- `navigation: []` means the website keeps its built-in navigation; a
  non-empty array fully replaces it (each item may have a `links` submenu).
- `pages` are editable static pages exposed by the theme, independent of the
  `docs` collection. Each entry needs a non-empty `slug`; `content` is HTML.
- Empty color/background overrides (`header.background`, `header.text`,
  `footer.background`, `footer.text`, `background.image`) fall back to the
  corresponding `colors` values in the UI.
- `background.overlay` is a number (normally `0`–`1`), `background.fixed`
  pins the image while scrolling.

`PUT` accepts one JSON object with a maximum serialized size of 256 KB
(`400` beyond that). The payload is normalized before saving: missing keys are
filled from the bundled defaults, objects merge recursively, arrays replace
the default, unknown keys are dropped, and a value of the wrong JSON type
(`400 {"error": "…"}`) is rejected. `pages[].slug` may not be blank.

Uploads referenced from the appearance document (`/uploads/<name>` anywhere,
including `background.image` and page HTML) are collected from both the old
and new document on every `PUT`; files that disappeared from the theme are
deleted unless another collection still references them.

The document is seeded from `src/seed_data/appearance.json` on startup only
when it is missing, so fresh installations and upgrades both receive the
defaults without overwriting an edited theme. The `settings` collection is
part of every backup, so `appearance` is exported and restored automatically.

## Uploads

`POST /api/admin/upload` accepts `multipart/form-data` with a `file` field,
stores the file under `UPLOAD_DIR` with a UUID name, and returns
`{"url":"/uploads/<uuid>.<ext>"}`. Allowed MIME types are `image/png`,
`image/jpeg`, `image/webp`, `image/gif`, `image/svg+xml`; files larger than
5 MB are rejected with `400`.

## Backup and restore

`GET /api/admin/export` returns the whole installation as a ZIP download named
`webdoc-backup-YYYYMMDD-HHMMSS.zip` (`Content-Type: application/zip`). Both
backup endpoints require an admin Bearer token.

```
manifest.json                    {format, version, exportedAt, collections, uploads}
data/<collection>.json           one MongoDB Extended JSON array per collection
uploads/<name>                   every regular file in UPLOAD_DIR
```

`manifest.json` looks like:

```json
{
  "format": "webdoc-backup",
  "version": 1,
  "exportedAt": "2026-10-22T12:34:56.789Z",
  "collections": [{ "name": "docs", "count": 42 }],
  "uploads": ["9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.png"]
}
```

Every collection in the database except `system.*` is exported dynamically, so
new collections are included without code changes. Documents are written as
MongoDB Extended JSON, which preserves `ObjectId` values, `DateTime` values and
other BSON types exactly. Hidden files and directories in `UPLOAD_DIR` are
skipped. Stored upload URLs (`/uploads/<name>`) stay relative, so the same
archive works on any host or domain.

`POST /api/admin/import` accepts `multipart/form-data` with a `file` field
(maximum 512 MB) and restores the archive:

```json
{ "ok": true, "collections": { "docs": 42 }, "uploads": 1 }
```

Import semantics:

- the archive is fully validated before any write: manifest `format` and
  `version` are checked, entry paths may not be absolute, contain `..`, or use
  backslashes, and every `data/*.json` file must parse;
- limits: 5000 entries, 512 MB total uncompressed, 200 MB per file;
- **replace mode** — every collection present in the archive is cleared with
  `delete_many({})` and then repopulated. An empty array clears the collection;
  collections absent from the archive are left untouched, and indexes are never
  dropped;
- `UPLOAD_DIR` is cleared (`.gitkeep` is kept) and the archived `uploads/*`
  files are written back;
- because `users` is replaced too, the restored installation accepts the
  administrator credentials that were exported;
- an invalid or unsafe archive returns `400 {"error": "…"}` without applying
  any data.

## Development

```bash
cargo build          # debug build
cargo test           # unit tests (slug, docs, backup, i18n and appearance helpers)
cargo run            # start on :18620
cargo fmt --check    # formatting
RUST_LOG=debug cargo run
```

The database can be inspected with `mongosh mongodb://127.0.0.1:27017/webdoc`.
To reset a local development instance, stop the server and drop the database:

```bash
mongosh mongodb://127.0.0.1:27017/webdoc --eval 'db.dropDatabase()'
```

## Project layout

```
src/
  main.rs        router, CORS, static hosting, startup
  config.rs      environment configuration
  db.rs          MongoDB connection and indexes
  models.rs      documents, DTOs, request payloads, layout helpers
  auth.rs        password hashing, JWT, Bearer extractor
  error.rs       ApiError + JSON extractors
  slug.rs        Vietnamese slug generation
  docs.rs        documentation tree helpers (paths, tree building, seed-facing queries)
  migrate.rs     startup data migrations (public-UI locale backfill/repair)
  seed.rs        first-boot seed data
  uploads.rs     multipart image upload handler
  bson_json.rs   BSON ⇄ JSON helpers for free-form layout data
  routes/
    mod.rs       shared helpers (layout/site/object ids)
    public.rs    public site endpoints
    admin.rs    CMS endpoints
    appearance.rs public theme + admin appearance settings
    backup.rs    ZIP backup export/import
    docs.rs      public docs tree/page + admin docs CRUD
    i18n.rs      public interface translations + admin locale CRUD
    auth.rs      login / me
  seed_data/     layout, site, appearance, journal, docs and i18n seed JSON
```
