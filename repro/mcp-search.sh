#!/usr/bin/env bash
# usage: mcp.sh <tool> '<json args>'  -- one fresh MCP session per call (get_instructions first)
set -euo pipefail
U=http://localhost:8000/mcp
H=(-H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream')
SID=$(curl -s -D - -o /dev/null "${H[@]}" $U -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"0"}}}' | awk -F': ' 'tolower($1)=="mcp-session-id"{print $2}' | tr -d '\r')
curl -s "${H[@]}" -H "mcp-session-id: $SID" $U -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' >/dev/null
call(){ curl -s "${H[@]}" -H "mcp-session-id: $SID" $U -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"$1\",\"arguments\":$2}}" | sed -n 's/^data: //p'; }
call get_instructions '{}' >/dev/null
call "$1" "$2"
