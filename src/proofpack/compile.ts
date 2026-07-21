import { canonicalStringify, normalizeTimestamp } from "./canonical.ts";
import { classifyClaims } from "./classify.ts";
import { resolveAnchors } from "./extract.ts";
import { deriveHandoff } from "./handoff.ts";
import { CompileError, type CompiledPack, type CompileInput, type Diagnostic } from "./types.ts";
import { validateCompileInput } from "./validate.ts";

function invariantDiagnostic(code: string, message: string): Diagnostic {
  return { code, path: "$", message };
}

function normalizeInput(input: CompileInput): CompileInput {
  try {
    const normalized = JSON.parse(canonicalStringify(input)) as CompileInput;
    normalized.manifest.asOf = normalizeTimestamp(normalized.manifest.asOf);
    for (const declaration of normalized.manifest.sources) {
      declaration.capturedAt = normalizeTimestamp(declaration.capturedAt);
    }
    for (const source of normalized.sources) {
      source.capturedAt = normalizeTimestamp(source.capturedAt);
    }
    return normalized;
  } catch {
    throw new CompileError([
      invariantDiagnostic("CANONICALIZATION_FAILED", "Compile input could not be represented canonically."),
    ]);
  }
}

export async function compileProofPack(input: CompileInput): Promise<CompiledPack> {
  const initialValidation = validateCompileInput(input);
  if (!initialValidation.ok) {
    throw new CompileError(initialValidation.diagnostics);
  }

  const normalized = normalizeInput(input);
  const normalizedValidation = validateCompileInput(normalized);
  if (!normalizedValidation.ok) {
    throw new CompileError(normalizedValidation.diagnostics);
  }

  const observations = await resolveAnchors(normalized);
  let claimsInRuleOrder;
  try {
    claimsInRuleOrder = classifyClaims(normalized.rules, observations);
  } catch (error) {
    if (error instanceof CompileError) {
      throw error;
    }
    throw new CompileError([
      invariantDiagnostic("CLASSIFICATION_INVARIANT_FAILED", "Validated claims could not be classified."),
    ]);
  }
  const handoff = deriveHandoff(claimsInRuleOrder);
  const claims = [...claimsInRuleOrder].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);

  return {
    packetId: normalized.manifest.packetId,
    title: normalized.manifest.title,
    asOf: normalized.manifest.asOf,
    rulesetId: normalized.rules.rulesetId,
    rulesetVersion: normalized.rules.rulesetVersion,
    engineVersion: normalized.rules.engineVersion,
    observations,
    claims,
    handoff,
  };
}
