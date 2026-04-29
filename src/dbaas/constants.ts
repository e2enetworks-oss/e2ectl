import type {
  DbaasCreateBillingType,
  SupportedDatabaseType
} from './types/index.js';

export const DBAAS_LIST_PAGE_SIZE = 100;
export const DBAAS_LIST_MAX_PAGES = 500;

export const DBAAS_NAME_REGEX = /^[a-zA-Z0-9-_]{1,128}$/;
export const DBAAS_USERNAME_REGEX = /^[a-z0-9]+$/;
export const DBAAS_PASSWORD_REGEX =
  /^(?=\D*\d)(?=[^a-z]*[a-z])(?=[^A-Z]*[A-Z])(?=.*[#?!@$%^&|,.:<>{}()]).{16,30}$/;
export const DBAAS_IP_REGEX =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\/(?:[0-9]|[12]\d|3[0-2]))?$/;

export const DBAAS_CREATE_BILLING_TYPES: readonly DbaasCreateBillingType[] = [
  'hourly',
  'committed'
];

export const SUPPORTED_DATABASE_TYPES: ReadonlyArray<{
  aliases: readonly string[];
  canonical: SupportedDatabaseType;
}> = [
  { aliases: ['maria', 'mariadb'], canonical: 'MariaDB' },
  { aliases: ['mysql', 'sql'], canonical: 'MySQL' },
  { aliases: ['postgres', 'postgresql'], canonical: 'PostgreSQL' }
];
