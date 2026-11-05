import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import { EmailProvider } from './email-provider.interface.js';

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly transporter?: Transporter;
  private readonly sender?: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const port = config.get<number>('SMTP_PORT');
    const user = config.get<string>('SMTP_USER');
    const password = config.get<string>('SMTP_PASSWORD');
    this.sender = config.get<string>('EMAIL_FROM');
    if (host && port && user && password && this.sender) {
      this.transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass: password } });
    }
  }

  async sendInvitation(recipient: string, invitationUrl: string, idempotencyKey: string): Promise<void> {
    if (!this.transporter || !this.sender) throw new ServiceUnavailableException('Email delivery is not configured.');
    await this.transporter.sendMail({
      from: this.sender,
      to: recipient,
      subject: 'EduTrack account invitation',
      messageId: `<${idempotencyKey}@edutrack.local>`,
      text: `You have been invited to EduTrack. Set your password using this secure link: ${invitationUrl}\nThis link expires in 48 hours. If you did not expect this invitation, ignore this message.`,
    });
  }
}
