import { staffSeedingDisabled } from './seed-staff-user.js';

describe('legacy staff seeding', () => {
  it('cannot create Staff accounts outside the invitation workflow', () => {
    expect(() => staffSeedingDisabled()).toThrow(/Super Admin must create the account and invitation/i);
  });
});
