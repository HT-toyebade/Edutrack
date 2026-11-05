/** Legacy staff seeding is intentionally disabled; Staff accounts are invitation based. */
export function staffSeedingDisabled(): never {
  throw new Error('Standalone Staff seeding is disabled. A Super Admin must create the account and invitation.');
}
