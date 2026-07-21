# ProofPack Release Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and ship a judge-ready, synthetic-only commercial-millwork handoff compiler that runs locally without credentials, exposes exact evidence/rule traces, supports deterministic replay, and exports verified operator and shareable Markdown artifacts.

**Architecture:** A pure TypeScript core accepts packet values and source text, validates a finite ruleset, resolves exact anchors, classifies claims, derives the release handoff, constructs a typed shareable projection, and generates canonical SHA-256 receipts. A single-route React UI and a filesystem CLI are thin adapters over that same core; neither duplicates classification logic.

**Tech Stack:** Node.js 24, npm, TypeScript 5.9, React 19, Next.js 16-compatible App Router through vinext/Vite, Node test runner through `tsx`, Web Crypto SHA-256, plain CSS, OpenAI Sites hosting.

## Global Constraints

- Runtime is fully local and deterministic: no OpenAI API key, model call, analytics, external font, CDN asset, or outbound network request.
- Every repository fixture, screenshot, example, and export is fictional and synthetic; no client files, names, drawings, email, paths, identifiers, screenshots, or proprietary shop data.
- Product has one route, one ruleset, and one polished synthetic scenario: Northstar Millworks Lab / Project Alder / Reception Desk AW-214.
- The core performs no filesystem, DOM, wall-clock, randomness, locale-sensitive formatting, or network access.
- The finite rule grammar permits exact text-line anchors, predeclared log events, JSON Pointer equality/presence, named inference premises, exclusive values with an authority resolver, and hard-gate dependencies only.
- Claim statuses are exactly `VERIFIED`, `INFERRED`, `NEEDS_CONFIRMATION`, `CONFLICTED`, and `BLOCKED`; operational decisions are exactly `READY` and `HOLD`.
- `VERIFIED` means verified against the supplied packet and ruleset version, never universal truth or source authenticity.
- The shareable Markdown is rendered from a separately constructed typed allowlist projection; it is never produced by scrubbing internal Markdown.
- The receipt is called a reproducibility/integrity receipt, never a signature or tamper-proof provenance proof.
- Application code cannot import test golden outputs, and fixture inputs cannot contain status, handoff, receipt, or other precomputed output fields.
- Status uses visible text in addition to color, the interface works at phone and desktop widths, and all controls have keyboard-accessible labels.
- The project must expose `npm run demo` and a complete `npm run verify` gate.
- README and demo must document material GPT-5.6 Sol and Codex build contributions and reserve a clear placeholder instruction for the entrant to add the primary `/feedback` Session ID before submission.

---

## File Structure

### Core and adapters

- `src/proofpack/types.ts` — closed domain types and public interfaces.
- `src/proofpack/canonical.ts` — text normalization, stable sorting/serialization, IDs, and SHA-256.
- `src/proofpack/validate.ts` — fail-fast packet/rules/source validation and stable diagnostics.
- `src/proofpack/extract.ts` — exact line, log-event, and JSON Pointer anchor resolution.
- `src/proofpack/classify.ts` — status algebra for direct, inference, exclusive-value, and gate rules.
- `src/proofpack/handoff.ts` — deterministic `READY`/`HOLD`, done/not-done, next-action, and stop-condition derivation.
- `src/proofpack/safety.ts` — safety-lineage propagation and typed shareable projection.
- `src/proofpack/receipt.ts` — canonical stage digests and replay verification.
- `src/proofpack/diff.ts` — causal result diff by stable IDs.
- `src/proofpack/compile.ts` — the single orchestration entry point.
- `src/proofpack/index.ts` — stable public exports.
- `src/proofpack/demo-bundle.ts` — web-only raw `?raw` imports for the bundled fixture.
- `types/raw-imports.d.ts` — Vite raw-import declarations.
- `scripts/proofpack-demo.ts` — filesystem CLI over the shared core.
- `scripts/privacy-scan.mjs` — repository and artifact sentinel/private-path scanner.

### Product

- `app/page.tsx` — metadata-free server shell rendering the client product.
- `app/ProofPackApp.tsx` — state, compile/replay/reset, selected claim, decision record, copy/download.
- `app/components/SourcePanel.tsx` — packet/source list, raw excerpt, replay editor.
- `app/components/LedgerPanel.tsx` — claim rows, statuses, evidence/rule trace, causal diff.
- `app/components/HandoffPanel.tsx` — operational decision, done/not-done, next action, gates, exports.
- `app/layout.tsx` — local system-font layout metadata.
- `app/globals.css` — complete responsive stock-paper visual system.
- `public/favicon.svg` — original simple ProofPack mark.
- `public/og.png` — generated only after finished UI copy/palette are stable and image validation passes.

### Synthetic packet

- `fixtures/project-alder/packet.json`
- `fixtures/project-alder/release-rules.json`
- `fixtures/project-alder/handoff-draft.md`
- `fixtures/project-alder/finish-schedule.md`
- `fixtures/project-alder/rfi-042.json`
- `fixtures/project-alder/shop-notes.log`
- `fixtures/project-alder/field-check.json`
- `fixtures/project-alder/sample-register.json`
- `fixtures/project-alder/incoming-receipts.log`

### Tests and submission artifacts

- `tests/validate.test.ts`
- `tests/classify.test.ts`
- `tests/compile.test.ts`
- `tests/safety.test.ts`
- `tests/receipt-diff.test.ts`
- `tests/cli.test.ts`
- `tests/no-network.test.ts`
- `tests/rendered-html.test.mjs`
- `docs/DEMO_SCRIPT.md`
- `docs/SUBMISSION_COPY.md`
- `docs/BUILD_PROVENANCE.md`
- `README.md`
- `LICENSE`

---

### Task 1: Clean Starter, Define Contract, and Add Synthetic Packet

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Delete: `app/_sites-preview/SkeletonPreview.tsx`
- Delete: `app/_sites-preview/preview.css`
- Delete: `app/chatgpt-auth.ts`
- Delete: `db/index.ts`
- Delete: `db/schema.ts`
- Delete: `drizzle.config.ts`
- Delete: `drizzle/meta/_journal.json`
- Delete: `examples/d1/app/api/notes/route.ts`
- Delete: `examples/d1/db/schema.ts`
- Delete: `public/file.svg`
- Delete: `public/globe.svg`
- Delete: `public/window.svg`
- Create: `src/proofpack/types.ts`
- Create: `src/proofpack/validate.ts`
- Create: `src/proofpack/index.ts`
- Create: `types/raw-imports.d.ts`
- Create: all files under `fixtures/project-alder/`
- Create: `tests/validate.test.ts`

**Interfaces:**
- Produces: `CompileInput`, `PacketManifest`, `RuleSet`, `SourceDocument`, `ClaimRule`, `Diagnostic`, `validateCompileInput(input): ValidationResult`.
- No task may add fields outside these closed interfaces without updating the validator and its rejection tests.

- [ ] **Step 1: Make the cross-platform test runner available and remove unused starter dependencies**

Run:

```powershell
npm uninstall drizzle-orm drizzle-kit react-loading-skeleton
npm install --save-dev tsx
```

Set package identity and scripts to:

```json
{
  "name": "proofpack-release-gate",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vinext dev",
    "build": "vinext build",
    "start": "vinext start",
    "lint": "eslint . --ignore-pattern dist --ignore-pattern .next --ignore-pattern .vinext",
    "typecheck": "tsc --noEmit",
    "test": "tsx --test tests/*.test.ts && node --test tests/*.test.mjs",
    "demo": "tsx scripts/proofpack-demo.ts fixtures/project-alder/packet.json",
    "privacy:scan": "node scripts/privacy-scan.mjs",
    "verify": "npm run lint && npm run typecheck && npm run test && npm run build && npm run demo && npm run privacy:scan"
  }
}
```

Preserve the starter's pinned framework/tool versions and `engines.node`. Remove unused starter files listed above, then run `npm install --package-lock-only`.

- [ ] **Step 2: Write failing closed-schema tests**

Create `tests/validate.test.ts` with real packet objects and these assertions:

```ts
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
```

- [ ] **Step 3: Run validation tests and observe the expected failure**

Run:

```powershell
npx tsx --test tests/validate.test.ts
```

Expected: FAIL because `src/proofpack/validate.ts` and its contract do not exist.

- [ ] **Step 4: Implement the closed contract and deterministic diagnostics**

Define the exact enums and interfaces in `types.ts`:

```ts
export type ClaimStatus = "VERIFIED" | "INFERRED" | "NEEDS_CONFIRMATION" | "CONFLICTED" | "BLOCKED";
export type OperationalDecision = "READY" | "HOLD";
export type SafetyLabel = "PUBLIC" | "RESTRICTED";
export type EvidenceStrength = "DIRECT" | "CORROBORATING" | "CONTEXT";
export type EvidenceEffect = "SUPPORT" | "CONTRADICT" | "BLOCK" | "ASSERT_VALUE";
export type ClaimKind = "direct" | "inference" | "exclusive" | "gate";

export type Selector =
  | { kind: "line"; contains: string }
  | { kind: "log"; event: string; fields: Record<string, string | boolean> }
  | { kind: "json"; pointer: string; equals?: string | number | boolean; present?: true };

export interface AnchorRule {
  id: string;
  sourceId: string;
  selector: Selector;
  effect: EvidenceEffect;
  strength: EvidenceStrength;
  value?: string;
  safety: SafetyLabel;
}

export interface ClaimRule {
  id: string;
  title: string;
  publicTitle: string;
  kind: ClaimKind;
  critical: boolean;
  anchors: AnchorRule[];
  requiresVerified?: string[];
  authorityResolverAnchorId?: string;
  nextAction: string;
  stopCondition?: string;
  publicEligibleWhenVerified: boolean;
}

export interface CompileInput {
  manifest: PacketManifest;
  rules: RuleSet;
  sources: SourceDocument[];
}

export interface Diagnostic {
  code: string;
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; diagnostics: [] }
  | { ok: false; diagnostics: Diagnostic[] };
```

Implement a recursive allowlist validator that returns sorted diagnostics and rejects unknown fields, unknown versions/enums/operators, duplicate IDs, missing source/rule references, unsafe relative paths, malformed timestamps, invalid JSON pointers, rule dependency cycles, missing safety labels, and status/output fields.

- [ ] **Step 5: Create the complete synthetic packet**

Write all fixture files from the approved design. `packet.json` contains only metadata and source declarations. `release-rules.json` contains five claims and exact anchors; it contains no expected statuses or output text. Use fictional aliases only.

The authority resolver for the finish-coordination exclusive claim is the `traveler_ack` event in `incoming-receipts.log`; when absent, active PL-17 and PL-18 values conflict. The fabrication-release gate directly blocks on `sample-register.json` status `PENDING` and requires the field, RFI-incorporation, and finish-coordination claims to be verified.

- [ ] **Step 6: Run tests and full baseline checks**

Run:

```powershell
npx tsx --test tests/validate.test.ts
npm run typecheck
npm run lint
```

Expected: all commands exit 0 with three validation tests passing.

- [ ] **Step 7: Commit**

```powershell
git add package.json package-lock.json .gitignore src types fixtures tests app public db drizzle.config.ts drizzle examples
git commit -m "feat: define ProofPack packet contract and synthetic fixture"
```

---

### Task 2: Build the Pure Evidence Compiler

**Files:**
- Create: `src/proofpack/canonical.ts`
- Create: `src/proofpack/extract.ts`
- Create: `src/proofpack/classify.ts`
- Create: `src/proofpack/handoff.ts`
- Create: `src/proofpack/compile.ts`
- Modify: `src/proofpack/types.ts`
- Modify: `src/proofpack/index.ts`
- Create: `tests/classify.test.ts`
- Create: `tests/compile.test.ts`
- Create: `tests/no-network.test.ts`

**Interfaces:**
- Consumes: `CompileInput`, `ClaimRule`, `AnchorRule`, `Diagnostic` from Task 1.
- Produces: `normalizeText(value): string`, `canonicalStringify(value): string`, `stableId(prefix, value): Promise<string>`, `resolveAnchors(input): Observation[]`, `classifyClaims(rules, observations): ClaimResult[]`, `deriveHandoff(claims): Handoff`, `compileProofPack(input): Promise<CompiledPack>`.

- [ ] **Step 1: Write the status truth-table and end-to-end failing tests**

`tests/classify.test.ts` must cover:

```ts
test.each([
  ["unopposed direct blocker", "BLOCKED"],
  ["mixed mutually exclusive values", "CONFLICTED"],
  ["contradiction-only non-gate evidence", "CONFLICTED"],
  ["complete direct predicates", "VERIFIED"],
  ["complete named inference premises", "INFERRED"],
  ["missing declared evidence", "NEEDS_CONFIRMATION"]
])("classifies %s as %s", async (fixtureName, expected) => {
  const input = statusFixture(fixtureName);
  const result = await compileProofPack(input);
  assert.equal(result.claims[0]?.status, expected);
});
```

`tests/compile.test.ts` must load Project Alder from disk and assert:

```ts
assert.equal(result.handoff.decision, "HOLD");
assert.deepEqual(result.claims.map(({ id, status }) => ({ id, status })), [
  { id: "fabrication-release", status: "BLOCKED" },
  { id: "field-dimensions-current", status: "VERIFIED" },
  { id: "finish-coordinated", status: "CONFLICTED" },
  { id: "rfi-incorporated", status: "NEEDS_CONFIRMATION" },
  { id: "traveler-current-finish", status: "INFERRED" }
]);
assert.match(result.handoff.summary, /^HOLD RELEASE\./);
assert.equal(result.observations.every((item) => item.locator.length > 0), true);
```

Add normalization tests for shuffled source order, CRLF/LF, Unicode NFC/NFD, and timezone/locale process changes.

- [ ] **Step 2: Run the focused tests and observe the expected failure**

```powershell
npx tsx --test tests/classify.test.ts tests/compile.test.ts tests/no-network.test.ts
```

Expected: FAIL because compiler functions do not exist.

- [ ] **Step 3: Implement canonicalization and exact anchor resolution**

Canonicalization must recursively sort object keys, sort semantically unordered arrays by stable `id`, normalize text to NFC with LF line endings, and encode JSON without locale-sensitive operations.

Anchor resolution returns:

```ts
export interface Observation {
  id: string;
  claimId: string;
  anchorId: string;
  sourceId: string;
  sourceFile: string;
  capturedAt: string;
  locator: string;
  excerpt: string;
  excerptDigest: string;
  effect: EvidenceEffect;
  strength: EvidenceStrength;
  safety: SafetyLabel;
  value?: string;
}
```

Line locators use one-based `line:N`; JSON locators use the declared pointer; log locators use `event:<event>@line:N`. Exact excerpts are re-derived from normalized source content before emission.

- [ ] **Step 4: Implement the four claim evaluators and handoff derivation**

Use separate small functions for direct, inference, exclusive, and gate claims. Apply the global precedence exactly. Exclusive claims remain conflicted when distinct values are active unless the declared authority resolver matches one of those values. Gate claims become blocked only for an unopposed direct blocker; dependency disagreement remains conflicted and unresolved dependencies keep the overall decision on hold.

Return claim results shaped as:

```ts
export interface ClaimResult {
  id: string;
  title: string;
  publicTitle: string;
  status: ClaimStatus;
  critical: boolean;
  reasonCodes: string[];
  ruleId: string;
  ruleVersion: string;
  evidenceIds: string[];
  missingPredicates: string[];
  nextAction: string;
  stopCondition?: string;
  publicEligible: boolean;
}
```

`deriveHandoff` sorts verified claims into `done`, all other claims into `notDone`, chooses the first unresolved critical claim in ruleset order for `nextAction`, unions active stop conditions, and emits `READY` only when every critical claim is verified.

- [ ] **Step 5: Prove core network independence**

In `tests/no-network.test.ts`, replace `globalThis.fetch`, `XMLHttpRequest`, `WebSocket`, and dynamic imports of Node `http`/`https` with throwing sentinels before compiling Project Alder. Assert compilation still succeeds and the core source tree contains none of `fetch(`, `XMLHttpRequest`, `WebSocket`, `node:http`, `node:https`, `Date.now`, `new Date(`, `Math.random`, or `crypto.randomUUID`.

- [ ] **Step 6: Run compiler tests and checks**

```powershell
npx tsx --test tests/classify.test.ts tests/compile.test.ts tests/no-network.test.ts
npm run typecheck
npm run lint
```

Expected: all focused tests and checks exit 0.

- [ ] **Step 7: Commit**

```powershell
git add src/proofpack tests
git commit -m "feat: compile evidence into deterministic release claims"
```

---

### Task 3: Add Safe Artifacts, Replay Receipts, Causal Diff, and CLI

**Files:**
- Create: `src/proofpack/safety.ts`
- Create: `src/proofpack/receipt.ts`
- Create: `src/proofpack/diff.ts`
- Modify: `src/proofpack/compile.ts`
- Modify: `src/proofpack/types.ts`
- Modify: `src/proofpack/index.ts`
- Create: `scripts/proofpack-demo.ts`
- Create: `scripts/privacy-scan.mjs`
- Create: `tests/safety.test.ts`
- Create: `tests/receipt-diff.test.ts`
- Create: `tests/cli.test.ts`

**Interfaces:**
- Consumes: `CompiledPack`, canonical serialization, Project Alder fixture.
- Produces: `buildShareableProjection(pack): ShareablePack`, `renderOperatorMarkdown(pack): string`, `renderShareableMarkdown(publicPack): string`, `buildReceipt(stages): Promise<Receipt>`, `verifyReceipt(input, receipt): Promise<boolean>`, `diffCompiledPacks(before, after): PackDiff`.

- [ ] **Step 1: Write failing safety, receipt, replay, and CLI tests**

Required assertions include:

```ts
test("rejects ambiguous safety lineage instead of scrubbing", async () => {
  const input = await loadProjectAlder();
  input.sources[0]!.safety = undefined as never;
  await assert.rejects(() => compileProofPack(input), /SOURCE_SAFETY_REQUIRED/);
});

test("never leaks restricted sentinels into shareable artifacts", async () => {
  const input = await loadProjectAlder();
  input.sources.push(restrictedSentinelSource("PROOFPACK_SECRET_SENTINEL"));
  const result = await compileProofPack(input);
  assert.doesNotMatch(result.artifacts.shareableMarkdown, /PROOFPACK_SECRET_SENTINEL/);
  assert.doesNotMatch(JSON.stringify(result.shareable), /PROOFPACK_SECRET_SENTINEL/);
});

test("replay changes only causal claims and reset restores the receipt", async () => {
  const beforeInput = await loadProjectAlder();
  const before = await compileProofPack(beforeInput);
  const afterInput = appendReceipt(beforeInput, "traveler_ack rfi=RFI-042 rev=C finish=PL-18 cut_started=false");
  const after = await compileProofPack(afterInput);
  const diff = diffCompiledPacks(before, after);
  assert.notEqual(after.receipt.inputDigest, before.receipt.inputDigest);
  assert.deepEqual(diff.changedClaimIds, ["finish-coordinated", "rfi-incorporated"]);
  assert.equal(after.claims.find((item) => item.id === "fabrication-release")?.status, "BLOCKED");
  const reset = await compileProofPack(beforeInput);
  assert.deepEqual(reset.receipt, before.receipt);
});
```

CLI tests spawn `npx tsx scripts/proofpack-demo.ts fixtures/project-alder/packet.json --json`, assert exit 0, parse JSON, and compare its ledger/shareable digest to direct core compilation.

- [ ] **Step 2: Run focused tests and observe the expected failure**

```powershell
npx tsx --test tests/safety.test.ts tests/receipt-diff.test.ts tests/cli.test.ts
```

Expected: FAIL because artifact, receipt, diff, and CLI functions do not exist.

- [ ] **Step 3: Implement typed internal and shareable projections**

Propagate the most restrictive safety label. Only claims with `publicEligibleWhenVerified: true`, a `VERIFIED` status, a public title, and entirely public evidence may enter `ShareablePack`. Render Markdown using trusted headings/templates and escaped values; reject raw HTML and source-provided links/images. Do not expose internal filenames, locators, IDs, hashes, excerpts, diagnostics, or restricted-derived counts.

The operator Markdown contains executive summary, done, not done, next action, stop conditions, evidence ledger, and receipt. The shareable Markdown contains only packet alias, allowlisted verified outcomes, public next-step language declared by the rule, and its own projection digest.

- [ ] **Step 4: Implement stage receipts and causal diff**

Use Web Crypto `crypto.subtle.digest("SHA-256", bytes)` over canonical UTF-8. The receipt shape is:

```ts
export interface Receipt {
  schemaVersion: "proofpack.receipt/v1";
  algorithm: "SHA-256";
  packetId: string;
  rulesetId: string;
  rulesetVersion: string;
  engineVersion: string;
  inputDigest: string;
  observationDigest: string;
  ledgerDigest: string;
  handoffDigest: string;
  shareableDigest: string;
}
```

Diff by stable IDs and canonical fragments. Emit sorted `addedObservationIds`, `removedObservationIds`, `changedClaimIds`, `unchangedClaimIds`, `changedHandoffFields`, and before/after receipt digests.

- [ ] **Step 5: Implement the CLI and privacy scanner**

CLI behavior:

```text
proofpack-demo <packet.json> [--json] [--out <directory>] [--verify-receipt <receipt.json>]
```

It reads declared files beneath the packet directory only, rejects traversal, compiles once, writes all requested files only after success, and uses exit codes `0`, `2`, `3`, and `70` from the design.

The privacy scanner inspects tracked text files and generated sample artifacts for Windows user-profile absolute paths, email addresses outside fictional `.example` values, obvious secret assignments, forbidden real-project terms from the private handoff, and `PROOFPACK_SECRET_SENTINEL`. It prints stable findings and exits nonzero on any match.

- [ ] **Step 6: Run focused and cumulative verification**

```powershell
npx tsx --test tests/safety.test.ts tests/receipt-diff.test.ts tests/cli.test.ts
npx tsx --test tests/*.test.ts
npm run demo
npm run privacy:scan
npm run typecheck
npm run lint
```

Expected: all commands exit 0; demo prints `HOLD`, five statuses, and the receipt.

- [ ] **Step 7: Commit**

```powershell
git add src/proofpack scripts tests package.json package-lock.json
git commit -m "feat: add reproducible handoff artifacts and CLI"
```

---

### Task 4: Build the Single-Screen Release Gate Experience

**Files:**
- Create: `src/proofpack/demo-bundle.ts`
- Create: `app/ProofPackApp.tsx`
- Create: `app/components/SourcePanel.tsx`
- Create: `app/components/LedgerPanel.tsx`
- Create: `app/components/HandoffPanel.tsx`
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`
- Replace: `app/globals.css`
- Modify: `public/favicon.svg`
- Replace: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `compileProofPack`, `diffCompiledPacks`, fixture raw imports, `CompiledPack`, `PackDiff`.
- Produces: accessible compile/replay/reset/inspect/decision/export interactions without classification logic in React components.

- [ ] **Step 1: Write a failing rendered-product contract test**

Build the app and parse its server-rendered `/` HTML. Assert it contains:

```js
assert.match(html, /ProofPack Release Gate/);
assert.match(html, /No source, no claim/);
assert.match(html, /Release packet/);
assert.match(html, /Evidence ledger/);
assert.match(html, /Fabrication handoff/);
assert.doesNotMatch(html, /Your site is taking shape|codex-preview|fonts\.googleapis/);
```

Also assert that compiled client assets contain none of `api.openai.com`, Google Fonts, analytics domains, or remote image URLs.

- [ ] **Step 2: Run the build/render test and observe the expected failure**

```powershell
npm run build
node --test tests/rendered-html.test.mjs
```

Expected: FAIL because the starter skeleton still renders.

- [ ] **Step 3: Bundle raw fixtures without fetch or precomputed output**

Use Vite raw imports only in `demo-bundle.ts`:

```ts
import packetText from "../../fixtures/project-alder/packet.json?raw";
import rulesText from "../../fixtures/project-alder/release-rules.json?raw";
import handoffDraft from "../../fixtures/project-alder/handoff-draft.md?raw";
// import each remaining raw source exactly once

export function createDemoInput(): CompileInput {
  const manifest = JSON.parse(packetText) as PacketManifest;
  const rules = JSON.parse(rulesText) as RuleSet;
  return { manifest, rules, sources: hydrateSources(manifest, rawByFile) };
}
```

No status, handoff, receipt, or expected artifact is imported.

- [ ] **Step 4: Implement the product components**

`ProofPackApp` owns only UI state: current raw input, selected source, selected claim, compiled result, baseline result, diff, compile error, and human decision. It compiles on first mount, recompiles after the explicit append action, resets from a fresh `createDemoInput()`, and clears previous errors only after a valid run.

The replay action appends the exact approved receipt line. The selected claim drives exact anchor highlighting. Copy/download uses the already-compiled artifact; no component reconstructs Markdown.

Panel requirements:

- Source panel: seven source buttons, selected raw content, explicit “Append synthetic Rev C receipt” and “Reset replay” controls.
- Ledger panel: all five claims with status text, reason code, evidence count, changed marker, selected rule version, exact locators/excerpts, and missing predicates.
- Handoff panel: `HOLD`/`READY`, summary, done/not-done, next action, stop conditions, short packet fingerprint, decision record, operator/shareable export previews, copy/download buttons.

- [ ] **Step 5: Implement the finished visual system and metadata**

Use CSS variables for stock paper, graphite, safety orange, and status colors. Use system font stacks only. Desktop uses a three-column grid; tablet collapses the handoff beneath packet/ledger; phone uses a single column with sticky decision summary. Provide `:focus-visible`, reduced-motion handling, minimum 44px touch targets, readable code wrapping, status text/icons, and print-safe contrast.

Remove every starter metadata marker and Google font import. Set title `ProofPack Release Gate` and description `A local deterministic handoff compiler for commercial millwork release decisions.`

- [ ] **Step 6: Run product verification**

```powershell
npm run build
node --test tests/rendered-html.test.mjs
npm run typecheck
npm run lint
npm run test
```

Expected: all commands exit 0 and no starter content or remote asset appears.

- [ ] **Step 7: Commit**

```powershell
git add app src/proofpack/demo-bundle.ts types public tests
git commit -m "feat: ship the ProofPack release gate experience"
```

---

### Task 5: Verify the Whole Story and Prepare Submission Artifacts

**Files:**
- Replace: `README.md`
- Create: `LICENSE`
- Create: `docs/BUILD_PROVENANCE.md`
- Create: `docs/DEMO_SCRIPT.md`
- Create: `docs/SUBMISSION_COPY.md`
- Optionally create after validated generation: `public/og.png`
- Modify: `app/layout.tsx` only if a validated social card is available.

**Interfaces:**
- Consumes: the verified product, official submission requirements, actual commit/test evidence, and this primary Codex thread.
- Produces: one-command judge path, honest build provenance, exact three-minute narration, ready-to-personalize Devpost copy, hosted demo, and final verification record.

- [ ] **Step 1: Write repository documentation from verified facts**

README sections, in order:

1. Product promise and screenshot/demo link placeholder.
2. `npm ci && npm run demo` CLI quickstart.
3. `npm ci && npm run dev` web quickstart.
4. Three-minute judge path.
5. Synthetic-data and no-client-data guarantee.
6. What “verified” and the receipt do and do not mean.
7. Architecture and bounded rule grammar.
8. Status semantics.
9. Test and verification commands.
10. How GPT-5.6 Sol and Codex materially contributed, tied to actual tasks/commits.
11. Human decisions retained by the entrant.
12. Limitations and exclusions.
13. `/feedback` instruction with a conspicuous value the entrant must replace before submission.
14. MIT license.

`BUILD_PROVENANCE.md` records dated brainstorming, design, test-first task/review flow, Sol specialist roles, actual commits, and actual verification outputs without claiming a model wrote or decided anything it did not.

- [ ] **Step 2: Write the exact demo and submission copy**

`DEMO_SCRIPT.md` is timed to 2:55, includes screen actions and voiceover, covers what was built and specific Codex/GPT-5.6 contributions, and uses the approved closing line.

`SUBMISSION_COPY.md` contains:

- project name;
- elevator pitch under 200 characters;
- track;
- problem;
- what it does;
- how it works;
- how Codex and GPT-5.6 were used;
- challenges;
- accomplishments;
- lessons;
- what is next;
- repository, hosted demo, YouTube, and `/feedback` placeholders clearly labeled for the entrant.

The copy must avoid invented ROI, “tamper-proof,” universal truth, automatic privacy, client history, or unsupported security claims. It should be rewritten in the entrant’s own voice before submission, consistent with organizer guidance.

- [ ] **Step 3: Generate and validate one social card only after the UI is stable**

Use the image-generation workflow once for a 1200×630 landscape card with the finished stock-paper/graphite/safety-orange system, exact product name, one synthetic source-to-ledger-to-handoff motif, and no logos or real project imagery. Inspect all text. Retry at most once if unusable. If it passes, save as `public/og.png` and add absolute-host Open Graph/X metadata; otherwise omit the image metadata.

- [ ] **Step 4: Run full fresh verification**

From a clean working tree after `npm ci`:

```powershell
npm run verify
git diff --check
git status --short
```

Then use the in-app browser for one end-to-end flow:

1. Load the product and confirm baseline `HOLD` plus all five statuses.
2. Select the finish conflict and confirm exact anchors/rule trace.
3. Append the synthetic receipt and confirm only causal claims change.
4. Confirm sample approval keeps release blocked.
5. Reset and confirm the original fingerprint returns.
6. Record `HOLD` and confirm evidence statuses do not change.
7. Copy/download operator and shareable Markdown.
8. Confirm phone-width layout and keyboard focus order.
9. Confirm the browser makes no non-local requests.

- [ ] **Step 5: Host the validated static product and update links**

Use the Sites hosting workflow. Do not add hosted secrets, storage, auth, analytics, or server capabilities. Re-run `npm run verify` after any metadata/link update.

- [ ] **Step 6: Request broad final review and repair all Critical/Important findings**

The reviewer checks the entire design spec, this plan, all code, tests, README claims, synthetic/privacy boundaries, official submission requirements, demo feasibility, and clean judge path. One fix agent addresses the complete findings list, followed by a fresh whole-suite verification.

- [ ] **Step 7: Commit the submission package**

```powershell
git add README.md LICENSE docs app public package.json package-lock.json
git commit -m "docs: prepare ProofPack Build Week submission"
```

- [ ] **Step 8: Final entrant handoff**

Provide the exact repository path, hosted URL, verification evidence, demo recording steps, remaining Devpost fields, and instructions to run `/feedback` in this primary thread and paste the resulting Session ID into README/Devpost before the 5:00 PM Pacific deadline. Do not claim the submission itself is complete until the public YouTube URL, repository URL/access, `/feedback` ID, and Devpost submit confirmation are present.
