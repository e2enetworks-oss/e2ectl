import { CliError, EXIT_CODES } from './errors.js';

// Checks for values typed on the command line, shared by every product.
// label names the value ("Node ID"), flag says where it goes ("--node-id").

export function normalizeOptionalNumericId(
  value: string | undefined,
  label: string,
  flag: string
): number | null {
  return value === undefined
    ? null
    : normalizeRequiredNumericId(value, label, flag);
}

export function normalizeRequiredNumericId(
  value: string,
  label: string,
  flag: string
): number {
  const normalized = normalizeRequiredString(value, label, flag);

  if (/^\d+$/.test(normalized)) {
    const parsed = Number(normalized);
    if (parsed > Number.MAX_SAFE_INTEGER) {
      throw new CliError(`${label} is too large to represent safely.`, {
        code: 'INVALID_NUMERIC_ID',
        exitCode: EXIT_CODES.usage,
        suggestion: `Pass a valid numeric ${label.toLowerCase()} with ${flag}.`
      });
    }
    return parsed;
  }

  throw new CliError(`${label} must be numeric.`, {
    code: 'INVALID_NUMERIC_ID',
    exitCode: EXIT_CODES.usage,
    suggestion: `Pass the numeric ${label.toLowerCase()} with ${flag}.`
  });
}

export function normalizeRequiredString(
  value: string,
  label: string,
  flag: string
): string {
  const normalized = value.trim();
  if (normalized.length > 0) {
    return normalized;
  }

  throw new CliError(`${label} cannot be empty.`, {
    code: 'EMPTY_REQUIRED_VALUE',
    exitCode: EXIT_CODES.usage,
    suggestion: `Pass a non-empty value with ${flag}.`
  });
}
