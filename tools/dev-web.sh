#!/usr/bin/env bash
# Restart the Expo web dev server that the screenshot harness drives.
# Kills by listening port rather than by process-name match, because a
# pattern like "expo start" also matches the restarting shell itself.
set -u
REPO=/home/user/three-white-lights
LOG="${1:-/tmp/expo-web.log}"
PORT="${PORT:-8081}"

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
nohup npx expo start --web --port "$PORT" --offline > "$LOG" 2>&1 &
disown

for _ in $(seq 1 90); do
  if curl -s -o /dev/null --noproxy '*' "http://localhost:${PORT}" 2>/dev/null; then
    echo "SERVER UP on ${PORT}"
    exit 0
  fi
  sleep 2
done
echo "SERVER FAILED TO START"
tail -20 "$LOG"
exit 1
