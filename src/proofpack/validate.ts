import type {
  ClaimKind,
  Diagnostic,
  EvidenceEffect,
  EvidenceStrength,
  SafetyLabel,
  SourceMediaType,
  ValidationResult,
} from "./types.ts";

type UnknownRecord = Record<string, unknown>;

const claimKinds = new Set<ClaimKind>(["direct", "inference", "exclusive", "gate"]);
const effects = new Set<EvidenceEffect>(["SUPPORT", "CONTRADICT", "BLOCK", "ASSERT_VALUE"]);
const strengths = new Set<EvidenceStrength>(["DIRECT", "CORROBORATING", "CONTEXT"]);
const safetyLabels = new Set<SafetyLabel>(["PUBLIC", "RESTRICTED"]);
const mediaTypes = new Set<SourceMediaType>(["application/json", "text/markdown", "text/plain"]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function addDiagnostic(
  diagnostics: Diagnostic[],
  code: string,
  path: string,
  message: string,
): void {
  diagnostics.push({ code, path, message });
}

function checkObject(
  value: unknown,
  diagnostics: Diagnostic[],
  code: string,
  path: string,
): UnknownRecord | undefined {
  if (!isRecord(value)) {
    addDiagnostic(diagnostics, code, path, "Expected an object.");
    return undefined;
  }
  return value;
}

function rejectUnknownFields(
  value: UnknownRecord,
  allowed: readonly string[],
  diagnostics: Diagnostic[],
  code: string,
  path: string,
): void {
  const allowedFields = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedFields.has(key)) {
      addDiagnostic(diagnostics, code, `${path}.${key}`, "Field is not part of the closed v1 contract.");
    }
  }
}

function requiredString(
  value: UnknownRecord,
  key: string,
  diagnostics: Diagnostic[],
  code: string,
  path: string,
): string | undefined {
  const candidate = value[key];
  if (typeof candidate !== "string" || candidate.length === 0) {
    addDiagnostic(diagnostics, code, `${path}.${key}`, "A non-empty string is required.");
    return undefined;
  }
  return candidate;
}

function optionalString(
  value: UnknownRecord,
  key: string,
  diagnostics: Diagnostic[],
  code: string,
  path: string,
): string | undefined {
  if (!hasOwn(value, key)) {
    return undefined;
  }
  return requiredString(value, key, diagnostics, code, path);
}

function requiredBoolean(
  value: UnknownRecord,
  key: string,
  diagnostics: Diagnostic[],
  code: string,
  path: string,
): boolean | undefined {
  const candidate = value[key];
  if (typeof candidate !== "boolean") {
    addDiagnostic(diagnostics, code, `${path}.${key}`, "A boolean is required.");
    return undefined;
  }
  return candidate;
}

function requiredArray(
  value: UnknownRecord,
  key: string,
  diagnostics: Diagnostic[],
  code: string,
  path: string,
): unknown[] | undefined {
  const candidate = value[key];
  if (!Array.isArray(candidate)) {
    addDiagnostic(diagnostics, code, `${path}.${key}`, "An array is required.");
    return undefined;
  }
  return candidate;
}

function enumValue<T extends string>(
  value: UnknownRecord,
  key: string,
  allowed: ReadonlySet<T>,
  diagnostics: Diagnostic[],
  missingCode: string,
  unknownCode: string,
  path: string,
): T | undefined {
  if (!hasOwn(value, key) || value[key] === undefined || value[key] === null) {
    addDiagnostic(diagnostics, missingCode, `${path}.${key}`, "A recognized value is required.");
    return undefined;
  }
  const candidate = value[key];
  if (typeof candidate !== "string" || !allowed.has(candidate as T)) {
    addDiagnostic(diagnostics, unknownCode, `${path}.${key}`, "Value is not recognized by the v1 contract.");
    return undefined;
  }
  return candidate as T;
}

function isSafeRelativePath(value: string): boolean {
  if (
    value.startsWith("/")
    || value.startsWith("\\")
    || value.includes("\\")
    || value.includes(":")
    || value.includes("\0")
  ) {
    return false;
  }
  const parts = value.split("/");
  return parts.length > 0 && parts.every((part) => part.length > 0 && part !== "." && part !== "..");
}

function checkPath(value: string | undefined, diagnostics: Diagnostic[], path: string): void {
  if (value !== undefined && !isSafeRelativePath(value)) {
    addDiagnostic(diagnostics, "PATH_UNSAFE", path, "Path must be a safe relative path using forward slashes.");
  }
}

const timestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

function isValidTimestamp(value: string): boolean {
  const match = timestampPattern.exec(value);
  if (match === null) {
    return false;
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= (daysInMonth[month - 1] ?? 0);
}

function checkTimestamp(value: string | undefined, diagnostics: Diagnostic[], path: string): void {
  if (value !== undefined && !isValidTimestamp(value)) {
    addDiagnostic(diagnostics, "TIMESTAMP_INVALID", path, "Timestamp must be a valid RFC 3339 value with milliseconds.");
  }
}

function isValidJsonPointer(pointer: string): boolean {
  return (pointer === "" || pointer.startsWith("/"))
    && !/[\u0000-\u001f]/u.test(pointer)
    && !/~(?:[^01]|$)/u.test(pointer);
}

function validateSource(
  value: unknown,
  path: string,
  diagnostics: Diagnostic[],
  includeContent: boolean,
): UnknownRecord | undefined {
  const source = checkObject(value, diagnostics, "SOURCE_OBJECT_INVALID", path);
  if (source === undefined) {
    return undefined;
  }
  const allowed = includeContent
    ? ["id", "file", "mediaType", "capturedAt", "safety", "content"]
    : ["id", "file", "mediaType", "capturedAt", "safety"];
  rejectUnknownFields(source, allowed, diagnostics, "SOURCE_UNKNOWN_FIELD", path);
  requiredString(source, "id", diagnostics, "SOURCE_ID_REQUIRED", path);
  const file = requiredString(source, "file", diagnostics, "SOURCE_FILE_REQUIRED", path);
  checkPath(file, diagnostics, `${path}.file`);
  enumValue(
    source,
    "mediaType",
    mediaTypes,
    diagnostics,
    "SOURCE_MEDIA_TYPE_REQUIRED",
    "SOURCE_MEDIA_TYPE_UNKNOWN",
    path,
  );
  const capturedAt = requiredString(source, "capturedAt", diagnostics, "SOURCE_CAPTURED_AT_REQUIRED", path);
  checkTimestamp(capturedAt, diagnostics, `${path}.capturedAt`);
  enumValue(
    source,
    "safety",
    safetyLabels,
    diagnostics,
    "SOURCE_SAFETY_REQUIRED",
    "SOURCE_SAFETY_UNKNOWN",
    path,
  );
  if (includeContent && typeof source.content !== "string") {
    addDiagnostic(diagnostics, "SOURCE_CONTENT_REQUIRED", `${path}.content`, "Source content must be a string.");
  }
  return source;
}

function validateSelector(value: unknown, path: string, diagnostics: Diagnostic[]): void {
  const selector = checkObject(value, diagnostics, "SELECTOR_OBJECT_INVALID", path);
  if (selector === undefined) {
    return;
  }
  const kind = selector.kind;
  if (kind === "line") {
    rejectUnknownFields(selector, ["kind", "contains"], diagnostics, "SELECTOR_UNKNOWN_FIELD", path);
    requiredString(selector, "contains", diagnostics, "SELECTOR_CONTAINS_REQUIRED", path);
    return;
  }
  if (kind === "log") {
    rejectUnknownFields(selector, ["kind", "event", "fields"], diagnostics, "SELECTOR_UNKNOWN_FIELD", path);
    requiredString(selector, "event", diagnostics, "SELECTOR_EVENT_REQUIRED", path);
    const fields = checkObject(selector.fields, diagnostics, "SELECTOR_FIELDS_REQUIRED", `${path}.fields`);
    if (fields !== undefined) {
      for (const [field, expected] of Object.entries(fields)) {
        if (field.length === 0 || (typeof expected !== "string" && typeof expected !== "boolean")) {
          addDiagnostic(
            diagnostics,
            "SELECTOR_FIELD_VALUE_INVALID",
            `${path}.fields.${field}`,
            "Log selector values must be strings or booleans.",
          );
        }
      }
    }
    return;
  }
  if (kind === "json") {
    rejectUnknownFields(selector, ["kind", "pointer", "equals", "present"], diagnostics, "SELECTOR_UNKNOWN_FIELD", path);
    const pointer = requiredString(selector, "pointer", diagnostics, "SELECTOR_POINTER_REQUIRED", path);
    if (pointer !== undefined && !isValidJsonPointer(pointer)) {
      addDiagnostic(diagnostics, "JSON_POINTER_INVALID", `${path}.pointer`, "JSON selector pointer is malformed.");
    }
    const hasEquals = hasOwn(selector, "equals");
    const hasPresent = hasOwn(selector, "present");
    if (hasEquals === hasPresent) {
      addDiagnostic(
        diagnostics,
        hasEquals ? "SELECTOR_OPERATOR_CONFLICT" : "SELECTOR_OPERATOR_REQUIRED",
        path,
        "A JSON selector must declare exactly one equality or presence operator.",
      );
    }
    if (hasEquals) {
      const expected = selector.equals;
      if (typeof expected !== "string" && typeof expected !== "number" && typeof expected !== "boolean") {
        addDiagnostic(diagnostics, "SELECTOR_EQUALS_INVALID", `${path}.equals`, "Equality value must be scalar.");
      }
    }
    if (hasPresent && selector.present !== true) {
      addDiagnostic(diagnostics, "SELECTOR_PRESENT_INVALID", `${path}.present`, "Presence operator must be true.");
    }
    return;
  }
  rejectUnknownFields(selector, ["kind"], diagnostics, "SELECTOR_UNKNOWN_FIELD", path);
  addDiagnostic(diagnostics, "SELECTOR_KIND_UNKNOWN", `${path}.kind`, "Selector kind is not recognized by v1.");
}

function validateAnchor(value: unknown, path: string, diagnostics: Diagnostic[]): UnknownRecord | undefined {
  const anchor = checkObject(value, diagnostics, "ANCHOR_OBJECT_INVALID", path);
  if (anchor === undefined) {
    return undefined;
  }
  rejectUnknownFields(
    anchor,
    ["id", "sourceId", "selector", "effect", "strength", "value", "safety"],
    diagnostics,
    "ANCHOR_UNKNOWN_FIELD",
    path,
  );
  requiredString(anchor, "id", diagnostics, "ANCHOR_ID_REQUIRED", path);
  requiredString(anchor, "sourceId", diagnostics, "ANCHOR_SOURCE_ID_REQUIRED", path);
  validateSelector(anchor.selector, `${path}.selector`, diagnostics);
  enumValue(anchor, "effect", effects, diagnostics, "ANCHOR_EFFECT_REQUIRED", "ANCHOR_EFFECT_UNKNOWN", path);
  enumValue(anchor, "strength", strengths, diagnostics, "ANCHOR_STRENGTH_REQUIRED", "ANCHOR_STRENGTH_UNKNOWN", path);
  optionalString(anchor, "value", diagnostics, "ANCHOR_VALUE_INVALID", path);
  enumValue(
    anchor,
    "safety",
    safetyLabels,
    diagnostics,
    "ANCHOR_SAFETY_REQUIRED",
    "ANCHOR_SAFETY_UNKNOWN",
    path,
  );
  return anchor;
}

function validateStringArray(
  value: unknown,
  path: string,
  diagnostics: Diagnostic[],
): string[] | undefined {
  if (!Array.isArray(value)) {
    addDiagnostic(diagnostics, "CLAIM_DEPENDENCIES_INVALID", path, "Claim dependencies must be an array.");
    return undefined;
  }
  const result: string[] = [];
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || item.length === 0) {
      addDiagnostic(diagnostics, "CLAIM_DEPENDENCY_INVALID", `${path}[${index}]`, "Dependency ID must be a string.");
    } else {
      result.push(item);
    }
  }
  return result;
}

function validateClaim(value: unknown, path: string, diagnostics: Diagnostic[]): UnknownRecord | undefined {
  const claim = checkObject(value, diagnostics, "CLAIM_OBJECT_INVALID", path);
  if (claim === undefined) {
    return undefined;
  }
  rejectUnknownFields(
    claim,
    [
      "id",
      "title",
      "publicTitle",
      "kind",
      "critical",
      "anchors",
      "requiresVerified",
      "authorityResolverAnchorId",
      "nextAction",
      "stopCondition",
      "publicEligibleWhenVerified",
    ],
    diagnostics,
    "CLAIM_UNKNOWN_FIELD",
    path,
  );
  requiredString(claim, "id", diagnostics, "CLAIM_ID_REQUIRED", path);
  requiredString(claim, "title", diagnostics, "CLAIM_TITLE_REQUIRED", path);
  requiredString(claim, "publicTitle", diagnostics, "CLAIM_PUBLIC_TITLE_REQUIRED", path);
  enumValue(claim, "kind", claimKinds, diagnostics, "CLAIM_KIND_REQUIRED", "CLAIM_KIND_UNKNOWN", path);
  requiredBoolean(claim, "critical", diagnostics, "CLAIM_CRITICAL_REQUIRED", path);
  const anchors = requiredArray(claim, "anchors", diagnostics, "CLAIM_ANCHORS_REQUIRED", path);
  anchors?.forEach((anchor, index) => validateAnchor(anchor, `${path}.anchors[${index}]`, diagnostics));
  if (hasOwn(claim, "requiresVerified")) {
    validateStringArray(claim.requiresVerified, `${path}.requiresVerified`, diagnostics);
  }
  optionalString(
    claim,
    "authorityResolverAnchorId",
    diagnostics,
    "CLAIM_AUTHORITY_RESOLVER_INVALID",
    path,
  );
  requiredString(claim, "nextAction", diagnostics, "CLAIM_NEXT_ACTION_REQUIRED", path);
  optionalString(claim, "stopCondition", diagnostics, "CLAIM_STOP_CONDITION_INVALID", path);
  requiredBoolean(
    claim,
    "publicEligibleWhenVerified",
    diagnostics,
    "CLAIM_PUBLIC_ELIGIBILITY_REQUIRED",
    path,
  );
  return claim;
}

function validateManifest(value: unknown, diagnostics: Diagnostic[]): UnknownRecord | undefined {
  const path = "$.manifest";
  const manifest = checkObject(value, diagnostics, "MANIFEST_OBJECT_REQUIRED", path);
  if (manifest === undefined) {
    return undefined;
  }
  rejectUnknownFields(
    manifest,
    ["schemaVersion", "packetId", "title", "asOf", "rulesFile", "sources"],
    diagnostics,
    "MANIFEST_UNKNOWN_FIELD",
    path,
  );
  const schemaVersion = requiredString(manifest, "schemaVersion", diagnostics, "PACKET_SCHEMA_VERSION_REQUIRED", path);
  if (schemaVersion !== undefined && schemaVersion !== "proofpack.packet/v1") {
    addDiagnostic(
      diagnostics,
      "PACKET_SCHEMA_VERSION_UNKNOWN",
      `${path}.schemaVersion`,
      "Packet schema version is not supported.",
    );
  }
  requiredString(manifest, "packetId", diagnostics, "PACKET_ID_REQUIRED", path);
  requiredString(manifest, "title", diagnostics, "PACKET_TITLE_REQUIRED", path);
  const asOf = requiredString(manifest, "asOf", diagnostics, "PACKET_AS_OF_REQUIRED", path);
  checkTimestamp(asOf, diagnostics, `${path}.asOf`);
  const rulesFile = requiredString(manifest, "rulesFile", diagnostics, "RULES_FILE_REQUIRED", path);
  checkPath(rulesFile, diagnostics, `${path}.rulesFile`);
  const sources = requiredArray(manifest, "sources", diagnostics, "MANIFEST_SOURCES_REQUIRED", path);
  sources?.forEach((source, index) => validateSource(source, `${path}.sources[${index}]`, diagnostics, false));
  return manifest;
}

function validateRuleSet(value: unknown, diagnostics: Diagnostic[]): UnknownRecord | undefined {
  const path = "$.rules";
  const rules = checkObject(value, diagnostics, "RULESET_OBJECT_REQUIRED", path);
  if (rules === undefined) {
    return undefined;
  }
  rejectUnknownFields(
    rules,
    ["schemaVersion", "rulesetId", "rulesetVersion", "engineVersion", "claims"],
    diagnostics,
    "RULESET_UNKNOWN_FIELD",
    path,
  );
  const schemaVersion = requiredString(rules, "schemaVersion", diagnostics, "RULESET_SCHEMA_VERSION_REQUIRED", path);
  if (schemaVersion !== undefined && schemaVersion !== "proofpack.rules/v1") {
    addDiagnostic(
      diagnostics,
      "RULESET_SCHEMA_VERSION_UNKNOWN",
      `${path}.schemaVersion`,
      "Rules schema version is not supported.",
    );
  }
  requiredString(rules, "rulesetId", diagnostics, "RULESET_ID_REQUIRED", path);
  const rulesetVersion = requiredString(rules, "rulesetVersion", diagnostics, "RULESET_VERSION_REQUIRED", path);
  if (rulesetVersion !== undefined && !/^\d+\.\d+\.\d+$/u.test(rulesetVersion)) {
    addDiagnostic(diagnostics, "RULESET_VERSION_INVALID", `${path}.rulesetVersion`, "Ruleset version must be semantic.");
  }
  const engineVersion = requiredString(rules, "engineVersion", diagnostics, "ENGINE_VERSION_REQUIRED", path);
  if (engineVersion !== undefined && engineVersion !== "1.0.0") {
    addDiagnostic(diagnostics, "ENGINE_VERSION_UNKNOWN", `${path}.engineVersion`, "Engine version is not supported.");
  }
  const claims = requiredArray(rules, "claims", diagnostics, "RULESET_CLAIMS_REQUIRED", path);
  claims?.forEach((claim, index) => validateClaim(claim, `${path}.claims[${index}]`, diagnostics));
  return rules;
}

function collectObjects(value: unknown): UnknownRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRecord);
}

function reportDuplicateIds(
  values: UnknownRecord[],
  path: string,
  code: string,
  diagnostics: Diagnostic[],
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (typeof value.id !== "string") {
      return;
    }
    if (seen.has(value.id)) {
      addDiagnostic(diagnostics, code, `${path}[${index}].id`, "ID must be unique in its scope.");
    } else {
      seen.add(value.id);
    }
  });
}

function validateReferences(
  manifest: UnknownRecord | undefined,
  rules: UnknownRecord | undefined,
  sourceValues: UnknownRecord[],
  diagnostics: Diagnostic[],
): void {
  const declarations = collectObjects(manifest?.sources);
  const claims = collectObjects(rules?.claims);
  reportDuplicateIds(declarations, "$.manifest.sources", "SOURCE_DUPLICATE_ID", diagnostics);
  reportDuplicateIds(sourceValues, "$.sources", "SOURCE_DUPLICATE_ID", diagnostics);
  reportDuplicateIds(claims, "$.rules.claims", "CLAIM_DUPLICATE_ID", diagnostics);

  const declaredById = new Map<string, UnknownRecord>();
  for (const declaration of declarations) {
    if (typeof declaration.id === "string" && !declaredById.has(declaration.id)) {
      declaredById.set(declaration.id, declaration);
    }
  }
  const sourceById = new Map<string, UnknownRecord>();
  for (const source of sourceValues) {
    if (typeof source.id === "string" && !sourceById.has(source.id)) {
      sourceById.set(source.id, source);
    }
  }

  sourceValues.forEach((source, index) => {
    if (typeof source.id !== "string") {
      return;
    }
    const declaration = declaredById.get(source.id);
    if (declaration === undefined) {
      addDiagnostic(
        diagnostics,
        "SOURCE_UNDECLARED",
        `$.sources[${index}].id`,
        "Hydrated source is not declared by the manifest.",
      );
      return;
    }
    for (const field of ["file", "mediaType", "capturedAt", "safety"] as const) {
      if (source[field] !== declaration[field]) {
        addDiagnostic(
          diagnostics,
          "SOURCE_DECLARATION_MISMATCH",
          `$.sources[${index}].${field}`,
          "Hydrated source metadata must match its manifest declaration.",
        );
      }
    }
  });
  declarations.forEach((declaration, index) => {
    if (typeof declaration.id === "string" && !sourceById.has(declaration.id)) {
      addDiagnostic(
        diagnostics,
        "SOURCE_DOCUMENT_MISSING",
        `$.manifest.sources[${index}].id`,
        "Manifest source has no hydrated document.",
      );
    }
  });

  const claimIds = new Set(claims.flatMap((claim) => typeof claim.id === "string" ? [claim.id] : []));
  const allAnchorIds = new Set<string>();
  claims.forEach((claim, claimIndex) => {
    const anchors = collectObjects(claim.anchors);
    anchors.forEach((anchor, anchorIndex) => {
      if (typeof anchor.id === "string") {
        if (allAnchorIds.has(anchor.id)) {
          addDiagnostic(
            diagnostics,
            "ANCHOR_DUPLICATE_ID",
            `$.rules.claims[${claimIndex}].anchors[${anchorIndex}].id`,
            "Anchor IDs must be unique across the ruleset.",
          );
        }
        allAnchorIds.add(anchor.id);
      }
      if (typeof anchor.sourceId === "string" && !sourceById.has(anchor.sourceId)) {
        addDiagnostic(
          diagnostics,
          "ANCHOR_SOURCE_MISSING",
          `$.rules.claims[${claimIndex}].anchors[${anchorIndex}].sourceId`,
          "Anchor references an unavailable source.",
        );
      } else if (
        typeof anchor.sourceId === "string"
        && anchor.safety === "PUBLIC"
        && sourceById.get(anchor.sourceId)?.safety === "RESTRICTED"
      ) {
        addDiagnostic(
          diagnostics,
          "ANCHOR_SAFETY_ESCALATION",
          `$.rules.claims[${claimIndex}].anchors[${anchorIndex}].safety`,
          "An anchor cannot make restricted source evidence public.",
        );
      }
    });

    const dependencies = Array.isArray(claim.requiresVerified) ? claim.requiresVerified : [];
    dependencies.forEach((dependency, dependencyIndex) => {
      if (typeof dependency === "string" && !claimIds.has(dependency)) {
        addDiagnostic(
          diagnostics,
          "CLAIM_DEPENDENCY_MISSING",
          `$.rules.claims[${claimIndex}].requiresVerified[${dependencyIndex}]`,
          "Claim dependency does not exist.",
        );
      }
    });

    if (typeof claim.authorityResolverAnchorId === "string") {
      const localAnchorIds = new Set(anchors.flatMap((anchor) => typeof anchor.id === "string" ? [anchor.id] : []));
      if (!localAnchorIds.has(claim.authorityResolverAnchorId)) {
        addDiagnostic(
          diagnostics,
          "AUTHORITY_RESOLVER_MISSING",
          `$.rules.claims[${claimIndex}].authorityResolverAnchorId`,
          "Authority resolver must reference an anchor in the same claim.",
        );
      }
    }
  });

  validateDependencyCycles(claims, diagnostics);
}

function validateDependencyCycles(claims: UnknownRecord[], diagnostics: Diagnostic[]): void {
  const byId = new Map<string, { claim: UnknownRecord; index: number }>();
  claims.forEach((claim, index) => {
    if (typeof claim.id === "string" && !byId.has(claim.id)) {
      byId.set(claim.id, { claim, index });
    }
  });
  const state = new Map<string, "visiting" | "done">();
  const reported = new Set<string>();

  const visit = (id: string): void => {
    state.set(id, "visiting");
    const entry = byId.get(id);
    const dependencies = Array.isArray(entry?.claim.requiresVerified) ? entry.claim.requiresVerified : [];
    dependencies.forEach((dependency, dependencyIndex) => {
      if (typeof dependency !== "string" || !byId.has(dependency)) {
        return;
      }
      if (state.get(dependency) === "visiting") {
        const edge = `${id}->${dependency}`;
        if (!reported.has(edge)) {
          reported.add(edge);
          addDiagnostic(
            diagnostics,
            "RULE_DEPENDENCY_CYCLE",
            `$.rules.claims[${entry?.index ?? 0}].requiresVerified[${dependencyIndex}]`,
            "Claim dependency graph contains a cycle.",
          );
        }
      } else if (state.get(dependency) !== "done") {
        visit(dependency);
      }
    });
    state.set(id, "done");
  };

  for (const id of [...byId.keys()].sort()) {
    if (state.get(id) === undefined) {
      visit(id);
    }
  }
}

function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const compareText = (left: string, right: string): number => left < right ? -1 : left > right ? 1 : 0;
  return diagnostics.sort((left, right) =>
    compareText(left.code, right.code)
    || compareText(left.path, right.path)
    || compareText(left.message, right.message));
}

export function validateCompileInput(input: unknown): ValidationResult {
  const diagnostics: Diagnostic[] = [];
  const packet = checkObject(input, diagnostics, "PACKET_OBJECT_REQUIRED", "$");
  if (packet === undefined) {
    return { ok: false, diagnostics: sortDiagnostics(diagnostics) };
  }
  rejectUnknownFields(packet, ["manifest", "rules", "sources"], diagnostics, "PACKET_UNKNOWN_FIELD", "$");
  const manifest = validateManifest(packet.manifest, diagnostics);
  const rules = validateRuleSet(packet.rules, diagnostics);
  const sources = requiredArray(packet, "sources", diagnostics, "PACKET_SOURCES_REQUIRED", "$");
  const sourceValues: UnknownRecord[] = [];
  sources?.forEach((source, index) => {
    const validated = validateSource(source, `$.sources[${index}]`, diagnostics, true);
    if (validated !== undefined) {
      sourceValues.push(validated);
    }
  });
  validateReferences(manifest, rules, sourceValues, diagnostics);

  if (diagnostics.length === 0) {
    return { ok: true, diagnostics: [] };
  }
  return { ok: false, diagnostics: sortDiagnostics(diagnostics) };
}
