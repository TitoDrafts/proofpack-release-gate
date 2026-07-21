export type ClaimStatus = "VERIFIED" | "INFERRED" | "NEEDS_CONFIRMATION" | "CONFLICTED" | "BLOCKED";
export type OperationalDecision = "READY" | "HOLD";
export type SafetyLabel = "PUBLIC" | "RESTRICTED";
export type EvidenceStrength = "DIRECT" | "CORROBORATING" | "CONTEXT";
export type EvidenceEffect = "SUPPORT" | "CONTRADICT" | "BLOCK" | "ASSERT_VALUE";
export type ClaimKind = "direct" | "inference" | "exclusive" | "gate";
export type SourceMediaType = "application/json" | "text/markdown" | "text/plain";

export type Selector =
  | { kind: "line"; contains: string }
  | { kind: "log"; event: string; fields: Record<string, string | boolean> }
  | { kind: "json"; pointer: string; equals?: string | number | boolean; present?: true };

export interface SourceDeclaration {
  id: string;
  file: string;
  mediaType: SourceMediaType;
  capturedAt: string;
  safety: SafetyLabel;
}

export interface PacketManifest {
  schemaVersion: "proofpack.packet/v1";
  packetId: string;
  title: string;
  asOf: string;
  rulesFile: string;
  sources: SourceDeclaration[];
}

export interface SourceDocument extends SourceDeclaration {
  content: string;
}

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

export interface RuleSet {
  schemaVersion: "proofpack.rules/v1";
  rulesetId: string;
  rulesetVersion: string;
  engineVersion: string;
  claims: ClaimRule[];
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

function compareDiagnosticText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export class CompileError extends Error {
  readonly diagnostics: Diagnostic[];

  constructor(diagnostics: readonly Diagnostic[]) {
    const ordered = [...diagnostics].sort((left, right) =>
      compareDiagnosticText(left.code, right.code)
      || compareDiagnosticText(left.path, right.path)
      || compareDiagnosticText(left.message, right.message));
    super(ordered.map(({ code, path, message }) => `${code} ${path}: ${message}`).join("\n"));
    this.name = "CompileError";
    this.diagnostics = ordered;
  }
}

export type ValidationResult =
  | { ok: true; diagnostics: [] }
  | { ok: false; diagnostics: Diagnostic[] };

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

export interface Handoff {
  decision: OperationalDecision;
  summary: string;
  done: string[];
  notDone: string[];
  nextAction: string;
  stopConditions: string[];
}

export interface CompiledPack {
  packetId: string;
  title: string;
  asOf: string;
  rulesetId: string;
  rulesetVersion: string;
  engineVersion: string;
  observations: Observation[];
  claims: ClaimResult[];
  handoff: Handoff;
}
