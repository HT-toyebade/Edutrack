import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EmailOutbox } from './entities/email-outbox.entity.js';
import { Invitation } from '../invitations/entities/invitation.entity.js';
import { EmailOutboxProcessor } from './email-outbox.processor.js';
import { SmtpEmailProvider } from './smtp-email.provider.js';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([EmailOutbox, Invitation])],
  providers: [SmtpEmailProvider, EmailOutboxProcessor],
  exports: [SmtpEmailProvider],
})
export class NotificationsModule {}
