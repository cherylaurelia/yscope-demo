Title: MCP server: every search fails in the v0.14.0 and v0.14.1 packages (package build doesn't use uv.lock)

### Bug

In the released clp-json v0.14.1 package, every MCP search tool fails. `hello_world` and `get_instructions` still work:

```
search_by_kql("error_severity: NOTICE") -> Error calling tool 'search_by_kql': 'str' object is not callable
search_by_kql("*")                      -> same
search_by_kql_with_timestamp_range(...) -> same
```

The traceback ends in `aiomysql/connection.py:418 escape_bytes_prefixed(obj)`, which runs when `ClpConnector.submit_query` inserts the
msgpack job config. The image ships PyMySQL 1.2.3, where `escape_bytes_prefixed` is now a placeholder string
(PyMySQL/PyMySQL#1274). aiomysql 0.3.2 still imports it (aio-libs/aiomysql#1080, still open).
Tested on the same container: PyMySQL 1.2.0 and 1.1.2 work, 1.2.1 and 1.2.2 make the MCP container exit at import
(ImportError from aiomysql's `pymysql.converters` imports), and 1.2.3 fails every search.

With PyMySQL swapped back, a second break shows up with Claude Code as the client. Every search returns
"Please call `get_instructions()` first", even right after calling it. The image ships fastmcp 4.1.4. In fastmcp 4, a client on the
2026-07-28 protocol gets a new `ctx.session_id` on every request, so the session-keyed instructions gate and paging never carry over.
(A client on protocol 2025-06-18 keeps its session, so curl-style testing can look fine.)

Both come from the same place: `taskfile.yaml` installs the package's Python libs with `pip3 install --upgrade <wheels> -t ...`
without the uv.lock files, so unpinned deps resolve to the newest release on build day. `components/clp-mcp-server/uv.lock` pins
pymysql 1.1.2, fastmcp 2.14.4 and mcp 1.26.0. What actually ships:

| package image | pymysql | fastmcp | mcp | MCP search |
|---|---|---|---|---|
| 0.13.0 (07-22) | 1.2.0 | 3.4.4 | 1.28.1 | works |
| 0.14.0 (10-01) | 1.2.3 | 4.0.8 | 2.2.0 | fails |
| 0.14.1 (10-27) | 1.2.3 | 4.1.4 | 2.3.0 | fails |

The unit tests run against the lock, so CI stays green. Across the v0.14.1 image, 57 of the 118 locked clp-mcp-server deps and
33 of the 60 locked deps of each of the other components differ from their lock (e.g. mysql-connector-python 9.6.0 → 26.10.0).

Expected: MCP searches work in the released package.

Suggested fix: as a stopgap, bound `fastmcp>=2.14.4,<4` and add `pymysql>=1.1.2,<1.2.1` in clp-mcp-server's pyproject
(branch with the change and relocked uv.lock: https://github.com/cherylaurelia/clp/compare/main...fix/mcp-server-dep-bounds).
I built that wheel and installed it the way the taskfile does (no lock). It resolves to fastmcp 3.4.11, mcp 1.30.0 and pymysql 1.2.0,
and with those on the v0.14.1 MCP container, Claude Code's searches and `get_nth_page` work. Longer term, two options: install the
package libs with the locks as constraints, and key the instructions gate on something other than `ctx.session_id` before moving to fastmcp 4.

### CLP version

v0.14.1 (also v0.14.0). `main` uses the same taskfile step.

### Environment

clp-json v0.14.1 release tarball, Docker Compose, Ubuntu 24.04 VM (aarch64), Docker 29 / Compose v5.1.4. MCP server enabled per the
MCP server guide (`mcp_server: {host: localhost, port: 8000}`). Data: the postgresql dataset from the docs' datasets page.

### Reproduction steps

1. Download and extract `clp-json-v0.14.1.tar.gz`, add `mcp_server:\n  host: "localhost"\n  port: 8000` to `etc/clp-config.yaml`.
2. `sbin/start-clp.sh`, then `sbin/compress.sh --timestamp-key timestamp postgresql/postgresql.log`.
3. Connect any MCP client to `http://localhost:8000/mcp`, call `get_instructions`, then `search_by_kql` with `error_severity: NOTICE`.
4. You get `'str' object is not callable`; the docker logs of the mcp-server container show the aiomysql traceback.
5. Check `ls /opt/clp/lib/python3/site-packages | grep -i -E 'pymysql|fastmcp'` in the container: pymysql 1.2.3, fastmcp 4.1.4.
