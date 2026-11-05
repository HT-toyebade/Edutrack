
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { StudentsModule } from './students/students.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { StaffModule } from './staff/staff.module.js';
import { CreateStaffTable20261103000000 } from './migrations/20261103000000-create-staff-table.js';
import { BaselineUsersStudents20261102000000 } from './migrations/20261102000000-baseline-users-students.js';
import { AddSuperAdminAccountType20261104000000 } from './migrations/20261104000000-add-super-admin-account-type.js';
import { PhaseOneLifecycle20261104000001 } from './migrations/20261104000001-phase-one-lifecycle.js';
import { validateEnvironment } from './config/validate-environment.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AdminModule } from './admin/admin.module.js';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get<string>('DB_PORT') ?? 5432),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsTransactionMode: 'each',
        migrations: [BaselineUsersStudents20261102000000, CreateStaffTable20261103000000, AddSuperAdminAccountType20261104000000, PhaseOneLifecycle20261104000001],
      }),
    }),
    StudentsModule,
    UsersModule,
    AuthModule,
    StaffModule,
    InvitationsModule,
    NotificationsModule,
    AuditModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
