#!/usr/bin/env bash
set -euo pipefail

SECRET="${JWT_SECRET:-change-me}"
SUB="${1:-user@example.com}"
EXP_MIN="${2:-60}"

base64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }

HEADER='{"alg":"HS256","typ":"JWT"}'
NOW=$(date +%s)
EXP=$((NOW + EXP_MIN * 60))

PAYLOAD=$(printf '{"sub":"%s","iat":%d,"exp":%d}' "$SUB" "$NOW" "$EXP")

HEADER_B64=$(printf '%s' "$HEADER" | base64url)
PAYLOAD_B64=$(printf '%s' "$PAYLOAD" | base64url)

SIGNATURE=$(printf '%s' "$HEADER_B64.$PAYLOAD_B64" \
  | openssl dgst -binary -sha256 -hmac "$SECRET" \
  | base64url)

printf '%s.%s.%s\n' "$HEADER_B64" "$PAYLOAD_B64" "$SIGNATURE"