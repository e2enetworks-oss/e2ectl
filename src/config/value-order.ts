import { isNonEmptyString } from '../core/guards.js';

// Where a setting can come from, in the order they are tried.
export interface ValueSources {
  env?: string | undefined;
  flag?: string | undefined;
  profile?: string | undefined;
}

export type ValueOrigin = keyof ValueSources;

export interface PickedValue {
  origin: ValueOrigin;
  value: string;
}

const VALUE_ORDER: readonly ValueOrigin[] = ['flag', 'env', 'profile'];

// Every setting, on MyAccount and TIR alike, comes from the first place that
// has it: the command's flag, then its environment variable, then the saved
// profile. Blank values count as missing. Returns undefined when none has it.
export function pickValue(sources: ValueSources): PickedValue | undefined {
  for (const origin of VALUE_ORDER) {
    const value = sources[origin];
    if (isNonEmptyString(value)) {
      return { origin, value: value.trim() };
    }
  }

  return undefined;
}
