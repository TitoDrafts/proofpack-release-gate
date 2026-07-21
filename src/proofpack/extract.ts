import {
  canonicalStringifyPreservingArrayOrder,
  normalizeText,
  normalizeTimestamp,
  sha256Hex,
  stableId,
} from "./canonical.ts";
import {
  CompileError,
  type AnchorRule,
  type ClaimRule,
  type CompileInput,
  type Diagnostic,
  type Observation,
  type SafetyLabel,
  type SourceDocument,
} from "./types.ts";

interface AnchorMatch {
  locator: string;
  excerpt: string;
}

interface JsonResolution {
  found: boolean;
  value?: unknown;
}

function diagnostic(code: string, path: string, message: string): Diagnostic {
  return { code, path, message };
}

function sourcePath(sourceId: string): string {
  return `$.sources[id=${sourceId}]`;
}

function anchorPath(claimId: string, anchorId: string): string {
  return `$.rules.claims[id=${claimId}].anchors[id=${anchorId}]`;
}

function effectiveSafety(source: SourceDocument, anchor: AnchorRule): SafetyLabel {
  return source.safety === "RESTRICTED" || anchor.safety === "RESTRICTED" ? "RESTRICTED" : "PUBLIC";
}

function resolveJsonPointer(value: unknown, pointer: string): JsonResolution {
  if (pointer === "") {
    return { found: true, value };
  }
  let current = value;
  for (const encodedToken of pointer.slice(1).split("/")) {
    const token = encodedToken.replace(/~1/gu, "/").replace(/~0/gu, "~");
    if (Array.isArray(current)) {
      if (!/^(?:0|[1-9]\d*)$/u.test(token)) {
        return { found: false };
      }
      const index = Number(token);
      if (!Number.isSafeInteger(index) || index >= current.length) {
        return { found: false };
      }
      current = current[index];
      continue;
    }
    if (typeof current !== "object" || current === null || !Object.prototype.hasOwnProperty.call(current, token)) {
      return { found: false };
    }
    current = (current as Record<string, unknown>)[token];
  }
  return { found: true, value: current };
}

function scalarEquals(actual: unknown, expected: string | number | boolean): boolean {
  if (typeof actual === "string" && typeof expected === "string") {
    return normalizeText(actual) === normalizeText(expected);
  }
  return actual === expected;
}

function resolveJsonAnchor(
  anchor: AnchorRule,
  parsed: unknown,
): AnchorMatch[] {
  if (anchor.selector.kind !== "json") {
    return [];
  }
  const resolution = resolveJsonPointer(parsed, normalizeText(anchor.selector.pointer));
  if (!resolution.found) {
    return [];
  }
  const matches = "present" in anchor.selector
    ? anchor.selector.present === true
    : "equals" in anchor.selector && scalarEquals(resolution.value, anchor.selector.equals as string | number | boolean);
  if (!matches) {
    return [];
  }
  return [{
    locator: normalizeText(anchor.selector.pointer),
    excerpt: canonicalStringifyPreservingArrayOrder(resolution.value),
  }];
}

function resolveLineAnchor(anchor: AnchorRule, content: string): AnchorMatch[] {
  if (anchor.selector.kind !== "line") {
    return [];
  }
  const needle = normalizeText(anchor.selector.contains);
  const matches: AnchorMatch[] = [];
  normalizeText(content).split("\n").forEach((line, index) => {
    if (line.includes(needle)) {
      matches.push({ locator: `line:${index + 1}`, excerpt: line });
    }
  });
  return matches;
}

function parseLogFields(
  line: string,
  claimId: string,
  anchorId: string,
  lineNumber: number,
  diagnostics: Diagnostic[],
): { event: string; fields: Map<string, string> } | undefined {
  const tokens = line.trim().split(/[\t ]+/u);
  const event = tokens.shift();
  if (event === undefined || event.length === 0) {
    return undefined;
  }
  const fields = new Map<string, string>();
  for (const token of tokens) {
    const separator = token.indexOf("=");
    if (separator <= 0) {
      diagnostics.push(diagnostic(
        "LOG_EVENT_INVALID",
        `${anchorPath(claimId, anchorId)}.selector@line:${lineNumber}`,
        "A candidate log event contains a malformed field token.",
      ));
      return undefined;
    }
    const key = normalizeText(token.slice(0, separator));
    if (fields.has(key)) {
      diagnostics.push(diagnostic(
        "LOG_EVENT_INVALID",
        `${anchorPath(claimId, anchorId)}.selector@line:${lineNumber}`,
        "A candidate log event repeats a field key.",
      ));
      return undefined;
    }
    fields.set(key, normalizeText(token.slice(separator + 1)));
  }
  return { event: normalizeText(event), fields };
}

function resolveLogAnchor(
  claim: ClaimRule,
  anchor: AnchorRule,
  content: string,
  diagnostics: Diagnostic[],
): AnchorMatch[] {
  if (anchor.selector.kind !== "log") {
    return [];
  }
  const selector = anchor.selector;
  const expectedEvent = normalizeText(selector.event);
  const matches: AnchorMatch[] = [];
  normalizeText(content).split("\n").forEach((line, index) => {
    if (line.trim().length === 0 || normalizeText(line.trim().split(/[\t ]/u, 1)[0] ?? "") !== expectedEvent) {
      return;
    }
    const parsed = parseLogFields(line, claim.id, anchor.id, index + 1, diagnostics);
    if (parsed === undefined) {
      return;
    }
    const fieldsMatch = Object.entries(selector.fields).every(([key, expected]) => {
      const actual = parsed.fields.get(normalizeText(key));
      const expectedText = typeof expected === "boolean" ? String(expected) : normalizeText(expected);
      return actual === expectedText;
    });
    if (fieldsMatch) {
      matches.push({
        locator: `event:${expectedEvent}@line:${index + 1}`,
        excerpt: line,
      });
    }
  });
  return matches;
}

function validateExtractorInvariants(claim: ClaimRule, diagnostics: Diagnostic[]): void {
  for (const anchor of claim.anchors) {
    if (anchor.effect === "ASSERT_VALUE" && anchor.value === undefined) {
      diagnostics.push(diagnostic(
        "ANCHOR_VALUE_REQUIRED",
        `${anchorPath(claim.id, anchor.id)}.value`,
        "An asserted value anchor must declare its stable value.",
      ));
    }
  }
  if (claim.authorityResolverAnchorId !== undefined) {
    const resolver = claim.anchors.find(({ id }) => id === claim.authorityResolverAnchorId);
    if (resolver !== undefined && (resolver.effect !== "ASSERT_VALUE" || resolver.strength !== "DIRECT" || resolver.value === undefined)) {
      diagnostics.push(diagnostic(
        "AUTHORITY_RESOLVER_INVALID",
        `$.rules.claims[id=${claim.id}].authorityResolverAnchorId`,
        "An authority resolver must be a direct asserted-value anchor with a declared value.",
      ));
    }
  }
}

function resolveMatches(
  claim: ClaimRule,
  anchor: AnchorRule,
  source: SourceDocument,
  parsedJson: Map<string, unknown>,
  diagnostics: Diagnostic[],
): AnchorMatch[] {
  const path = `${anchorPath(claim.id, anchor.id)}.selector`;
  if (anchor.selector.kind === "json") {
    if (source.mediaType !== "application/json") {
      diagnostics.push(diagnostic("SELECTOR_MEDIA_MISMATCH", path, "A JSON selector requires an application/json source."));
      return [];
    }
    if (!parsedJson.has(source.id)) {
      return [];
    }
    return resolveJsonAnchor(anchor, parsedJson.get(source.id));
  }
  if (anchor.selector.kind === "log") {
    if (source.mediaType !== "text/plain") {
      diagnostics.push(diagnostic("SELECTOR_MEDIA_MISMATCH", path, "A log selector requires a text/plain source."));
      return [];
    }
    return resolveLogAnchor(claim, anchor, source.content, diagnostics);
  }
  return resolveLineAnchor(anchor, source.content);
}

async function buildObservation(
  claim: ClaimRule,
  anchor: AnchorRule,
  source: SourceDocument,
  match: AnchorMatch,
): Promise<Observation> {
  const excerptDigest = await sha256Hex(match.excerpt);
  const material = {
    claimId: claim.id,
    anchorId: anchor.id,
    sourceId: source.id,
    sourceFile: normalizeText(source.file),
    capturedAt: normalizeTimestamp(source.capturedAt),
    locator: match.locator,
    excerpt: match.excerpt,
    excerptDigest,
    effect: anchor.effect,
    strength: anchor.strength,
    safety: effectiveSafety(source, anchor),
    ...(anchor.value === undefined ? {} : { value: normalizeText(anchor.value) }),
  };
  return {
    id: await stableId("observation", material),
    ...material,
  };
}

export async function resolveAnchors(input: CompileInput): Promise<Observation[]> {
  const diagnostics: Diagnostic[] = [];
  const sources = new Map(input.sources.map((source) => [source.id, source]));
  const parsedJson = new Map<string, unknown>();

  for (const source of input.sources) {
    if (source.mediaType !== "application/json") {
      continue;
    }
    try {
      parsedJson.set(source.id, JSON.parse(normalizeText(source.content)) as unknown);
    } catch {
      diagnostics.push(diagnostic(
        "SOURCE_JSON_INVALID",
        `${sourcePath(source.id)}.content`,
        "JSON source content is malformed.",
      ));
    }
  }

  const pending: Array<Promise<Observation>> = [];
  for (const claim of input.rules.claims) {
    validateExtractorInvariants(claim, diagnostics);
    for (const anchor of claim.anchors) {
      const source = sources.get(anchor.sourceId);
      if (source === undefined) {
        diagnostics.push(diagnostic(
          "ANCHOR_SOURCE_MISSING",
          `${anchorPath(claim.id, anchor.id)}.sourceId`,
          "Anchor source is unavailable during extraction.",
        ));
        continue;
      }
      const matches = resolveMatches(claim, anchor, source, parsedJson, diagnostics);
      if (matches.length > 1) {
        diagnostics.push(diagnostic(
          "ANCHOR_MATCH_AMBIGUOUS",
          `${anchorPath(claim.id, anchor.id)}.selector`,
          "An exact anchor selector resolved to more than one source location.",
        ));
        continue;
      }
      if (matches[0] !== undefined) {
        pending.push(buildObservation(claim, anchor, source, matches[0]));
      }
    }
  }

  if (diagnostics.length > 0) {
    throw new CompileError(diagnostics);
  }
  const observations = await Promise.all(pending);
  return observations.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}
