import type { ClaimResult, ClaimStatus, Handoff } from "./types.ts";

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareText);
}

function statusSummary(claims: readonly ClaimResult[]): string {
  const order: ClaimStatus[] = ["BLOCKED", "CONFLICTED", "NEEDS_CONFIRMATION", "INFERRED"];
  return order.flatMap((status) => {
    const count = claims.filter((claim) => claim.status === status).length;
    return count === 0 ? [] : [`${count} ${status.toLowerCase()}`];
  }).join(", ");
}

export function deriveHandoff(claims: readonly ClaimResult[]): Handoff {
  const unresolvedCritical = claims.filter(({ critical, status }) => critical && status !== "VERIFIED");
  const decision = unresolvedCritical.length === 0 ? "READY" : "HOLD";
  const nextAction = unresolvedCritical[0]?.nextAction ?? "Proceed using the verified release packet.";
  const summary = decision === "READY"
    ? "READY FOR RELEASE. Every critical claim is verified against the supplied packet and ruleset."
    : `HOLD RELEASE. ${unresolvedCritical.length} critical ${unresolvedCritical.length === 1 ? "claim remains" : "claims remain"} unresolved (${statusSummary(unresolvedCritical)}). Next: ${nextAction}`;

  return {
    decision,
    summary,
    done: claims.filter(({ status }) => status === "VERIFIED").map(({ id }) => id).sort(compareText),
    notDone: claims.filter(({ status }) => status !== "VERIFIED").map(({ id }) => id).sort(compareText),
    nextAction,
    stopConditions: sortedUnique(claims.flatMap(({ status, stopCondition }) =>
      status !== "VERIFIED" && stopCondition !== undefined ? [stopCondition] : [])),
  };
}
