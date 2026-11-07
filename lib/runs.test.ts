import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { Run, describeCall, isFailure, shortResult } from "./runs.ts";

test("describeCall formats the tool name and JSON arguments", () => {
  assert.equal(
    describeCall({ call: "search_by_kql", input: { kql_query: "error_severity: NOTICE" } }),
    'search_by_kql("error_severity: NOTICE")',
  );
  assert.equal(describeCall({ call: "get_instructions", input: {} }), "get_instructions()");
});

test("shortResult keeps the first line and caps its length", () => {
  assert.equal(shortResult("a\nb"), "a");
  assert.equal(shortResult("x".repeat(10), 5), "xxxx…");
  assert.equal(shortResult(undefined), "(no result)");
});

test("isFailure spots tool errors and the server's Error payload", () => {
  assert.equal(isFailure("Error calling tool 'search_by_kql': 'str' object is not callable"), true);
  assert.equal(isFailure('{"Error":"Please call `get_instructions()` first"}'), true);
  assert.equal(isFailure('{"items":["timestamp: 2023-03-27T04:26:51.011Z"]}'), false);
});

test("every recorded run parses and the shipped run never gets a search through", () => {
  const dir = new URL("../data/run/", import.meta.url);

  for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
    Run.parse(JSON.parse(readFileSync(new URL(file, dir), "utf8")));
  }

  const before = Run.parse(JSON.parse(readFileSync(new URL("before.json", dir), "utf8")));
  const searches = before.steps.filter((step) => step.call.startsWith("search"));
  assert.ok(searches.length > 0);
  assert.ok(searches.every((step) => isFailure(step.result)));
});
