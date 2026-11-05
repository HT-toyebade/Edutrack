import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export function digestInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function encryptInvitationToken(token: string, secret: string): string {
  const key = createHash('sha256').update(`edutrack-invitation:${secret}`).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptInvitationToken(payload: string, secret: string): string {
  const [ivPart, tagPart, encryptedPart] = payload.split('.');
  if (!ivPart || !tagPart || !encryptedPart) throw new Error('Invalid invitation token ciphertext');
  const key = createHash('sha256').update(`edutrack-invitation:${secret}`).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedPart, 'base64url')), decipher.final()]).toString('utf8');
}
