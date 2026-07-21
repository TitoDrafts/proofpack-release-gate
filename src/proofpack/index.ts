export * from "./types.ts";
export { canonicalStringify, normalizeText, normalizeTimestamp, sha256Hex, stableId } from "./canonical.ts";
export {
  classifyClaims,
  evaluateDirectClaim,
  evaluateExclusiveClaim,
  evaluateGateClaim,
  evaluateInferenceClaim,
} from "./classify.ts";
export { compileProofPack } from "./compile.ts";
export { resolveAnchors } from "./extract.ts";
export { deriveHandoff } from "./handoff.ts";
export { validateCompileInput } from "./validate.ts";
