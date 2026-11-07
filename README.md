# CLP's MCP server can't search in v0.14.x (unofficial demo)

Every MCP search tool (`search_by_kql`, `search_by_kql_with_timestamp_range`) fails in the released
clp-json v0.14.0 and v0.14.1 packages. The package build (`taskfile.yaml`) installs the Python
component wheels with `pip3 install --upgrade` and without their `uv.lock` files, so the image ships:

- PyMySQL 1.2.3: aiomysql 0.3.2 then fails every job insert with `'str' object is not callable`
  ([aio-libs/aiomysql#1080](https://github.com/aio-libs/aiomysql/issues/1080)).
- FastMCP 4: clients on the 2026-07-28 MCP protocol (Claude Code is one) get a new `ctx.session_id` per request, so the
  server's `get_instructions` gate never clears.

`components/clp-mcp-server/uv.lock` pins pymysql 1.1.2, fastmcp 2.14.4, mcp 1.26.0. v0.13.0 shipped
pymysql 1.2.0 / fastmcp 3.4.4 and works.

- Fix branch (2 dependency bounds + relocked uv.lock files):
  https://github.com/y-scope/clp/compare/main...cherylaurelia:clp:fix/mcp-server-dep-bounds
- Bug report in CLP's template: [ISSUE.md](ISSUE.md)
- Recorded Claude Code runs (sanitized, tool calls + answers): [data/run](data/run)
- Raw NOTICE lines from the dataset (ground truth, first 400 chars each): [data/run/truth-notice.txt](data/run/truth-notice.txt)
- `repro/mcp-search.sh <tool> '<json>'`: call one MCP tool over streamable HTTP with curl.
- `repro/workaround.sh`: swap the running mcp-server container's dependencies to working versions.

## Run the page

```
npm install
npm run dev     # http://localhost:3000
npm test        # parses the recorded runs, checks the helpers
```

Unofficial demo by Cheryl Aurelia: not affiliated with YScope.
