#!/bin/sh
set -eu

: "${API_KEYS:?API_KEYS is required (comma-separated list of allowed bearer tokens)}"
: "${MCP_HOST:=aws-s3-mcp.railway.internal}"
: "${MCP_PORT:=3000}"
: "${PORT:=80}"

# Validate each key. Keys are interpolated into an nginx map regex, so we
# restrict to characters that cannot break out of an alternation group.
# Allowed: A-Z a-z 0-9 . _ ~ + / = -   (covers base64, base64url, hex, UUID)
# "." and "+" are still regex metacharacters and get escaped below.
echo "$API_KEYS" | tr ',' '\n' | while IFS= read -r key; do
  [ -z "$key" ] && continue
  case "$key" in
    *[!A-Za-z0-9._~+/=-]*)
      echo "gateway: API_KEYS contains an invalid character; allowed: A-Z a-z 0-9 . _ ~ + / = -" >&2
      exit 1
      ;;
  esac
done

# Escape "." and "+" so a key like "abc.def" only matches itself, not "abcXdef".
# Nothing else in the allowed charset is special inside a PCRE group.
API_KEY_PATTERN=$(echo "$API_KEYS" | tr ',' '\n' | sed '/^$/d' | sed 's/[.+]/\\&/g' | paste -sd '|' -)
if [ -z "$API_KEY_PATTERN" ]; then
  echo "gateway: API_KEYS must contain at least one non-empty key" >&2
  exit 1
fi
export API_KEY_PATTERN

# Railway private DNS (*.railway.internal) is IPv6-only; pick up the container's
# nameserver from resolv.conf so nginx can resolve it. IPv6 addresses must be
# wrapped in brackets for the nginx resolver directive (otherwise `:10` in
# `fd12::10` is parsed as a port).
RESOLVER=$(awk '/^nameserver/ {print $2; exit}' /etc/resolv.conf)
: "${RESOLVER:=127.0.0.11}"
case "$RESOLVER" in
  *:*) RESOLVER="[$RESOLVER]" ;;
esac
export RESOLVER

export MCP_HOST MCP_PORT PORT

envsubst '${API_KEY_PATTERN} ${RESOLVER} ${MCP_HOST} ${MCP_PORT} ${PORT}' \
  < /etc/nginx/nginx.conf.template \
  > /etc/nginx/nginx.conf
