import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalStringify,
  compileProofPack,
  normalizeText,
  normalizeTimestamp,
  stableId,
} from "../src/proofpack/index.ts";
import type { CompileInput, Selector, SourceMediaType } from "../src/proofpack/types.ts";
import {
  loadProjectAlder,
  makeAnchor,
  makeClaim,
  makeCompileInput,
  makeSource,
} from "./proofpack-fixtures.ts";

test("compiles Project Alder into its required deterministic release handoff", async () => {
  const input = await loadProjectAlder();

  const result = await compileProofPack(input);

  assert.equal(result.handoff.decision, "HOLD");
  assert.deepEqual(result.claims.map(({ id, status }) => ({ id, status })), [
    { id: "fabrication-release", status: "BLOCKED" },
    { id: "field-dimensions-current", status: "VERIFIED" },
    { id: "finish-coordinated", status: "CONFLICTED" },
    { id: "rfi-incorporated", status: "NEEDS_CONFIRMATION" },
    { id: "traveler-current-finish", status: "INFERRED" },
  ]);
  assert.match(result.handoff.summary, /^HOLD RELEASE\./);
  assert.equal(result.handoff.nextAction, "Issue traveler Rev C citing RFI-042 and attach PL-18 sample approval.");
  assert.equal(result.observations.length, 7);
  assert.equal(result.observations.every((item) => item.locator.length > 0), true);
  assert.deepEqual(result.handoff.done, ["field-dimensions-current"]);
  assert.deepEqual(result.handoff.notDone, [
    "fabrication-release",
    "finish-coordinated",
    "rfi-incorporated",
    "traveler-current-finish",
  ]);
  assert.deepEqual(result.handoff.stopConditions, [
    "Do not issue a cut ticket.",
    "Do not release fabrication until the current traveler acknowledges RFI-042.",
    "Do not release fabrication while PL-17 and PL-18 remain active.",
  ]);
  assert.deepEqual(result.claims.map(({ id, reasonCodes, missingPredicates, publicEligible }) => ({
    id,
    reasonCodes,
    missingPredicates,
    publicEligible,
  })), [
    { id: "fabrication-release", reasonCodes: ["DIRECT_BLOCKER_ACTIVE"], missingPredicates: [], publicEligible: false },
    { id: "field-dimensions-current", reasonCodes: ["DIRECT_PREDICATES_COMPLETE"], missingPredicates: [], publicEligible: true },
    { id: "finish-coordinated", reasonCodes: ["EXCLUSIVE_VALUES_UNRESOLVED"], missingPredicates: ["finish-resolver-traveler-ack"], publicEligible: false },
    { id: "rfi-incorporated", reasonCodes: ["DECLARED_EVIDENCE_MISSING"], missingPredicates: ["rfi-042-traveler-ack"], publicEligible: false },
    { id: "traveler-current-finish", reasonCodes: ["INFERENCE_PREMISES_COMPLETE"], missingPredicates: [], publicEligible: false },
  ]);
  assert.equal(result.claims.every(({ ruleId, ruleVersion }) => ruleId === "millwork-release" && ruleVersion === "1.0.0"), true);
});

test("resolves exact line, JSON pointer, and log anchors from normalized source content", async () => {
  const result = await compileProofPack(await loadProjectAlder());
  const byAnchor = new Map(result.observations.map((item) => [item.anchorId, item]));

  assert.deepEqual(
    {
      locator: byAnchor.get("finish-schedule-pl17")?.locator,
      excerpt: byAnchor.get("finish-schedule-pl17")?.excerpt,
    },
    { locator: "line:8", excerpt: "Exposed faces: PL-17 Natural Oak" },
  );
  assert.deepEqual(
    {
      locator: byAnchor.get("field-dimensions-verified")?.locator,
      excerpt: byAnchor.get("field-dimensions-verified")?.excerpt,
    },
    { locator: "/dimensions/status", excerpt: "\"VERIFIED\"" },
  );
  assert.deepEqual(
    {
      locator: byAnchor.get("traveler-rev-b-pl17-active")?.locator,
      excerpt: byAnchor.get("traveler-rev-b-pl17-active")?.excerpt,
    },
    {
      locator: "event:traveler_state@line:1",
      excerpt: "traveler_state assembly=AW-214 rev=B finish=PL-17 active=true stock_staged=true rfi_ack=false",
    },
  );
  assert.equal([...byAnchor.values()].every(({ excerptDigest }) => /^[a-f0-9]{64}$/u.test(excerptDigest)), true);
  assert.equal([...byAnchor.values()].every(({ id }) => /^observation-[a-f0-9]{64}$/u.test(id)), true);
  assert.equal(
    byAnchor.get("field-dimensions-verified")?.excerptDigest,
    "c0ea28df48673d3a9957864d4ce5f3963522a14f280fd7d74a98489fdf837cd4",
  );
});

test("normalizes CRLF, lone CR, and Unicode to NFC", () => {
  assert.equal(normalizeText("Cafe\u0301\r\nsecond\rthird"), "Caf\u00e9\nsecond\nthird");
});

test("normalizes timestamp offsets across day, year, and leap-day boundaries", () => {
  assert.equal(normalizeTimestamp("2026-01-01T00:30:00.000+01:00"), "2025-12-31T23:30:00.000Z");
  assert.equal(normalizeTimestamp("2024-03-01T00:30:00.000+01:00"), "2024-02-29T23:30:00.000Z");
  assert.equal(normalizeTimestamp("2026-12-31T23:30:00.000-02:00"), "2027-01-01T01:30:00.000Z");
});

test("canonicalizes object keys and unordered id arrays without locale-sensitive sorting", () => {
  const value = {
    z: "Cafe\u0301\r\n",
    items: [
      { id: "z", value: 2 },
      { value: 1, id: "a" },
    ],
    a: true,
  };

  assert.equal(
    canonicalStringify(value),
    "{\"a\":true,\"items\":[{\"id\":\"a\",\"value\":1},{\"id\":\"z\",\"value\":2}],\"z\":\"Caf\u00e9\\n\"}",
  );
  assert.equal(canonicalStringify({ 2: "two", 10: "ten" }), "{\"10\":\"ten\",\"2\":\"two\"}");
  assert.equal(
    canonicalStringify({ requiresVerified: ["z-claim", "a-claim"] }),
    "{\"requiresVerified\":[\"a-claim\",\"z-claim\"]}",
  );
});

test("canonicalizes own prototype-shaped keys as data", () => {
  const value = JSON.parse("{\"__proto__\":{\"safe\":true},\"2\":\"two\"}") as unknown;

  assert.equal(canonicalStringify(value), "{\"2\":\"two\",\"__proto__\":{\"safe\":true}}");
});

test("creates stable Web Crypto ids from canonical values", async () => {
  const left = await stableId("example", { b: "Cafe\u0301\r\n", a: 1 });
  const right = await stableId("example", { a: 1, b: "Caf\u00e9\n" });

  assert.equal(left, right);
  assert.match(left, /^example-[a-f0-9]{64}$/u);
});

test("is byte-stable across repeated runs and shuffled source declarations", async () => {
  const input = await loadProjectAlder();
  const shuffled = structuredClone(input);
  shuffled.manifest.sources.reverse();
  shuffled.sources.reverse();

  const first = await compileProofPack(input);
  const repeated = await compileProofPack(input);
  const reordered = await compileProofPack(shuffled);

  assert.equal(canonicalStringify(first), canonicalStringify(repeated));
  assert.equal(canonicalStringify(first), canonicalStringify(reordered));
  assert.deepEqual(first.observations.map(({ id }) => id), [...first.observations.map(({ id }) => id)].sort());
  assert.deepEqual(first.claims.map(({ id }) => id), [...first.claims.map(({ id }) => id)].sort());
});

test("normalizes equivalent CRLF/LF and NFC/NFD evidence before hashing", async () => {
  const claim = makeClaim({
    anchors: [makeAnchor({ selector: { kind: "line", contains: "Caf\u00e9 approved" } })],
  });
  const nfc = makeCompileInput([claim], [makeSource("evidence", "Header\nCaf\u00e9 approved\n")]);
  const nfdCrlf = makeCompileInput(
    [structuredClone(claim)],
    [makeSource("evidence", "Header\r\nCafe\u0301 approved\r\n")],
  );

  const left = await compileProofPack(nfc);
  const right = await compileProofPack(nfdCrlf);

  assert.equal(canonicalStringify(left), canonicalStringify(right));
});

test("does not vary with process timezone or locale settings", async () => {
  const input = await loadProjectAlder();
  const original = { TZ: process.env.TZ, LANG: process.env.LANG, LC_ALL: process.env.LC_ALL };
  const originalLocaleCompare = String.prototype.localeCompare;
  try {
    String.prototype.localeCompare = () => {
      throw new Error("LOCALE_SENTINEL_CALLED");
    };
    process.env.TZ = "Pacific/Kiritimati";
    process.env.LANG = "tr_TR.UTF-8";
    process.env.LC_ALL = "tr_TR.UTF-8";
    const first = await compileProofPack(input);
    process.env.TZ = "America/Adak";
    process.env.LANG = "sv_SE.UTF-8";
    process.env.LC_ALL = "sv_SE.UTF-8";
    const second = await compileProofPack(input);
    assert.equal(canonicalStringify(first), canonicalStringify(second));
  } finally {
    String.prototype.localeCompare = originalLocaleCompare;
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});

test("normalizes equivalent explicit timestamp offsets without consulting the host timezone", async () => {
  const utc = await loadProjectAlder();
  const offset = structuredClone(utc);
  offset.manifest.asOf = "2026-07-21T07:00:00.000+02:00";
  for (const declaration of offset.manifest.sources) {
    const source = offset.sources.find(({ id }) => id === declaration.id);
    assert.ok(source);
    const hour = Number(declaration.capturedAt.slice(11, 13));
    const shifted = `${declaration.capturedAt.slice(0, 11)}${String(hour + 2).padStart(2, "0")}${declaration.capturedAt.slice(13, -1)}+02:00`;
    declaration.capturedAt = shifted;
    source.capturedAt = shifted;
  }

  const left = await compileProofPack(utc);
  const right = await compileProofPack(offset);

  assert.equal(canonicalStringify(left), canonicalStringify(right));
});

test("preserves ruleset order for handoff selection while sorting claim presentation", async () => {
  const zClaim = makeClaim({ id: "z-critical", nextAction: "Resolve Z first." });
  const aClaim = makeClaim({
    id: "a-critical",
    anchors: [makeAnchor({ id: "a-missing", selector: { kind: "line", contains: "ABSENT A" } })],
    nextAction: "Resolve A first.",
  });
  zClaim.anchors = [makeAnchor({ id: "z-missing", selector: { kind: "line", contains: "ABSENT Z" } })];
  const input = makeCompileInput([zClaim, aClaim]);

  const result = await compileProofPack(input);

  assert.deepEqual(result.claims.map(({ id }) => id), ["a-critical", "z-critical"]);
  assert.equal(result.handoff.nextAction, "Resolve Z first.");
});

test("keeps a blocked gate byte-stable when lower-precedence replay dependencies resolve", async () => {
  const input = await loadProjectAlder();
  const before = await compileProofPack(input);
  const replay = structuredClone(input);
  const receipts = replay.sources.find(({ id }) => id === "incoming-receipts");
  assert.ok(receipts);
  receipts.content = "traveler_ack rfi=RFI-042 rev=C finish=PL-18 cut_started=false\n";

  const after = await compileProofPack(replay);
  const beforeGate = before.claims.find(({ id }) => id === "fabrication-release");
  const afterGate = after.claims.find(({ id }) => id === "fabrication-release");

  assert.equal(canonicalStringify(afterGate), canonicalStringify(beforeGate));
  assert.equal(after.claims.find(({ id }) => id === "finish-coordinated")?.status, "VERIFIED");
  assert.equal(after.claims.find(({ id }) => id === "rfi-incorporated")?.status, "VERIFIED");
  assert.deepEqual(after.handoff.stopConditions, ["Do not issue a cut ticket."]);
});

test("returns READY only when every critical claim is directly verified", async () => {
  const result = await compileProofPack(makeCompileInput([
    makeClaim({ id: "z-verified", critical: true }),
    makeClaim({ id: "a-inferred", kind: "inference", critical: false, anchors: [makeAnchor({ strength: "CORROBORATING" })] }),
  ]));

  assert.equal(result.handoff.decision, "READY");
  assert.match(result.handoff.summary, /^READY FOR RELEASE\./);
  assert.equal(result.handoff.nextAction, "Proceed using the verified release packet.");
});

test("rejects malformed JSON atomically with stable source diagnostics", async () => {
  const input = makeCompileInput([makeClaim({
    anchors: [makeAnchor({ selector: { kind: "json", pointer: "/status", equals: "OK" } })],
  })], [makeSource("evidence", "{not-json", "application/json")]);

  await assert.rejects(
    () => compileProofPack(input),
    (error: unknown) => error instanceof Error
      && error.message.includes("SOURCE_JSON_INVALID")
      && error.message.includes("$.sources[id=evidence].content"),
  );
});

test("rejects extractor invariants atomically with stable anchor diagnostics", async () => {
  const input = makeCompileInput([makeClaim({
    kind: "exclusive",
    anchors: [makeAnchor({ effect: "ASSERT_VALUE" })],
  })]);

  await assert.rejects(
    () => compileProofPack(input),
    (error: unknown) => error instanceof Error
      && error.message.includes("ANCHOR_VALUE_REQUIRED")
      && error.message.includes("$.rules.claims[id=claim].anchors[id=evidence-anchor].value"),
  );
});

const incompatibleSelectorCases: ReadonlyArray<{
  name: string;
  selector: Selector;
  mediaType: SourceMediaType;
  content: string;
}> = [
  {
    name: "line selector on JSON",
    selector: { kind: "line", contains: "MATCH" },
    mediaType: "application/json",
    content: "{\"value\":\"MATCH\"}",
  },
  {
    name: "log selector on Markdown",
    selector: { kind: "log", event: "event", fields: { ready: true } },
    mediaType: "text/markdown",
    content: "event ready=true",
  },
  {
    name: "JSON selector on plain text",
    selector: { kind: "json", pointer: "/value", equals: "MATCH" },
    mediaType: "text/plain",
    content: "{\"value\":\"MATCH\"}",
  },
];

for (const { name, selector, mediaType, content } of incompatibleSelectorCases) {
  test(`rejects ${name} atomically`, async () => {
    const input = makeCompileInput([makeClaim({
      anchors: [makeAnchor({ selector })],
    })], [makeSource("evidence", content, mediaType)]);

    await assert.rejects(
      () => compileProofPack(input),
      (error: unknown) => error instanceof Error
        && error.message.includes("SELECTOR_MEDIA_MISMATCH")
        && error.message.includes("$.rules.claims[id=claim].anchors[id=evidence-anchor].selector"),
    );
  });
}

test("resolves escaped JSON pointers and presence without truthiness coercion", async () => {
  const input = makeCompileInput([makeClaim({
    anchors: [makeAnchor({
      selector: { kind: "json", pointer: "/a~1b/~0flag", present: true },
    })],
  })], [makeSource("evidence", "{\"a/b\":{\"~flag\":false}}", "application/json")]);

  const result = await compileProofPack(input);

  assert.equal(result.claims[0]?.status, "VERIFIED");
  assert.deepEqual(
    result.observations.map(({ locator, excerpt }) => ({ locator, excerpt })),
    [{ locator: "/a~1b/~0flag", excerpt: "false" }],
  );
});

test("resolves the RFC 6901 root JSON pointer", async () => {
  const input = makeCompileInput([makeClaim({
    anchors: [makeAnchor({
      selector: { kind: "json", pointer: "", present: true },
    })],
  })], [makeSource("evidence", "{\"status\":\"OK\"}", "application/json")]);

  const result = await compileProofPack(input);

  assert.equal(result.claims[0]?.status, "VERIFIED");
  assert.deepEqual(
    result.observations.map(({ locator, excerpt }) => ({ locator, excerpt })),
    [{ locator: "", excerpt: "{\"status\":\"OK\"}" }],
  );
});

test("preserves ordered JSON arrays in exact presence excerpts", async () => {
  const input = makeCompileInput([makeClaim({
    anchors: [makeAnchor({
      selector: { kind: "json", pointer: "/steps", present: true },
    })],
  })], [makeSource(
    "evidence",
    "{\"steps\":[{\"id\":\"b\",\"value\":\"second\",\"capturedAt\":\"2026-07-21T07:00:00.000+02:00\"},{\"id\":\"a\",\"value\":\"first\"}]}",
    "application/json",
  )]);

  const result = await compileProofPack(input);

  assert.equal(
    result.observations[0]?.excerpt,
    "[{\"capturedAt\":\"2026-07-21T07:00:00.000+02:00\",\"id\":\"b\",\"value\":\"second\"},{\"id\":\"a\",\"value\":\"first\"}]",
  );
});

test("matches log fields named capturedAt without rewriting their exact token", async () => {
  const capturedAt = "2026-07-21T07:00:00.000+02:00";
  const input = makeCompileInput([makeClaim({
    anchors: [makeAnchor({
      selector: { kind: "log", event: "event", fields: { capturedAt } },
    })],
  })], [makeSource("evidence", `event capturedAt=${capturedAt}`)]);

  const result = await compileProofPack(input);

  assert.equal(result.claims[0]?.status, "VERIFIED");
  assert.deepEqual(
    result.observations.map(({ locator, excerpt }) => ({ locator, excerpt })),
    [{ locator: "event:event@line:1", excerpt: `event capturedAt=${capturedAt}` }],
  );
});

test("resolves JSON array indices but never JavaScript array properties", async () => {
  const input = makeCompileInput([makeClaim({
    anchors: [
      makeAnchor({ id: "first-item", selector: { kind: "json", pointer: "/items/0", present: true } }),
      makeAnchor({ id: "array-length", selector: { kind: "json", pointer: "/items/length", present: true } }),
    ],
  })], [makeSource("evidence", "{\"items\":[false]}", "application/json")]);

  const result = await compileProofPack(input);

  assert.equal(result.claims[0]?.status, "NEEDS_CONFIRMATION");
  assert.deepEqual(
    result.observations.map(({ anchorId, locator, excerpt }) => ({ anchorId, locator, excerpt })),
    [{ anchorId: "first-item", locator: "/items/0", excerpt: "false" }],
  );
});

test("surfaces validation diagnostics through atomic compile errors", async () => {
  const input = await loadProjectAlder();
  input.sources[0]!.safety = undefined as never;

  await assert.rejects(() => compileProofPack(input), /SOURCE_SAFETY_REQUIRED/u);
});

test("rejects ambiguous exact selectors instead of choosing by incidental order", async () => {
  const input = makeCompileInput([makeClaim()], [makeSource("evidence", "MATCH\nMATCH")]);

  await assert.rejects(
    () => compileProofPack(input),
    (error: unknown) => error instanceof Error && error.message.includes("ANCHOR_MATCH_AMBIGUOUS"),
  );
});

test("treats a valid unmatched selector as missing evidence rather than a run error", async () => {
  const input = makeCompileInput([makeClaim({
    anchors: [makeAnchor({ selector: { kind: "line", contains: "ABSENT" } })],
  })]);

  const result = await compileProofPack(input);

  assert.equal(result.observations.length, 0);
  assert.equal(result.claims[0]?.status, "NEEDS_CONFIRMATION");
});

test("does not mutate compile inputs", async () => {
  const input = await loadProjectAlder();
  const before = structuredClone(input) as CompileInput;

  await compileProofPack(input);

  assert.deepEqual(input, before);
});
