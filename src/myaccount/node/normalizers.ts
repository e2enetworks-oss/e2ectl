import { CliError, EXIT_CODES } from '../../core/errors.js';
import { normalizeRequiredString } from '../../core/normalize.js';

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

export function normalizeOptionalString(
  value: string | undefined,
  label: string,
  flag: string
): string | null {
  return value === undefined
    ? null
    : normalizeRequiredString(value, label, flag);
}
