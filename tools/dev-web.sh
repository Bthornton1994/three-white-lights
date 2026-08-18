#!/usr/bin/env bash
# Restart the Expo web dev server that the screenshot harness drives.
# Kills by listening port rather than by process-name match, because a
# pattern like "expo start" also matches the restarting shell itself.
set -u
# Derived from this script's own location, not hard-coded, so a builder working
# in a git worktree serves ITS checkout rather than the main one.
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG="${1:-/tmp/expo-web.log}"
PORT="${PORT:-8081}"
# One schema home for the sentinel the browser tools gate on: the node module
# writes and removes it, so bash never hand-rolls JSON or /proc parsing. See
# tools/devServerSentinel.mjs for what is recorded and why.
SENTINEL_TOOL="$REPO/tools/devServerSentinel.mjs"

# The removal goes first: between here and a successful restart there is no
# managed server for this checkout, and the browser tools should refuse
# (NO_SENTINEL) rather than drive a half-restarted one.
node "$SENTINEL_TOOL" remove --root "$REPO" 2>/dev/null || true

if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
else
  pids=$(ss -lptnH "sport = :${PORT}" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u)
  [ -n "${pids}" ] && kill ${pids} 2>/dev/null || true
fi
sleep 2

cd "$REPO" || exit 1

# Skia's web build fetches CanvasKit from a CDN by default, which is blocked
# here. Serve it ourselves. Derived from node_modules, so it is gitignored and
# regenerated rather than committed (it is ~8MB).
if [ ! -f public/canvaskit.wasm ]; then
  mkdir -p public
  cp node_modules/canvaskit-wasm/bin/full/canvaskit.wasm public/canvaskit.wasm
fi

export EXPO_NO_TELEMETRY=1
# --clear wipes the Metro bundler cache on every start.
#
# Without it, restarting the server is NOT enough to pick up a source change:
# Metro keeps its transform cache across restarts, so a capture taken right
# after a merge can silently photograph the PREVIOUS build. That happened --
# a brace-strain fix was verified green in vitest while the browser capture
# still showed the old frame keys, and the screenshots looked like the fix had
# failed. Slower start, but a capture that cannot lie about which code it ran.
nohup npx expo start --web --port "$PORT" --offline --clear > "$LOG" 2>&1 &
disown

for _ in $(seq 1 90); do
  if curl -s -o /dev/null --noproxy '*' "http://localhost:${PORT}" 2>/dev/null; then
    # The sentinel is written AFTER the server answers, so its existence also
    # means the server actually came up — and the process tree is stable by
    # now, so the recorded cmdline is the one a later check will re-read.
    # Prefer the pid actually LISTENING on the port over $! (npx may sit a
    # level above the server); fall back to $! if ss cannot say.
    SERVER_PID=""
    if command -v ss >/dev/null 2>&1; then
      SERVER_PID=$(ss -lptnH "sport = :${PORT}" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u | head -1)
    fi
    [ -z "${SERVER_PID}" ] && SERVER_PID=$!
    if node "$SENTINEL_TOOL" write --root "$REPO" --pid "$SERVER_PID" --port "$PORT" --log "$LOG"; then
      echo "SERVER UP on ${PORT} (sentinel: pid ${SERVER_PID})"
    else
      # The server IS up, but every browser tool will refuse it (NO_SENTINEL).
      # Said here, loudly, so the later refusal never reads as a mystery.
      echo "SERVER UP on ${PORT} — BUT THE SENTINEL WRITE FAILED (see error above)."
      echo "Browser tools will refuse this server. Re-run tools/dev-web.sh."
    fi
    exit 0
  fi
  sleep 2
done
echo "SERVER FAILED TO START"
tail -20 "$LOG"
exit 1
