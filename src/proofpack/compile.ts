import { normalizeCompileInput } from "./canonical.ts";
import { classifyClaims } from "./classify.ts";
import { resolveAnchors } from "./extract.ts";
import { deriveHandoff } from "./handoff.ts";
import { buildReceipt } from "./receipt.ts";
import {
  buildShareableProjection,
  renderOperatorMarkdown,
  renderShareableMarkdown,
} from "./safety.ts";
import {
  CompileError,
  type CompiledPack,
  type CompiledPackStages,
  type CompileInput,
  type Diagnostic,
} from "./types.ts";
import { validateCompileInput } from "./validate.ts";

function invariantDiagnostic(code: string, message: string): Diagnostic {
  return { code, path: "$", message };
}

function normalizeInput(input: CompileInput): CompileInput {
  try {
    return normalizeCompileInput(input);
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

  const stages: CompiledPackStages = {
    packetId: normalized.manifest.packetId,
    title: normalized.manifest.title,
    publicAlias: normalized.manifest.publicAlias,
    asOf: normalized.manifest.asOf,
    rulesetId: normalized.rules.rulesetId,
    rulesetVersion: normalized.rules.rulesetVersion,
    engineVersion: normalized.rules.engineVersion,
    observations,
    claims,
    handoff,
  };
  const shareable = await buildShareableProjection(stages);
  const receipt = await buildReceipt({
    input: normalized,
    observations,
    claims,
    handoff,
    shareable,
  });
  const packWithReceipt = { ...stages, shareable, receipt };
  return {
    ...packWithReceipt,
    artifacts: {
      operatorMarkdown: renderOperatorMarkdown(packWithReceipt),
      shareableMarkdown: await renderShareableMarkdown(shareable),
    },
  };
}
