#!/usr/bin/env bash
#
# Build the self-contained WebDoc release artifacts for amd64 and arm64.
#
# Usage: scripts/build.sh [--skip-frontend]
#
# By default four targets are built in one invocation:
#   x86_64-unknown-linux-gnu   + x86_64-unknown-linux-musl
#   aarch64-unknown-linux-gnu  + aarch64-unknown-linux-musl
# GNU builds work on mainstream glibc VPS images; musl builds are fully static
# and are the safest choice for minimal/unknown Linux distributions.
# Override with TARGETS="aarch64-unknown-linux-gnu" (space-separated).
#
# Produces, under dist/:
#   webdoc-<version>-<target>/          staged portable package
# and publishes the upload set under releases/:
#   webdoc-<version>-<target>.tar.gz    release archive
#   webdoc-<target>                     raw binary for UBI/mise
#   SHA256SUMS                          checksums for all archives/raw binaries
#
# Requirements: bash, GNU tar, sha256sum and curl (or wget). Rust (cargo, rustc,
# rustup), Node.js/npm, zig and cargo-zigbuild are installed automatically on
# demand through mise (https://mise.jdx.dev); mise itself is installed with its
# official installer when missing. Only cross-compilation targets need
# zig + cargo-zigbuild (https://github.com/rust-cross/cargo-zigbuild). The
# script also runs `rustup target add` for the selected targets.
#
# The script may be invoked from any working directory.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT/webdoc-api"
UI_DIR="$ROOT/webdoc-ui"
ADMIN_DIR="$ROOT/webdoc-admin"
DIST_DIR="$ROOT/dist"
RELEASES_DIR="$ROOT/releases"

SKIP_FRONTEND=0
for argument in "$@"; do
    case "$argument" in
        --skip-frontend) SKIP_FRONTEND=1 ;;
        -h|--help)
            awk 'NR > 1 && /^set -euo pipefail$/ { exit } NR > 1 { print }' "$0"
            exit 0
            ;;
        *)
            echo "Unknown argument: $argument" >&2
            exit 2
            ;;
    esac
done

if [[ -n "${TARGETS:-}" ]]; then
    read -r -a BUILD_TARGETS <<<"$TARGETS"
elif [[ -n "${TARGET:-}" ]]; then
    BUILD_TARGETS=("$TARGET")
else
    # amd64 + arm64, each with glibc and static musl builds.
    BUILD_TARGETS=(
        "x86_64-unknown-linux-gnu"
        "x86_64-unknown-linux-musl"
        "aarch64-unknown-linux-gnu"
        "aarch64-unknown-linux-musl"
    )
fi

log() {
    printf '\n\033[1;36m==> %s\033[0m\n' "$*"
}

# ---------------------------------------------------------------------------
# Tool bootstrap
#
# Every tool the build needs is installed on demand, preferring mise
# (https://mise.jdx.dev). This keeps `scripts/build.sh` a single command on a
# fresh machine: missing Node.js, Rust, zig or cargo-zigbuild are fetched
# instead of aborting the build.
# ---------------------------------------------------------------------------

MISE_SHIMS="${MISE_DATA_DIR:-$HOME/.local/share/mise}/shims"
MISE_BIN="$(command -v mise 2>/dev/null || true)"

activate_mise() {
    [[ -x "$HOME/.local/bin/mise" ]] && PATH="$HOME/.local/bin:$PATH"
    [[ -d "$MISE_SHIMS" ]] && PATH="$MISE_SHIMS:$PATH"
    export PATH
    if [[ -z "$MISE_BIN" ]]; then
        MISE_BIN="$(command -v mise 2>/dev/null || true)"
    fi
}

install_mise() {
    [[ -n "$MISE_BIN" ]] && return 0
    log "Installing mise"
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL https://mise.run | sh
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- https://mise.run | sh
    else
        echo "Cannot install mise: curl or wget is required." >&2
        return 1
    fi
    activate_mise
    [[ -n "$MISE_BIN" ]]
}

# Map a command name to the mise tool spec that provides it.
mise_spec() {
    case "$1" in
        node|npm) printf 'node@latest' ;;
        zig) printf 'zig@latest' ;;
        cargo-zigbuild) printf 'cargo:cargo-zigbuild@latest' ;;
        rustup|cargo|rustc) printf 'rust@latest' ;;
        *) return 1 ;;
    esac
}

# Ensure a command exists, installing it through mise when possible.
ensure() {
    local tool="$1"
    if command -v "$tool" >/dev/null 2>&1; then
        return 0
    fi

    local spec=''
    if mise_spec "$tool" >/dev/null 2>&1; then
        spec="$(mise_spec "$tool")"
    fi

    if [[ -n "$spec" ]] && install_mise; then
        log "Installing $tool via mise ($spec)"
        if ! MISE_YES=1 "$MISE_BIN" use --global "$spec"; then
            echo "mise failed to install $tool ($spec)." >&2
            exit 1
        fi
        activate_mise
    fi

    if ! command -v "$tool" >/dev/null 2>&1; then
        echo "Missing required command: $tool" >&2
        case "$tool" in
            tar) echo "Install GNU tar first (apt-get install tar / dnf install tar)." >&2 ;;
            sha256sum) echo "Install coreutils first (apt-get install coreutils)." >&2 ;;
            *) echo "Install it manually and re-run scripts/build.sh." >&2 ;;
        esac
        exit 1
    fi
}

ensure cargo
ensure rustc
ensure tar
ensure sha256sum

HOST_TARGET="$(rustc -vV | sed -n 's/^host: //p')"

if [[ "$SKIP_FRONTEND" -eq 0 ]]; then
    ensure npm

    log "Building public site (webdoc-ui)"
    if [[ ! -d "$UI_DIR/node_modules" ]]; then
        npm ci --prefix "$UI_DIR"
    fi
    VITE_API_BASE=/api npm run build --prefix "$UI_DIR"

    log "Building CMS (webdoc-admin)"
    if [[ ! -d "$ADMIN_DIR/node_modules" ]]; then
        npm ci --prefix "$ADMIN_DIR"
    fi
    VITE_API_BASE=/api VITE_ADMIN_BASE=/admin/ npm run build --prefix "$ADMIN_DIR"
fi

for directory in "$UI_DIR/dist" "$ADMIN_DIR/dist"; do
    if [[ ! -f "$directory/index.html" ]]; then
        echo "Missing front-end build: $directory/index.html" >&2
        echo "Run without --skip-frontend after installing Node.js dependencies." >&2
        exit 1
    fi
done

log "Embedding front-end builds"
copy_build() {
    local source="$1"
    local destination="$2"

    mkdir -p "$destination"
    find "$destination" -mindepth 1 -maxdepth 1 ! -name '.gitkeep' -exec rm -rf {} +
    cp -a "$source"/. "$destination"/
}
copy_build "$UI_DIR/dist" "$API_DIR/embed/ui"
copy_build "$ADMIN_DIR/dist" "$API_DIR/embed/admin"

VERSION="$(sed -n 's/^version = "\([^"]*\)"/\1/p' "$API_DIR/Cargo.toml" | head -n 1)"
ARTIFACTS=()
PACKAGES=()

build_target() {
    local target="$1"
    local binary
    local name="webdoc-${VERSION}-${target}"
    local stage="$DIST_DIR/$name"
    local tarball="${name}.tar.gz"
    local raw="webdoc-${target}"

    if [[ "$target" == "$HOST_TARGET" ]]; then
        log "Building release binary for $target (host)"
        cargo build --release --locked --manifest-path "$API_DIR/Cargo.toml"
        binary="$API_DIR/target/release/webdoc"
    else
        ensure rustup
        ensure cargo-zigbuild
        ensure zig
        log "Building release binary for $target (cargo-zigbuild)"
        rustup target add "$target"
        # rustc always passes `-Wl,-O1` to GNU-style linkers; zig's bundled LLD
        # reports it as deprecated and rustc surfaces that stderr as a
        # `linker_messages` warning (rust-lang/rust#158192). Allow only that
        # lint for cross builds instead of failing the build output with a
        # warning we cannot remove.
        local rustflags_var="CARGO_TARGET_$(printf '%s' "$target" | tr '[:lower:]-' '[:upper:]_')_RUSTFLAGS"
        local rustflags="${!rustflags_var:-}"
        env "$rustflags_var=${rustflags:+$rustflags }-Alinker_messages" \
            cargo zigbuild --release --locked --manifest-path "$API_DIR/Cargo.toml" --target "$target"
        binary="$API_DIR/target/$target/release/webdoc"
    fi

    [[ -x "$binary" ]] || {
        echo "Binary not produced for $target: $binary" >&2
        exit 1
    }

    log "Staging $name"
    rm -rf "$stage"
    mkdir -p "$stage/bin" "$stage/share/webdoc" "$stage/data/uploads"

    install -m 755 "$binary" "$stage/bin/webdoc"
    install -m 755 "$binary" "$stage/bin/webdoc-api"
    cp -a "$UI_DIR/dist" "$stage/share/webdoc/ui"
    cp -a "$ADMIN_DIR/dist" "$stage/share/webdoc/admin"
    touch "$stage/data/uploads/.gitkeep"
    cp "$ROOT/README.md" "$stage/README.md"
    cp "$API_DIR/.env.example" "$stage/.env.example"

    log "Creating archive and raw binary for $target"
    tar -czf "$DIST_DIR/$tarball" -C "$DIST_DIR" "$name"
    install -m 755 "$binary" "$DIST_DIR/$raw"

    ARTIFACTS+=("$tarball" "$raw")
    PACKAGES+=("$stage")
}

for target in "${BUILD_TARGETS[@]}"; do
    build_target "$target"
done

log "Publishing upload artifacts to $RELEASES_DIR"
rm -rf "$RELEASES_DIR"
mkdir -p "$RELEASES_DIR"
for artifact in "${ARTIFACTS[@]}"; do
    mv "$DIST_DIR/$artifact" "$RELEASES_DIR/$artifact"
done
(
    cd "$RELEASES_DIR"
    sha256sum "${ARTIFACTS[@]}" >SHA256SUMS
)

log "Done"
for package in "${PACKAGES[@]}"; do
    printf '  package:  %s\n' "$package"
done
for artifact in "${ARTIFACTS[@]}"; do
    printf '  release:  %s\n' "$RELEASES_DIR/$artifact"
done
printf '  checksums: %s\n' "$RELEASES_DIR/SHA256SUMS"
