import type {
  ClaimResult,
  ClaimRule,
  ClaimStatus,
  Observation,
  RuleSet,
  SafetyLabel,
} from "./types.ts";

interface Evaluation {
  status: ClaimStatus;
  reasonCodes: string[];
  evidenceIds: string[];
  missingPredicates: string[];
}

interface EvaluationContext {
  claim: ClaimRule;
  observations: Observation[];
  dependencies: ClaimResult[];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareText);
}

function matchedAnchorIds(observations: readonly Observation[]): Set<string> {
  return new Set(observations.map(({ anchorId }) => anchorId));
}

function ownEvidenceIds(observations: readonly Observation[]): string[] {
  return sortedUnique(observations.map(({ id }) => id));
}

function dependencyEvidenceIds(dependencies: readonly ClaimResult[]): string[] {
  return sortedUnique(dependencies.flatMap(({ evidenceIds }) => evidenceIds));
}

function lineageSafety(claim: ClaimRule, dependencies: readonly ClaimResult[]): SafetyLabel {
  return claim.anchors.some(({ safety }) => safety === "RESTRICTED")
    || dependencies.some(({ lineageSafety: safety }) => safety === "RESTRICTED")
    ? "RESTRICTED"
    : "PUBLIC";
}

function directSupportAnchorIds(claim: ClaimRule): string[] {
  return claim.anchors
    .filter(({ effect, strength }) => effect === "SUPPORT" && strength === "DIRECT")
    .map(({ id }) => id);
}

function corroboratingAnchorIds(claim: ClaimRule): string[] {
  return claim.anchors
    .filter(({ effect, strength }) => effect === "SUPPORT" && strength === "CORROBORATING")
    .map(({ id }) => id);
}

function missingAnchors(expected: readonly string[], observations: readonly Observation[]): string[] {
  const matched = matchedAnchorIds(observations);
  return sortedUnique(expected.filter((id) => !matched.has(id)));
}

function hasQualifyingContradiction(observations: readonly Observation[]): boolean {
  return observations.some(({ effect, strength }) =>
    strength !== "CONTEXT" && (effect === "CONTRADICT" || effect === "BLOCK"));
}

function evaluation(
  status: ClaimStatus,
  reasonCode: string,
  evidenceIds: Iterable<string>,
  missingPredicates: Iterable<string> = [],
): Evaluation {
  return {
    status,
    reasonCodes: [reasonCode],
    evidenceIds: sortedUnique(evidenceIds),
    missingPredicates: sortedUnique(missingPredicates),
  };
}

export function evaluateDirectClaim(context: EvaluationContext): Evaluation {
  const { claim, observations } = context;
  const evidenceIds = ownEvidenceIds(observations);
  if (hasQualifyingContradiction(observations)) {
    return evaluation("CONFLICTED", "QUALIFYING_CONTRADICTION", evidenceIds);
  }
  const expected = directSupportAnchorIds(claim);
  const missing = missingAnchors(expected, observations);
  if (expected.length > 0 && missing.length === 0) {
    return evaluation("VERIFIED", "DIRECT_PREDICATES_COMPLETE", evidenceIds);
  }
  return evaluation("NEEDS_CONFIRMATION", "DECLARED_EVIDENCE_MISSING", evidenceIds, missing);
}

export function evaluateInferenceClaim(context: EvaluationContext): Evaluation {
  const { claim, observations, dependencies } = context;
  const evidenceIds = sortedUnique([
    ...ownEvidenceIds(observations),
    ...dependencyEvidenceIds(dependencies),
  ]);
  if (hasQualifyingContradiction(observations)) {
    return evaluation("CONFLICTED", "QUALIFYING_CONTRADICTION", evidenceIds);
  }
  const directAnchors = directSupportAnchorIds(claim);
  if (directAnchors.length > 0 && missingAnchors(directAnchors, observations).length === 0) {
    return evaluation("VERIFIED", "DIRECT_PREDICATES_COMPLETE", evidenceIds);
  }
  if (dependencies.some(({ status }) => status === "CONFLICTED")) {
    return evaluation("CONFLICTED", "DEPENDENCY_CONFLICT", evidenceIds);
  }
  const corroborating = corroboratingAnchorIds(claim);
  const missingCorroborating = missingAnchors(corroborating, observations);
  const unresolvedDependencies = dependencies
    .filter(({ status }) => status !== "VERIFIED")
    .map(({ id }) => id);
  const hasNamedPremise = corroborating.length > 0 || dependencies.length > 0;
  if (hasNamedPremise && missingCorroborating.length === 0 && unresolvedDependencies.length === 0) {
    return evaluation("INFERRED", "INFERENCE_PREMISES_COMPLETE", evidenceIds);
  }
  return evaluation(
    "NEEDS_CONFIRMATION",
    "INFERENCE_PREMISES_MISSING",
    evidenceIds,
    [...missingCorroborating, ...unresolvedDependencies],
  );
}

export function evaluateExclusiveClaim(context: EvaluationContext): Evaluation {
  const { claim, observations } = context;
  const evidenceIds = ownEvidenceIds(observations);
  const asserted = observations.filter(({ effect, strength, value }) =>
    effect === "ASSERT_VALUE" && strength === "DIRECT" && value !== undefined);
  const activeValues = sortedUnique(asserted.flatMap(({ value }) => value === undefined ? [] : [value]));
  const resolver = claim.authorityResolverAnchorId === undefined
    ? undefined
    : asserted.find(({ anchorId }) => anchorId === claim.authorityResolverAnchorId);
  const competingValues = sortedUnique(asserted.flatMap(({ anchorId, value }) =>
    anchorId === claim.authorityResolverAnchorId || value === undefined ? [] : [value]));
  const resolverSelectsCompetingValue = resolver?.value !== undefined
    && competingValues.includes(resolver.value);

  if (activeValues.length > 1 && !resolverSelectsCompetingValue) {
    const missingResolver = claim.authorityResolverAnchorId !== undefined && resolver === undefined
      ? [claim.authorityResolverAnchorId]
      : [];
    return evaluation("CONFLICTED", "EXCLUSIVE_VALUES_UNRESOLVED", evidenceIds, missingResolver);
  }
  if (hasQualifyingContradiction(observations)) {
    return evaluation("CONFLICTED", "QUALIFYING_CONTRADICTION", evidenceIds);
  }
  if (activeValues.length > 1 && resolverSelectsCompetingValue) {
    return evaluation("VERIFIED", "AUTHORITY_RESOLVER_APPLIED", evidenceIds);
  }
  if (activeValues.length === 1) {
    return evaluation(
      "VERIFIED",
      resolver === undefined ? "EXCLUSIVE_VALUE_ESTABLISHED" : "AUTHORITY_RESOLVER_APPLIED",
      evidenceIds,
    );
  }
  const candidateAnchors = claim.anchors
    .filter(({ effect, strength }) => effect === "ASSERT_VALUE" && strength === "DIRECT")
    .map(({ id }) => id);
  return evaluation("NEEDS_CONFIRMATION", "DECLARED_EVIDENCE_MISSING", evidenceIds, candidateAnchors);
}

export function evaluateGateClaim(context: EvaluationContext): Evaluation {
  const { claim, observations, dependencies } = context;
  const evidenceIds = ownEvidenceIds(observations);
  const directBlockers = observations.filter(({ effect, strength }) => effect === "BLOCK" && strength === "DIRECT");
  const directSupports = observations.filter(({ effect, strength }) => effect === "SUPPORT" && strength === "DIRECT");

  if (directBlockers.length > 0 && directSupports.length > 0) {
    return evaluation("CONFLICTED", "GATE_EVIDENCE_DISAGREEMENT", evidenceIds);
  }
  if (directBlockers.length > 0) {
    return evaluation("BLOCKED", "DIRECT_BLOCKER_ACTIVE", evidenceIds);
  }
  if (hasQualifyingContradiction(observations)) {
    return evaluation("CONFLICTED", "QUALIFYING_CONTRADICTION", evidenceIds);
  }
  if (dependencies.some(({ status }) => status === "CONFLICTED")) {
    return evaluation("CONFLICTED", "DEPENDENCY_CONFLICT", evidenceIds);
  }

  const expectedSupports = directSupportAnchorIds(claim);
  const missingSupports = missingAnchors(expectedSupports, observations);
  const unresolvedDependencies = dependencies
    .filter(({ status }) => status !== "VERIFIED")
    .map(({ id }) => id);
  const hasVerificationRoute = expectedSupports.length > 0 || dependencies.length > 0;
  if (hasVerificationRoute && missingSupports.length === 0 && unresolvedDependencies.length === 0) {
    return evaluation(
      "VERIFIED",
      "GATE_PREREQUISITES_VERIFIED",
      [...evidenceIds, ...dependencyEvidenceIds(dependencies)],
    );
  }
  const reasonCode = unresolvedDependencies.length > 0 ? "DEPENDENCIES_UNRESOLVED" : "DECLARED_EVIDENCE_MISSING";
  return evaluation(
    "NEEDS_CONFIRMATION",
    reasonCode,
    evidenceIds,
    [...missingSupports, ...unresolvedDependencies],
  );
}

function materializeClaim(
  rules: RuleSet,
  claim: ClaimRule,
  result: Evaluation,
  dependencies: readonly ClaimResult[],
): ClaimResult {
  return {
    id: claim.id,
    title: claim.title,
    publicTitle: claim.publicTitle,
    status: result.status,
    lineageSafety: lineageSafety(claim, dependencies),
    critical: claim.critical,
    reasonCodes: sortedUnique(result.reasonCodes),
    ruleId: rules.rulesetId,
    ruleVersion: rules.rulesetVersion,
    evidenceIds: sortedUnique(result.evidenceIds),
    missingPredicates: sortedUnique(result.missingPredicates),
    nextAction: claim.nextAction,
    publicNextAction: claim.publicNextAction,
    ...(claim.stopCondition === undefined ? {} : { stopCondition: claim.stopCondition }),
    publicEligible: claim.publicEligibleWhenVerified && result.status === "VERIFIED",
  };
}

export function classifyClaims(rules: RuleSet, observations: readonly Observation[]): ClaimResult[] {
  const claimById = new Map(rules.claims.map((claim) => [claim.id, claim]));
  const observationsByClaim = new Map<string, Observation[]>();
  for (const observation of observations) {
    const current = observationsByClaim.get(observation.claimId) ?? [];
    current.push(observation);
    observationsByClaim.set(observation.claimId, current);
  }
  const results = new Map<string, ClaimResult>();
  const evaluating = new Set<string>();

  const evaluate = (claim: ClaimRule): ClaimResult => {
    const existing = results.get(claim.id);
    if (existing !== undefined) {
      return existing;
    }
    if (evaluating.has(claim.id)) {
      throw new Error("CLASSIFICATION_DEPENDENCY_CYCLE");
    }
    evaluating.add(claim.id);
    const dependencies = (claim.requiresVerified ?? []).map((id) => {
      const dependency = claimById.get(id);
      if (dependency === undefined) {
        throw new Error(`CLASSIFICATION_DEPENDENCY_MISSING:${id}`);
      }
      return evaluate(dependency);
    });
    const context: EvaluationContext = {
      claim,
      observations: observationsByClaim.get(claim.id) ?? [],
      dependencies,
    };
    const evaluated = claim.kind === "direct"
      ? evaluateDirectClaim(context)
      : claim.kind === "inference"
        ? evaluateInferenceClaim(context)
        : claim.kind === "exclusive"
          ? evaluateExclusiveClaim(context)
          : evaluateGateClaim(context);
    const result = materializeClaim(rules, claim, evaluated, dependencies);
    results.set(claim.id, result);
    evaluating.delete(claim.id);
    return result;
  };

  return rules.claims.map((claim) => evaluate(claim));
}
