export type JsonPrimitive = boolean | null | number | string;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeJson(entry));
  }

  if (isJsonObject(value)) {
    const normalizedEntries = Object.keys(value)
      .sort()
      .map((key) => [key, normalizeJson(value[key]!)] as const);

    return Object.fromEntries(normalizedEntries);
  }

  return value;
}

export function stableStringify(value: JsonValue, space = 2): string {
  return JSON.stringify(normalizeJson(value), null, space);
}
