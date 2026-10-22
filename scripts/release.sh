#!/usr/bin/env bash
#
# Publish a GitHub release with the artifacts produced by scripts/build.sh.
#
# Usage: scripts/release.sh [tag]
#
# Without a tag argument, the tag pointing at the current HEAD commit is used.
#
# Requires the GitHub CLI (`gh`) authenticated for the repository. No
# credentials are stored in this repository.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT/webdoc-api"
RELEASES_DIR="$ROOT/releases"

TAG="${1:-}"
if [[ -z "$TAG" ]]; then
    TAG="$(git -C "$ROOT" describe --tags --exact-match 2>/dev/null || true)"
    if [[ -z "$TAG" ]]; then
        echo "No tag at HEAD. Create/push a tag first, or pass one: $0 <tag>" >&2
        exit 2
    fi
    echo "Using current tag: $TAG"
fi

if ! command -v gh >/dev/null 2>&1; then
    echo "GitHub CLI (gh) is required: https://cli.github.com/" >&2
    exit 1
fi

if [[ ! -d "$RELEASES_DIR" ]] || ! find "$RELEASES_DIR" -maxdepth 1 -name 'webdoc-*.tar.gz' -print -quit | grep -q .; then
    echo "No release artifacts found; running scripts/build.sh" >&2
    "$ROOT/scripts/build.sh"
fi

VERSION="$(sed -n 's/^version = "\([^"]*\)"/\1/p' "$API_DIR/Cargo.toml" | head -n 1)"

FILES=()
while IFS= read -r file; do
    FILES+=("$file")
done < <(
    find "$RELEASES_DIR" -maxdepth 1 -type f \
        \( -name 'webdoc-*-unknown-linux-*.tar.gz' -o -name 'webdoc-*-unknown-linux-*' \) \
        -print | sort
)

if [[ "${#FILES[@]}" -eq 0 ]]; then
    echo "No release archives found; running scripts/build.sh" >&2
    "$ROOT/scripts/build.sh"
    while IFS= read -r file; do
        FILES+=("$file")
    done < <(
        find "$RELEASES_DIR" -maxdepth 1 -type f \
            \( -name 'webdoc-*-unknown-linux-*.tar.gz' -o -name 'webdoc-*-unknown-linux-*' \) \
            -print | sort
    )
fi

FILES+=("$RELEASES_DIR/SHA256SUMS")

for file in "${FILES[@]}"; do
    if [[ ! -f "$file" ]]; then
        echo "Missing artifact: $file (run scripts/build.sh)" >&2
        exit 1
    fi
done

gh release create "$TAG" "${FILES[@]}" \
    --title "WebDoc $TAG" \
    --generate-notes
