import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { Student } from '../student/entities/student.entity/student.entity.js';
import { Staff } from '../staff/entities/staff.entity.js';
import { AccountStatus, AccountType, User } from '../users/entities/user.entity.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(Staff) private readonly staff: Repository<Staff>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: number }) {
    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user || user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid or inactive account.');
    }

    if (user.accountType === AccountType.STUDENT) {
      const profile = await this.students.findOne({ where: { user: { id: user.id } } });
      if (!profile) throw new ConflictException('Account setup is incomplete. Contact an administrator.');
    }
    if (user.accountType === AccountType.STAFF) {
      const profile = await this.staff.findOne({ where: { user: { id: user.id } } });
      if (!profile) throw new ConflictException('Account setup is incomplete. Contact an administrator.');
    }
    return {
      userId: user.id,
      email: user.email,
      accountType: user.accountType,
      status: user.status,
    };
  }
}
