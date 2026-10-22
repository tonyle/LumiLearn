#!/usr/bin/env bash
set -euo pipefail
ip=""
if [[ "$(uname -s)" == "Darwin" ]]; then
  interface="$(route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}' || true)"
  if [[ -n "$interface" ]]; then ip="$(ipconfig getifaddr "$interface" 2>/dev/null || true)"; fi
  if [[ -z "$ip" ]]; then
    for interface in $(networksetup -listallhardwareports 2>/dev/null | awk '/Device:/{print $2}'); do
      ip="$(ipconfig getifaddr "$interface" 2>/dev/null || true)"
      if [[ -n "$ip" ]]; then break; fi
    done
  fi
elif command -v ip >/dev/null 2>&1; then
  ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++)if($i=="src"){print $(i+1);exit}}' || true)"
else
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
fi
if [[ -z "$ip" ]]; then
  echo "Could not determine LAN IP. Connect the host to Wi-Fi and try again." >&2
  exit 1
fi
url="http://$ip:3000"
if [[ "${1:-}" == "--url" ]]; then
  echo "$url"
else
  echo "On an iPad connected to the same trusted Wi-Fi, open: $url"
  echo "Do not configure public router port forwarding."
fi
