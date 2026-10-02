#!/usr/bin/env bash
# Work out why IPv4:443 is unreachable even though the router forwards it.
set -uo pipefail

echo "=== this Mac: LAN IPv4 ==="
ifconfig 2>/dev/null | grep -E 'inet 192\.168\.|inet 10\.' | head -5
echo "(end)"

echo
echo "=== VM: IPv4 addresses + Caddy sockets ==="
ssh server@10.50.0.1 'ip -4 addr show | grep -E "inet " ; echo "--- listeners ---"; ss -lnt | grep -E ":80 |:443 "'

echo
echo "=== from Mac: VM LAN IPv4 direct ==="
curl -4 -sk --resolve omiroute.firmspace.eu:443:192.168.178.129 -o /dev/null \
  -w 'code=%{http_code}\n' -m 8 https://omiroute.firmspace.eu/login || echo "FAILED"

echo "=== from Mac: public IPv4 ==="
curl -4 -sS -o /dev/null -w 'code=%{http_code}\n' -m 10 https://omiroute.firmspace.eu/login || echo "FAILED"

echo
echo "=== VM: its own egress IPv4 (what the router sees) ==="
ssh server@10.50.0.1 'curl -4 -s --max-time 8 https://ifconfig.me; echo'
