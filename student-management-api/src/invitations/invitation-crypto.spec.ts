import { decryptInvitationToken, digestInvitationToken, encryptInvitationToken } from './invitation-crypto.js';

describe('invitation token crypto', () => {
  it('stores a one-way digest and encrypted delivery token without plaintext persistence', () => {
    const raw = 'fictional-high-entropy-token';
    const secret = 'test-secret-that-is-not-production';
    const digest = digestInvitationToken(raw);
    const ciphertext = encryptInvitationToken(raw, secret);
    expect(digest).not.toContain(raw);
    expect(ciphertext).not.toContain(raw);
    expect(decryptInvitationToken(ciphertext, secret)).toBe(raw);
    expect(digestInvitationToken('different')).not.toBe(digest);
  });

  it('rejects ciphertext encrypted with another secret', () => {
    const ciphertext = encryptInvitationToken('fictional-token', 'one');
    expect(() => decryptInvitationToken(ciphertext, 'two')).toThrow();
  });
});
