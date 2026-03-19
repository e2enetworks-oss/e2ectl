import { CliError, EXIT_CODES } from '../core/errors.js';

export function normalizeBillingType<TBillingType extends string>(
  value: string | undefined,
  allowedValues: readonly TBillingType[],
  defaultValue: TBillingType
): TBillingType {
  if (value === undefined) {
    return defaultValue;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (allowedValues.includes(normalizedValue as TBillingType)) {
    return normalizedValue as TBillingType;
  }

  throw new CliError(
    `Billing type must be one of: ${allowedValues.join(', ')}.`,
    {
      code: 'INVALID_BILLING_TYPE',
      exitCode: EXIT_CODES.usage,
      suggestion: `Pass --billing-type ${allowedValues.join(' or --billing-type ')}.`
    }
  );
}

export function normalizeOptionalNumericId(
  value: string | undefined,
  label: string,
  flag: string
): number | null {
  return value === undefined
    ? null
    : normalizeRequiredNumericId(value, label, flag);
}

export function normalizeOptionalString(
  value: string | undefined,
  label: string,
  flag: string
): string | null {
  return value === undefined
    ? null
    : normalizeRequiredString(value, label, flag);
}

export function normalizeRequiredNumericId(
  value: string,
  label: string,
  flag: string
): number {
  const normalized = normalizeRequiredString(value, label, flag);

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
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
