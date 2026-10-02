#!/usr/bin/env bash
# Check the DNS records for the new domain and test both IP families.
set -uo pipefail

echo "=== DoH: A record ==="
curl -s -m 10 "https://dns.google/resolve?name=omiroute.firmspace.eu&type=A" | head -c 500
echo
echo "=== DoH: AAAA record ==="
curl -s -m 10 "https://dns.google/resolve?name=omiroute.firmspace.eu&type=AAAA" | head -c 400
echo
echo "=== local resolver cache ==="
dscacheutil -q host -a name omiroute.firmspace.eu 2>/dev/null | head -10
echo "(end local resolver)"
echo "=== IPv4 only ==="
curl -4 -sS -o /dev/null -w 'code=%{http_code} ip=%{remote_ip}\n' -m 15 https://omiroute.firmspace.eu/login
echo "=== IPv6 only ==="
curl -6 -sS -o /dev/null -w 'code=%{http_code} ip=%{remote_ip}\n' -m 15 https://omiroute.firmspace.eu/login
