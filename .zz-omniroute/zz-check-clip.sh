#!/usr/bin/env bash
# Verify the clipboard holds exactly the OmniRoute dashboard password.
# Prints a verdict and lengths only — never the secret itself.
set -uo pipefail

local_val="$(pbpaste | tr -d '\r\n')"
remote_val="$(ssh server@10.50.0.1 'grep "^INITIAL_PASSWORD=" ~/omniroute/.env | cut -d= -f2-' | tr -d '\r\n')"

if [ -z "$local_val" ]; then
  echo "CLIPBOARD EMPTY — the copy did not land, re-run the pbcopy command"
elif [ "$local_val" = "$remote_val" ]; then
  echo "MATCH — clipboard holds exactly the right password (${#local_val} chars). Paste with Cmd+V."
else
  echo "DIFFERS — clipboard has ${#local_val} chars, the server has ${#remote_val}. Re-run the pbcopy command."
fi
