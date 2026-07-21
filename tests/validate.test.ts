import assert from "node:assert/strict";
import test from "node:test";
import { validateCompileInput } from "../src/proofpack/validate.ts";
import type { CompileInput } from "../src/proofpack/types.ts";

const validInput: CompileInput = {
  manifest: {
    schemaVersion: "proofpack.packet/v1",
    packetId: "project-alder-aw-214",
    title: "Project Alder · Reception Desk AW-214",
    asOf: "2026-07-21T05:00:00.000Z",
    rulesFile: "release-rules.json",
    sources: [{
      id: "field-check",
      file: "field-check.json",
      mediaType: "application/json",
      capturedAt: "2026-07-21T03:40:00.000Z",
      safety: "PUBLIC"
    }]
  },
  rules: {
    schemaVersion: "proofpack.rules/v1",
    rulesetId: "millwork-release",
    rulesetVersion: "1.0.0",
    engineVersion: "1.0.0",
    claims: []
  },
  sources: [{
    id: "field-check",
    file: "field-check.json",
    mediaType: "application/json",
    capturedAt: "2026-07-21T03:40:00.000Z",
    safety: "PUBLIC",
    content: "{\"dimensions\":{\"status\":\"VERIFIED\"}}"
  }]
};

test("accepts the closed v1 packet contract", () => {
  assert.deepEqual(validateCompileInput(validInput), { ok: true, diagnostics: [] });
});

test("rejects precomputed status fields in input", () => {
  const poisoned = structuredClone(validInput) as CompileInput & { status: string };
  poisoned.status = "VERIFIED";
  const result = validateCompileInput(poisoned);
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0]?.code, "PACKET_UNKNOWN_FIELD");
});

test("rejects missing safety labels and duplicate ids", () => {
  const invalid = structuredClone(validInput);
  invalid.manifest.sources.push({ ...invalid.manifest.sources[0]!, safety: undefined as never });
  const result = validateCompileInput(invalid);
  assert.equal(result.ok, false);
  assert.deepEqual(result.diagnostics.map((item) => item.code), [
    "SOURCE_DUPLICATE_ID",
    "SOURCE_SAFETY_REQUIRED"
  ]);
});
