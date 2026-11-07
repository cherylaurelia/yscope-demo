#!/usr/bin/env bash
# Unofficial workaround for clp-json v0.14.0/v0.14.1: put the MCP server's dependencies back on
# versions that work (fastmcp <4, pymysql <1.2.1) inside the running mcp-server container.
# Run on the CLP host after sbin/start-clp.sh. sbin/stop-clp.sh + start-clp.sh recreate the
# container from the image, so rerun this after every restart of the package.
set -euo pipefail
C=$(docker ps --format '{{.Names}}' | grep -- '-mcp-server-' | head -1)
[ -n "$C" ] || { echo "no running CLP mcp-server container" >&2; exit 1; }
SP=/opt/clp/lib/python3/site-packages
work=$(mktemp -d)
# Same Python minor version as the package image (3.10).
docker run --rm -v "$work:/out" python:3.10-slim sh -c \
  'pip install -q --disable-pip-version-check --root-user-action=ignore --target /out/site \
     "fastmcp>=2.14.4,<4" "pymysql>=1.1.2,<1.2.1" "aiomysql==0.3.2" && rm -rf /out/site/bin && chmod -R a+rwX /out'
# Remove the old copies (package dirs and every version's dist-info) before copying the new ones in.
names=$(ls "$work/site" | grep '\.dist-info$' | sed -E 's/-[0-9][^-]*\.dist-info$//' | tr 'A-Z-' 'a-z_' | sort -u)
docker exec -u 0 "$C" sh -c "cd $SP && for n in $(echo $names); do for d in *.dist-info; do \
  b=\$(echo \"\${d%%-[0-9]*}\" | tr 'A-Z-' 'a-z_'); [ \"\$b\" = \"\$n\" ] && rm -rf \"\$d\"; done; done; true"
for item in $(ls "$work/site" | grep -v '\.dist-info$'); do docker exec -u 0 "$C" rm -rf "$SP/$item"; done
docker cp "$work/site/." "$C:$SP/" >/dev/null
docker restart "$C" >/dev/null
docker exec "$C" sh -c "cd $SP && ls -d fastmcp-*.dist-info pymysql-*.dist-info"
rm -rf "$work" 2>/dev/null || true
