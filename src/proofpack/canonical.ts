const timestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})(Z|([+-])(\d{2}):(\d{2}))$/u;

export function normalizeText(value: string): string {
  return value.replace(/\r\n?/gu, "\n").normalize("NFC");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function floorDivide(value: number, divisor: number): number {
  return Math.floor(value / divisor);
}

function daysFromCivil(yearValue: number, month: number, day: number): number {
  const year = yearValue - (month <= 2 ? 1 : 0);
  const era = floorDivide(year, 400);
  const yearOfEra = year - era * 400;
  const adjustedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = floorDivide(153 * adjustedMonth + 2, 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + floorDivide(yearOfEra, 4) - floorDivide(yearOfEra, 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

function civilFromDays(dayValue: number): { year: number; month: number; day: number } {
  const shifted = dayValue + 719468;
  const era = floorDivide(shifted, 146097);
  const dayOfEra = shifted - era * 146097;
  const yearOfEra = floorDivide(
    dayOfEra - floorDivide(dayOfEra, 1460) + floorDivide(dayOfEra, 36524) - floorDivide(dayOfEra, 146096),
    365,
  );
  let year = yearOfEra + era * 400;
  const dayOfYear = dayOfEra - (365 * yearOfEra + floorDivide(yearOfEra, 4) - floorDivide(yearOfEra, 100));
  const monthPart = floorDivide(5 * dayOfYear + 2, 153);
  const day = dayOfYear - floorDivide(153 * monthPart + 2, 5) + 1;
  const month = monthPart + (monthPart < 10 ? 3 : -9);
  year += month <= 2 ? 1 : 0;
  return { year, month, day };
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

export function normalizeTimestamp(value: string): string {
  const normalized = normalizeText(value);
  const match = timestampPattern.exec(normalized);
  if (match === null) {
    return normalized;
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, millisecondText, zone, sign, offsetHourText, offsetMinuteText] = match;
  const dayNumber = daysFromCivil(Number(yearText), Number(monthText), Number(dayText));
  const localMilliseconds = (
    ((dayNumber * 24 + Number(hourText)) * 60 + Number(minuteText)) * 60 + Number(secondText)
  ) * 1000 + Number(millisecondText);
  const direction = sign === "-" ? -1 : 1;
  const offsetMinutes = zone === "Z"
    ? 0
    : direction * (Number(offsetHourText) * 60 + Number(offsetMinuteText));
  const utcMilliseconds = localMilliseconds - offsetMinutes * 60_000;
  const millisecondsPerDay = 86_400_000;
  const utcDay = floorDivide(utcMilliseconds, millisecondsPerDay);
  let remainder = utcMilliseconds - utcDay * millisecondsPerDay;
  const hour = floorDivide(remainder, 3_600_000);
  remainder -= hour * 3_600_000;
  const minute = floorDivide(remainder, 60_000);
  remainder -= minute * 60_000;
  const second = floorDivide(remainder, 1000);
  const millisecond = remainder - second * 1000;
  const { year, month, day } = civilFromDays(utcDay);
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}T${pad(hour, 2)}:${pad(minute, 2)}:${pad(second, 2)}.${pad(millisecond, 3)}Z`;
}

type CanonicalValue = null | boolean | number | string | CanonicalValue[] | { [key: string]: CanonicalValue };

function isPlainRecord(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function canonicalize(
  value: unknown,
  parentKey: string | undefined,
  ancestors: WeakSet<object>,
  semanticMode: boolean,
): CanonicalValue {
  if (value === null || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return semanticMode && (parentKey === "capturedAt" || parentKey === "asOf")
      ? normalizeTimestamp(value)
      : normalizeText(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("CANONICAL_NUMBER_NON_FINITE");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw new TypeError("CANONICAL_CYCLE_UNSUPPORTED");
    }
    ancestors.add(value);
    const items = value.map((item) => canonicalize(item, undefined, ancestors, semanticMode));
    ancestors.delete(value);
    if (semanticMode && parentKey === "requiresVerified" && items.every((item) => typeof item === "string")) {
      items.sort((left, right) => compareText(left as string, right as string));
    }
    const hasStableIds = semanticMode
      && parentKey !== "claims"
      && items.length > 0
      && items.every((item) => !Array.isArray(item) && item !== null && typeof item === "object" && typeof item.id === "string");
    if (hasStableIds) {
      items.sort((left, right) => {
        const leftRecord = left as { id: string };
        const rightRecord = right as { id: string };
        return compareText(leftRecord.id, rightRecord.id)
          || compareText(serializeCanonical(left), serializeCanonical(right));
      });
    }
    return items;
  }
  if (typeof value !== "object" || !isPlainRecord(value)) {
    throw new TypeError("CANONICAL_VALUE_UNSUPPORTED");
  }
  if (ancestors.has(value)) {
    throw new TypeError("CANONICAL_CYCLE_UNSUPPORTED");
  }
  ancestors.add(value);

  const entries = Object.entries(value).map(([key, item]) => [normalizeText(key), item] as const);
  entries.sort(([left], [right]) => compareText(left, right));
  const result = Object.create(null) as { [key: string]: CanonicalValue };
  for (const [key, item] of entries) {
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      throw new TypeError("CANONICAL_KEY_COLLISION");
    }
    if (item === undefined || typeof item === "function" || typeof item === "symbol" || typeof item === "bigint") {
      throw new TypeError("CANONICAL_VALUE_UNSUPPORTED");
    }
    result[key] = canonicalize(item, key, ancestors, semanticMode);
  }
  ancestors.delete(value);
  return result;
}

function serializeCanonical(value: CanonicalValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeCanonical(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort(compareText);
  return `{${keys.map((key) => `${JSON.stringify(key)}:${serializeCanonical(value[key]!)}`).join(",")}}`;
}

export function canonicalStringify(value: unknown): string {
  return serializeCanonical(canonicalize(value, undefined, new WeakSet<object>(), true));
}

export function canonicalStringifyPreservingArrayOrder(value: unknown): string {
  return serializeCanonical(canonicalize(value, undefined, new WeakSet<object>(), false));
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeText(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function stableId(prefix: string, value: unknown): Promise<string> {
  const normalizedPrefix = normalizeText(prefix);
  if (normalizedPrefix.length === 0) {
    throw new TypeError("STABLE_ID_PREFIX_REQUIRED");
  }
  return `${normalizedPrefix}-${await sha256Hex(canonicalStringify(value))}`;
}
