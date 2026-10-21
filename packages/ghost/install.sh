#!/usr/bin/env bash
# Ghost CLI installer — macOS & Linux (pure curl+tar, no npm)
#   curl -fsSL https://raw.githubusercontent.com/arko33/ghostinthecodebase/main/packages/ghost/install.sh | bash
# Result: `ghost` command on PATH, recorder files in ~/.ghost/lib
set -euo pipefail

REPO="arko33/ghostinthecodebase"
REF="${GHOST_REF:-main}"
GHOST_LIB="$HOME/.ghost/lib"
GHOST_BIN="$HOME/.ghost/bin"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "==> Downloading Ghost recorder (branch: ${REF})"
curl -fsSL "https://codeload.github.com/${REPO}/tar.gz/refs/heads/${REF}" -o "$TMP/ghost.tar.gz"
tar -xzf "$TMP/ghost.tar.gz" -C "$TMP"

SRC="$(find "$TMP" -maxdepth 3 -type d -path '*packages/ghost')"
if [ -z "$SRC" ]; then
  echo "x packages/ghost not found in tarball" >&2
  exit 1
fi

echo "==> Installing to ${GHOST_LIB}"
mkdir -p "$GHOST_LIB" "$GHOST_BIN"
cp -r "$SRC/." "$GHOST_LIB/"

if ! command -v node >/dev/null 2>&1; then
  echo "" >&2
  echo "x Node.js >= 18 is required (the CLI is a plain node script)." >&2
  echo "  Install it from https://nodejs.org, then re-run this installer." >&2
  exit 1
fi

cat > "$GHOST_BIN/ghost" <<SHIM
#!/usr/bin/env bash
exec node "$GHOST_LIB/ghost.mjs" "\$@"
SHIM
chmod +x "$GHOST_BIN/ghost"

add_rc() {
  RC="$1"
  [ -f "$RC" ] || touch "$RC"
  if ! grep -q "ghost-to-path" "$RC" 2>/dev/null; then
    printf '\n# ghost-to-path\nexport PATH="%s:$PATH"\n' "$GHOST_BIN" >> "$RC"
    echo "==> PATH added to $RC"
  else
    echo "==> PATH already configured in $RC"
  fi
}
add_rc "$HOME/.profile"
if [ -n "${ZSH_VERSION:-}" ] && [ "$HOME/.zshrc" != "$HOME/.profile" ]; then
  add_rc "$HOME/.zshrc"
fi

echo ""
echo "✓ Ghost recorder installed:"
echo "   files : ${GHOST_LIB}"
echo "   shim  : ${GHOST_BIN}/ghost"
echo ""
echo "   Usage (from ANY project directory):"
echo "     ghost status        # summary of repo + cloud pairing"
echo "     ghost watch         # record a live session (README: full guide)"
echo "     ghost sessions      # list recorded sessions"
echo "     ghost setup         # optionally pair with Ghost Cloud"
echo ""
echo "   Open a NEW shell (or: export PATH=\"${GHOST_BIN}:\$PATH\") then run: ghost status"
