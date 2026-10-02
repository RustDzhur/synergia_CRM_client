#!/usr/bin/env bash
# Ask an external service whether 92.208.2.202:443 is reachable over IPv4.
# The Mac sits inside the home LAN, so its own result cannot tell
# "no port-forwarding" apart from "no NAT loopback".
set -uo pipefail

echo "=== requesting external TCP check for 92.208.2.202:443 ==="
resp="$(curl -s -m 20 -H 'Accept: application/json' \
  'https://check-host.net/check-tcp?host=92.208.2.202:443&max_nodes=4')"
echo "$resp" | head -c 500
echo
rid="$(printf '%s' "$resp" | sed -n 's/.*"request_id":"\([^"]*\)".*/\1/p')"
echo "request_id=${rid:-NONE}"
[ -z "$rid" ] && exit 0

sleep 25
echo "=== result: open/closed per node ==="
curl -s -m 20 -H 'Accept: application/json' "https://check-host.net/check-result/${rid}" | head -c 1500
echo
