import { readFileSync } from "node:fs";
import { join } from "node:path";
import beforeJson from "@/data/run/before.json";
import patchedJson from "@/data/run/patched-1.json";
import pymysqlOnlyJson from "@/data/run/pymysql-only.json";
import { Run, describeCall, isFailure, shortResult } from "@/lib/runs";

const REPO = "https://github.com/cherylaurelia/yscope-demo";
const FIX = "https://github.com/y-scope/clp/compare/main...cherylaurelia:clp:fix/mcp-server-dep-bounds";
const ISSUE = `${REPO}/blob/main/ISSUE.md`;

const before = Run.parse(beforeJson);
const pymysqlOnly = Run.parse(pymysqlOnlyJson);
const patched = Run.parse(patchedJson);
const fixDiff = readFileSync(join(process.cwd(), "data/fix.diff"), "utf8");

const QUESTION =
  "In the PostgreSQL logs stored in CLP, how many events have error_severity NOTICE, and what do their messages say?";

const RELEASES = [
  { image: "0.13.0 (Jul 22)", pymysql: "1.2.0", fastmcp: "3.4.4", mcp: "1.28.1", works: true },
  { image: "0.14.0 (Oct 1)", pymysql: "1.2.3", fastmcp: "4.0.8", mcp: "2.2.0", works: false },
  { image: "0.14.1 (Oct 27)", pymysql: "1.2.3", fastmcp: "4.1.4", mcp: "2.3.0", works: false },
  { image: "uv.lock (clp-mcp-server)", pymysql: "1.1.2", fastmcp: "2.14.4", mcp: "1.26.0", works: true },
  { image: "fix branch, resolved without lock", pymysql: "1.2.0", fastmcp: "3.4.11", mcp: "1.30.0", works: true },
];

const WORKAROUND = `curl -fsSLO ${REPO.replace("github.com", "raw.githubusercontent.com")}/main/repro/workaround.sh
bash workaround.sh        # on the CLP host, after sbin/start-clp.sh`;

function firstParagraph(answer: string | null): string {
  if (answer === null) {
    return "(no answer)";
  }

  const paragraphs = answer
    .split("\n\n")
    .slice(0, 2)
    .filter((paragraph) => !paragraph.trimEnd().endsWith(":"))
    .join(" ");

  return paragraphs.replaceAll("**", "").replaceAll("`", "");
}

function RunCard({ title, tone, run }: { title: string; tone: "bad" | "good"; run: Run }) {
  const border = tone === "bad" ? "border-bad" : "border-good";
  const heading = tone === "bad" ? "bg-bad-bg text-bad" : "bg-good-bg text-good";

  return (
    <article className={`flex flex-col overflow-hidden rounded-lg border ${border}`}>
      <h3 className={`px-4 py-2 text-sm font-semibold ${heading}`}>{title}</h3>
      <ol className="flex flex-col gap-2 px-4 py-3 font-mono text-xs">
        {run.steps.map((step, index) => (
          <li key={`${run.run}-${index}`} className="break-words">
            <span className="text-azure-700">{describeCall(step)}</span>
            <br />
            <span className={isFailure(step.result) ? "text-bad" : "text-muted"}>→ {shortResult(step.result)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-auto border-t border-line px-4 py-3 text-sm leading-relaxed">
        <span className="font-semibold">Claude Code&apos;s answer: </span>
        {firstParagraph(run.answer)}
      </p>
    </article>
  );
}

export default function Page() {
  return (
    <>
      <header className="bg-deep text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3 text-sm">
          <span className="font-semibold">
            CLP <span className="text-azure">MCP server</span> · v0.14.x
          </span>
          <span className="text-white/70">Unofficial demo</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-14 px-5 py-10">
        <section className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Every MCP search fails in the clp-json v0.14.0 and v0.14.1 packages.
          </h1>
          <p className="max-w-3xl text-lg leading-relaxed text-muted">
            The package build installs PyMySQL 1.2.3 and FastMCP 4, not the versions in uv.lock. With two dependency bounds in
            clp-mcp-server, Claude Code finds the 4 NOTICE events in your postgresql dataset again.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <a className="rounded-md bg-azure-600 px-4 py-2 font-medium text-white hover:bg-azure-700" href={FIX}>
              View the fix branch
            </a>
            <a className="rounded-md border border-azure-600 px-4 py-2 font-medium text-azure-700 hover:bg-azure-50" href={ISSUE}>
              Bug report, ready to file
            </a>
            <a className="rounded-md border border-line px-4 py-2 font-medium text-text hover:bg-azure-50" href={REPO}>
              Demo repo
            </a>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-ink">Same question, same package, same data</h2>
          <p className="leading-relaxed text-muted">
            Claude Code {"2.1.319"} connected to the MCP server of the released clp-json v0.14.1 package (MCP enabled per your MCP
            guide), with your public <a className="text-azure-700 underline" href="https://zenodo.org/records/10516402">postgresql dataset</a>{" "}
            compressed in. The prompt: “{QUESTION}” The raw log has exactly 4 NOTICE lines.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <RunCard title="Before: v0.14.1 as shipped" tone="bad" run={before} />
            <RunCard title="After: same container, fix-branch dependencies" tone="good" run={patched} />
          </div>
          <p className="text-sm text-muted">
            The tool results are cut to one line here; the full recorded runs are in{" "}
            <a className="text-azure-700 underline" href={`${REPO}/tree/main/data/run`}>data/run</a>.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-ink">Why it broke: two dependencies floated past the lock</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-line p-4">
              <h3 className="font-semibold text-ink">1. PyMySQL 1.2.3 vs aiomysql 0.3.2</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                <code className="font-mono">ClpConnector.submit_query</code> inserts the msgpack job config (bytes). aiomysql escapes
                bytes with PyMySQL&apos;s <code className="font-mono">escape_bytes_prefixed</code>, which is now a placeholder string, so
                every search raises <code className="font-mono">&apos;str&apos; object is not callable</code>. PyMySQL 1.2.2 makes the
                container crash on import; 1.2.0 works. Upstream:{" "}
                <a className="text-azure-700 underline" href="https://github.com/aio-libs/aiomysql/issues/1080">aiomysql#1080</a>, open.
              </p>
            </div>
            <div className="rounded-lg border border-line p-4">
              <h3 className="font-semibold text-ink">2. FastMCP 4 session IDs</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                On the 2026-07-28 MCP protocol, FastMCP 4 gives every request a new <code className="font-mono">ctx.session_id</code>. The
                server keys the <code className="font-mono">get_instructions</code> gate and paging on it. With only PyMySQL fixed, Claude
                Code got “{shortResult(pymysqlOnly.steps.at(-1)?.result, 70)}” on every search. A curl client on protocol 2025-06-18 keeps
                its session, so manual tests can pass.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-azure-50 text-ink">
                <tr>
                  <th className="px-3 py-2 font-semibold">Package image / source</th>
                  <th className="px-3 py-2 font-semibold">pymysql</th>
                  <th className="px-3 py-2 font-semibold">fastmcp</th>
                  <th className="px-3 py-2 font-semibold">mcp</th>
                  <th className="px-3 py-2 font-semibold">MCP search</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {RELEASES.map((row) => (
                  <tr key={row.image} className="border-t border-line">
                    <td className="px-3 py-2 font-sans text-sm">{row.image}</td>
                    <td className="px-3 py-2">{row.pymysql}</td>
                    <td className="px-3 py-2">{row.fastmcp}</td>
                    <td className="px-3 py-2">{row.mcp}</td>
                    <td className={`px-3 py-2 font-sans text-sm ${row.works ? "text-good" : "text-bad"}`}>
                      {row.works ? "works" : "fails"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="leading-relaxed text-muted">
            The cause is one step in <code className="font-mono">taskfile.yaml</code>:{" "}
            <code className="font-mono">pip3 install --upgrade &lt;component wheels&gt; -t …</code> runs without the uv.lock files, so
            the image gets whatever was newest on build day. Unit tests run against the lock, so CI stays green. In the v0.14.1 image, 57
            of the 118 locked clp-mcp-server dependencies and 33 of the 60 for each other Python component differ from their lock (e.g.
            mysql-connector-python 9.6.0 → 26.10.0). Those don&apos;t break anything that I saw. Compression worked.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-ink">The fix: bound two dependencies</h2>
          <p className="leading-relaxed text-muted">
            A stopgap that works with the build as it is today. The fix branch also refreshes the two lock files that reference
            clp-mcp-server (4 lines each, relocked with uv 0.9.0 so nothing else moves).
          </p>
          <pre className="overflow-x-auto rounded-lg bg-ink p-4 font-mono text-xs leading-relaxed text-white">
            {fixDiff.split("\n").slice(4).join("\n")}
          </pre>
          <ul className="list-disc space-y-1 pl-5 leading-relaxed text-muted">
            <li>
              Built the clp-mcp-server wheel from the branch and installed it like the taskfile does (
              <code className="font-mono">pip3 install --upgrade</code>, no lock, Python 3.10). Resolved: fastmcp 3.4.11, mcp 1.30.0,
              pymysql 1.2.0.
            </li>
            <li>
              With those on the v0.14.1 MCP container, Claude Code answered correctly in 2 of 2 runs, and{" "}
              <code className="font-mono">get_nth_page</code> returned page 2 in a separate run.
            </li>
            <li>
              <code className="font-mono">uv lock --check</code> passes for all six locked projects. The <code className="font-mono">clp-uv-checks</code>{" "}
              workflow (macOS 15, Ubuntu 22.04 and 24.04) passes on the fork.
            </li>
            <li>
              Longer term: install the package libs with the locks as constraints, and key the instructions gate on something other than{" "}
              <code className="font-mono">ctx.session_id</code> before moving to FastMCP 4.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold text-ink">Workaround for v0.14.1 users today</h2>
          <p className="leading-relaxed text-muted">
            Swaps the MCP container&apos;s dependencies to the fix branch&apos;s ranges (takes about 20 s). Rerun it after every{" "}
            <code className="font-mono">stop-clp.sh</code> / <code className="font-mono">start-clp.sh</code>, because those recreate the
            container from the image.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-ink p-4 font-mono text-xs leading-relaxed text-white">{WORKAROUND}</pre>
          <p className="leading-relaxed text-muted">
            Check: <code className="font-mono">repro/mcp-search.sh search_by_kql &apos;{"{"}&quot;kql_query&quot;:&quot;*&quot;{"}"}&apos;</code>{" "}
            returns <code className="font-mono">items</code> instead of an error. Tested on a fresh v0.14.1 package: Claude Code then
            answered the NOTICE question correctly.
          </p>
        </section>

        <section className="flex flex-col gap-2 rounded-lg bg-azure-50 p-5 text-sm leading-relaxed text-muted">
          <h2 className="text-base font-semibold text-ink">How this was tested</h2>
          <p>
            clp-json v0.14.1 release tarball, Docker Compose, Ubuntu 24.04 VM (aarch64), telemetry off. Data: the postgresql dataset from
            your docs (392.84 MB → 10.06 MB, 39.07x). Dependency versions came from each image&apos;s dist-info folders. The “after” runs
            change only the MCP container&apos;s Python dependencies, not CLP&apos;s code. I didn&apos;t rebuild the full package or test
            Claude Desktop, Cursor or VS Code.
          </p>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-5xl px-5 py-6 text-sm text-muted">
          Unofficial demo by Cheryl Aurelia: not affiliated with YScope. CLP is YScope&apos;s open-source project.
        </div>
      </footer>
    </>
  );
}
