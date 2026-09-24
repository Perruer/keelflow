#!/usr/bin/env bash
# Starts the built Keelflow server, waits until it answers, runs a test command, stops the server.
# Usage: PORT=3100 test/run-with-server.sh node test/auth-flow.mjs http://localhost:3100
# The server's environment (DATABASE_*, KEELFLOW_HOME, ...) is taken from the caller.
set -u
cd "$(dirname "$0")/.."

PORT="${PORT:-3000}"
LOG="${SERVER_LOG:-server-test.log}"
TIMEOUT="${SERVER_START_TIMEOUT:-900}"

node bin/run start > "$LOG" 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null; wait $SERVER_PID 2>/dev/null' EXIT

for ((i = 0; i < TIMEOUT; i += 2)); do
    if curl -fs "http://localhost:$PORT/api/v1/ping" > /dev/null 2>&1; then
        break
    fi
    if ! kill -0 $SERVER_PID 2>/dev/null; then
        echo "server exited during start-up:"
        tail -50 "$LOG"
        exit 1
    fi
    sleep 2
done
if ! curl -fs "http://localhost:$PORT/api/v1/ping" > /dev/null 2>&1; then
    echo "server did not answer within ${TIMEOUT}s:"
    tail -50 "$LOG"
    exit 1
fi

"$@"
status=$?
if [ $status -ne 0 ]; then
    echo "--- server log ---"
    tail -80 "$LOG"
fi
exit $status
