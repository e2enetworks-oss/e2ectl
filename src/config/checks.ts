import { CliError, EXIT_CODES } from '../core/errors.js';
import { VALID_LOCATIONS } from './types.js';

export type Location = (typeof VALID_LOCATIONS)[number];

// Delhi or Chennai, typed in any case.
export function findLocation(value: string): Location | undefined {
  const typed = value.trim().toLowerCase();
  return VALID_LOCATIONS.find((location) => location.toLowerCase() === typed);
}

export function normalizeLocation(value: string): Location {
  const location = findLocation(value);
  if (location !== undefined) {
    return location;
  }

  throw new CliError(`Unsupported location "${value}".`, {
    code: 'INVALID_LOCATION',
    details: [`Expected one of: ${VALID_LOCATIONS.join(', ')}`],
    exitCode: EXIT_CODES.usage,
    suggestion: 'Use Delhi or Chennai.'
  });
}

// label names the value, for example "TIR project ID".
export function parseNumericId(
  value: string,
  label: string,
  flag: string
): number {
  const typed = value.trim();
  if (/^\d+$/.test(typed)) {
    return Number(typed);
  }

  throw new CliError(`${label} must be numeric.`, {
    code: 'INVALID_ID',
    exitCode: EXIT_CODES.usage,
    suggestion: `Pass a numeric id with ${flag}.`
  });
}
