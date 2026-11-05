export interface EmailProvider {
  sendInvitation(recipient: string, invitationUrl: string, idempotencyKey: string): Promise<void>;
}
