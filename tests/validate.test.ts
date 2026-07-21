import assert from "node:assert/strict";
import test from "node:test";
import { validateCompileInput } from "../src/proofpack/validate.ts";
import type { AnchorRule, ClaimKind, ClaimRule, CompileInput } from "../src/proofpack/types.ts";

const validInput: CompileInput = {
  manifest: {
    schemaVersion: "proofpack.packet/v1",
    packetId: "project-alder-aw-214",
    title: "Project Alder · Reception Desk AW-214",
    publicAlias: "Synthetic millwork release packet",
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

function makeAnchor(overrides: Partial<AnchorRule> = {}): AnchorRule {
  return {
    id: "field-check-anchor",
    sourceId: "field-check",
    selector: { kind: "json", pointer: "/dimensions/status", equals: "VERIFIED" },
    effect: "SUPPORT",
    strength: "DIRECT",
    safety: "PUBLIC",
    ...overrides,
  };
}

function makeClaim(overrides: Partial<ClaimRule> = {}): ClaimRule {
  const id = overrides.id ?? "field-dimensions-current";
  return {
    id,
    title: "Current field dimensions are verified",
    publicTitle: "Current field dimensions are verified",
    kind: "direct",
    critical: false,
    anchors: [makeAnchor({ id: `${id}-anchor` })],
    nextAction: "Use the verified field dimensions.",
    publicNextAction: "Use the verified field dimensions.",
    publicEligibleWhenVerified: true,
    ...overrides,
  };
}

function withClaims(...claims: ClaimRule[]): CompileInput {
  const input = structuredClone(validInput);
  input.rules.claims = claims;
  return input;
}

function assertDiagnostic(input: unknown, code: string, path: string): void {
  const result = validateCompileInput(input);
  assert.equal(result.ok, false, `expected ${code} at ${path}`);
  assert.ok(
    result.diagnostics.some((item) => item.code === code && item.path === path),
    `missing ${code} at ${path}: ${JSON.stringify(result.diagnostics)}`,
  );
}

function assertDiagnosticPaths(input: unknown, code: string, paths: string[]): void {
  const result = validateCompileInput(input);
  assert.equal(result.ok, false, `expected ${code}`);
  assert.deepEqual(
    result.diagnostics.filter((item) => item.code === code).map((item) => item.path),
    paths,
  );
}

test("accepts the closed v1 packet contract", () => {
  assert.deepEqual(validateCompileInput(validInput), { ok: true, diagnostics: [] });
});

test("requires explicit public packet and next-action fields", () => {
  const missingAlias = structuredClone(validInput);
  delete (missingAlias.manifest as unknown as { publicAlias?: string }).publicAlias;
  assertDiagnostic(missingAlias, "PACKET_PUBLIC_ALIAS_REQUIRED", "$.manifest.publicAlias");

  const claim = makeClaim();
  const missingPublicAction = withClaims(claim) as CompileInput;
  delete (missingPublicAction.rules.claims[0] as Partial<ClaimRule>).publicNextAction;
  assertDiagnostic(
    missingPublicAction,
    "CLAIM_PUBLIC_NEXT_ACTION_REQUIRED",
    "$.rules.claims[0].publicNextAction",
  );
});

test("rejects a gate with no support or dependency verification route", () => {
  assertDiagnostic(
    withClaims(makeClaim({ kind: "gate", anchors: [] })),
    "GATE_VERIFICATION_ROUTE_REQUIRED",
    "$.rules.claims[0].anchors",
  );
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

const structuralRejections: Array<{
  name: string;
  build: () => unknown;
  code: string;
  path: string;
}> = [
  {
    name: "a non-object claim",
    build: () => withClaims(null as unknown as ClaimRule),
    code: "CLAIM_OBJECT_INVALID",
    path: "$.rules.claims[0]",
  },
  {
    name: "an unknown claim kind",
    build: () => withClaims(makeClaim({ kind: "score" as ClaimKind })),
    code: "CLAIM_KIND_UNKNOWN",
    path: "$.rules.claims[0].kind",
  },
  {
    name: "a non-object anchor",
    build: () => withClaims(makeClaim({ anchors: [null as unknown as AnchorRule] })),
    code: "ANCHOR_OBJECT_INVALID",
    path: "$.rules.claims[0].anchors[0]",
  },
  {
    name: "an unknown anchor effect",
    build: () => withClaims(makeClaim({ anchors: [makeAnchor({ effect: "WEIGH" as never })] })),
    code: "ANCHOR_EFFECT_UNKNOWN",
    path: "$.rules.claims[0].anchors[0].effect",
  },
  {
    name: "an unknown anchor strength",
    build: () => withClaims(makeClaim({ anchors: [makeAnchor({ strength: "HEARSAY" as never })] })),
    code: "ANCHOR_STRENGTH_UNKNOWN",
    path: "$.rules.claims[0].anchors[0].strength",
  },
  {
    name: "an unknown anchor safety label",
    build: () => withClaims(makeClaim({ anchors: [makeAnchor({ safety: "SECRET" as never })] })),
    code: "ANCHOR_SAFETY_UNKNOWN",
    path: "$.rules.claims[0].anchors[0].safety",
  },
  {
    name: "a non-object selector",
    build: () => withClaims(makeClaim({ anchors: [makeAnchor({ selector: null as never })] })),
    code: "SELECTOR_OBJECT_INVALID",
    path: "$.rules.claims[0].anchors[0].selector",
  },
  {
    name: "an unknown selector kind",
    build: () => withClaims(makeClaim({
      anchors: [makeAnchor({ selector: { kind: "regex", pattern: ".*" } as never })],
    })),
    code: "SELECTOR_KIND_UNKNOWN",
    path: "$.rules.claims[0].anchors[0].selector.kind",
  },
  {
    name: "a JSON selector without an operator",
    build: () => withClaims(makeClaim({
      anchors: [makeAnchor({ selector: { kind: "json", pointer: "/dimensions/status" } })],
    })),
    code: "SELECTOR_OPERATOR_REQUIRED",
    path: "$.rules.claims[0].anchors[0].selector",
  },
  {
    name: "a JSON selector with conflicting operators",
    build: () => withClaims(makeClaim({
      anchors: [makeAnchor({
        selector: {
          kind: "json",
          pointer: "/dimensions/status",
          equals: "VERIFIED",
          present: true,
        },
      })],
    })),
    code: "SELECTOR_OPERATOR_CONFLICT",
    path: "$.rules.claims[0].anchors[0].selector",
  },
  {
    name: "a non-scalar log selector field",
    build: () => withClaims(makeClaim({
      anchors: [makeAnchor({
        selector: { kind: "log", event: "traveler_ack", fields: { rev: 3 } as never },
      })],
    })),
    code: "SELECTOR_FIELD_VALUE_INVALID",
    path: "$.rules.claims[0].anchors[0].selector.fields.rev",
  },
];

for (const { name, build, code, path } of structuralRejections) {
  test(`rejects ${name}`, () => {
    assertDiagnostic(build(), code, path);
  });
}

const versionAndValueRejections: Array<{
  name: string;
  mutate: (input: CompileInput) => void;
  code: string;
  path: string;
}> = [
  {
    name: "an unknown packet schema version",
    mutate: (input) => { input.manifest.schemaVersion = "proofpack.packet/v2" as never; },
    code: "PACKET_SCHEMA_VERSION_UNKNOWN",
    path: "$.manifest.schemaVersion",
  },
  {
    name: "an unknown rules schema version",
    mutate: (input) => { input.rules.schemaVersion = "proofpack.rules/v2" as never; },
    code: "RULESET_SCHEMA_VERSION_UNKNOWN",
    path: "$.rules.schemaVersion",
  },
  {
    name: "an unknown engine version",
    mutate: (input) => { input.rules.engineVersion = "2.0.0"; },
    code: "ENGINE_VERSION_UNKNOWN",
    path: "$.rules.engineVersion",
  },
  {
    name: "an unsafe rules path",
    mutate: (input) => { input.manifest.rulesFile = "../release-rules.json"; },
    code: "PATH_UNSAFE",
    path: "$.manifest.rulesFile",
  },
  {
    name: "a malformed packet timestamp",
    mutate: (input) => { input.manifest.asOf = "2026-02-30T05:00:00.000Z"; },
    code: "TIMESTAMP_INVALID",
    path: "$.manifest.asOf",
  },
  {
    name: "a malformed source timestamp",
    mutate: (input) => {
      input.manifest.sources[0]!.capturedAt = "2026-07-21 03:40";
      input.sources[0]!.capturedAt = "2026-07-21 03:40";
    },
    code: "TIMESTAMP_INVALID",
    path: "$.manifest.sources[0].capturedAt",
  },
];

for (const { name, mutate, code, path } of versionAndValueRejections) {
  test(`rejects ${name}`, () => {
    const input = structuredClone(validInput);
    mutate(input);
    assertDiagnostic(input, code, path);
  });
}

test("rejects an invalid JSON pointer at its exact selector path", () => {
  const input = withClaims(makeClaim({
    anchors: [makeAnchor({
      selector: { kind: "json", pointer: "/dimensions/~2status", equals: "VERIFIED" },
    })],
  }));
  assertDiagnostic(input, "JSON_POINTER_INVALID", "$.rules.claims[0].anchors[0].selector.pointer");
});

test("rejects missing source and dependency references at exact paths", () => {
  const base = makeClaim({ id: "base" });
  const gate = makeClaim({
    id: "release-gate",
    kind: "gate",
    anchors: [makeAnchor({ id: "missing-source-anchor", sourceId: "missing-source" })],
    requiresVerified: ["missing-claim"],
  });
  const result = validateCompileInput(withClaims(base, gate));
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some((item) =>
    item.code === "ANCHOR_SOURCE_MISSING"
    && item.path === "$.rules.claims[1].anchors[0].sourceId"));
  assert.ok(result.diagnostics.some((item) =>
    item.code === "CLAIM_DEPENDENCY_MISSING"
    && item.path === "$.rules.claims[1].requiresVerified[0]"));
});

test("allows exclusive claims without an authority resolver", () => {
  const input = withClaims(makeClaim({ kind: "exclusive" }));
  assert.deepEqual(validateCompileInput(input), { ok: true, diagnostics: [] });
});

test("allows a local authority resolver only on an exclusive claim", () => {
  const exclusive = makeClaim({
    kind: "exclusive",
    authorityResolverAnchorId: "exclusive-anchor",
    anchors: [makeAnchor({ id: "exclusive-anchor", effect: "ASSERT_VALUE", value: "PL-18" })],
  });
  assert.deepEqual(validateCompileInput(withClaims(exclusive)), { ok: true, diagnostics: [] });
});

for (const kind of ["direct", "inference", "gate"] as const) {
  test(`rejects an authority resolver on a ${kind} claim`, () => {
    const id = `${kind}-claim`;
    const anchorId = `${id}-anchor`;
    const claim = makeClaim({
      id,
      kind,
      anchors: [makeAnchor({ id: anchorId })],
      authorityResolverAnchorId: anchorId,
    });
    assertDiagnostic(
      withClaims(claim),
      "CLAIM_AUTHORITY_RESOLVER_KIND_INVALID",
      "$.rules.claims[0].authorityResolverAnchorId",
    );
  });
}

test("rejects a non-local resolver on an exclusive claim", () => {
  const claim = makeClaim({ kind: "exclusive", authorityResolverAnchorId: "missing-anchor" });
  assertDiagnostic(
    withClaims(claim),
    "AUTHORITY_RESOLVER_MISSING",
    "$.rules.claims[0].authorityResolverAnchorId",
  );
});

test("accepts the RFC 6901 root JSON pointer", () => {
  const input = withClaims(makeClaim({
    anchors: [makeAnchor({ selector: { kind: "json", pointer: "", present: true } })],
  }));

  assert.deepEqual(validateCompileInput(input), { ok: true, diagnostics: [] });
});

for (const kind of ["direct", "exclusive"] as const) {
  test(`rejects requiresVerified on a ${kind} claim`, () => {
    const base = makeClaim({ id: "base" });
    const dependent = makeClaim({ id: "dependent", kind, requiresVerified: ["base"] });
    assertDiagnostic(
      withClaims(base, dependent),
      "CLAIM_DEPENDENCIES_KIND_INVALID",
      "$.rules.claims[1].requiresVerified",
    );
  });
}

for (const kind of ["inference", "gate"] as const) {
  test(`allows requiresVerified on a ${kind} claim`, () => {
    const base = makeClaim({ id: "base" });
    const dependent = makeClaim({ id: "dependent", kind, requiresVerified: ["base"] });
    assert.deepEqual(validateCompileInput(withClaims(base, dependent)), { ok: true, diagnostics: [] });
  });
}

test("rejects a dependency cycle at the original dependency path", () => {
  const alpha = makeClaim({ id: "alpha", kind: "inference", requiresVerified: ["beta"] });
  const beta = makeClaim({ id: "beta", kind: "gate", requiresVerified: ["alpha"] });
  assertDiagnostic(
    withClaims(alpha, beta),
    "RULE_DEPENDENCY_CYCLE",
    "$.rules.claims[1].requiresVerified[0]",
  );
});

test("rejects a restricted source anchor labeled public", () => {
  const input = structuredClone(validInput);
  input.manifest.sources[0]!.safety = "RESTRICTED";
  input.sources[0]!.safety = "RESTRICTED";
  input.rules.claims = [makeClaim()];
  assertDiagnostic(
    input,
    "ANCHOR_SAFETY_ESCALATION",
    "$.rules.claims[0].anchors[0].safety",
  );
});

test("preserves original manifest source indexes after an invalid item", () => {
  const input = structuredClone(validInput);
  const declaration = input.manifest.sources[0]!;
  input.manifest.sources = [
    null as unknown as typeof declaration,
    declaration,
    { ...declaration },
  ];
  assertDiagnosticPaths(input, "SOURCE_DUPLICATE_ID", ["$.manifest.sources[2].id"]);
});

test("preserves original hydrated source indexes after an invalid item", () => {
  const input = structuredClone(validInput);
  const source = input.sources[0]!;
  input.sources = [
    null as unknown as typeof source,
    source,
    { ...source },
  ];
  assertDiagnosticPaths(input, "SOURCE_DUPLICATE_ID", ["$.sources[2].id"]);
});

test("preserves original claim indexes after an invalid item", () => {
  const first = makeClaim({ id: "duplicate-claim" });
  const duplicate = makeClaim({ id: "duplicate-claim", anchors: [makeAnchor({ id: "unique-anchor" })] });
  const input = withClaims(null as unknown as ClaimRule, first, duplicate);
  assertDiagnosticPaths(input, "CLAIM_DUPLICATE_ID", ["$.rules.claims[2].id"]);
});

test("preserves original anchor indexes after an invalid item", () => {
  const anchor = makeAnchor({ id: "duplicate-anchor" });
  const claim = makeClaim({
    anchors: [null as unknown as AnchorRule, anchor, { ...anchor }],
  });
  assertDiagnosticPaths(withClaims(claim), "ANCHOR_DUPLICATE_ID", ["$.rules.claims[0].anchors[2].id"]);
});

test("preserves a later claim index in anchor reference diagnostics", () => {
  const later = makeClaim({ anchors: [makeAnchor({ sourceId: "missing-source" })] });
  const input = withClaims(null as unknown as ClaimRule, later);
  assertDiagnosticPaths(input, "ANCHOR_SOURCE_MISSING", ["$.rules.claims[1].anchors[0].sourceId"]);
});

test("does not accept required fields inherited through a prototype", () => {
  const input = structuredClone(validInput);
  const inherited = Object.create(input.manifest.sources[0]!) as (typeof input.manifest.sources)[number];
  input.manifest.sources = [inherited];
  assertDiagnostic(input, "SOURCE_OBJECT_INVALID", "$.manifest.sources[0]");
});
