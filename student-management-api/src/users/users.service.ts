import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus, AccountType, User } from './entities/user.entity.js';
import { Student } from '../student/entities/student.entity/student.entity.js';
import { Staff } from '../staff/entities/staff.entity.js';
import { AuditService } from '../audit/audit.service.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Student) private readonly studentRepository: Repository<Student>,
    @InjectRepository(Staff) private readonly staffRepository: Repository<Staff>,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email: email.trim().toLowerCase() } });
  }

  async findCurrentUser(id: number) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new UnauthorizedException('Invalid session.');
    return { id: user.id, email: user.email, accountType: user.accountType, status: user.status };
  }

  async updateOwnEmail(id: number, inputEmail: string) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(User);
        const user = await repository.findOne({ where: { id } });
        if (!user) throw new UnauthorizedException('Invalid session.');
        const before = user.email;
        const email = inputEmail.trim().toLowerCase();
        const matchingStudent = await manager.getRepository(Student).findOne({ where: { email }, relations: { user: true } });
        if (matchingStudent && matchingStudent.user?.id !== id) {
          throw new ConflictException('Email is already registered.');
        }
        user.email = email;
        await repository.save(user);
        if (user.accountType === AccountType.STUDENT) {
          const studentRepository = manager.getRepository(Student);
          const profile = await studentRepository.findOne({ where: { user: { id } } });
          if (!profile) throw new ConflictException('Account setup is incomplete. Contact an administrator.');
          profile.email = user.email;
          await studentRepository.save(profile);
        }
        await this.audit.record({ actorUserId: id, action: 'account.email_updated', targetType: 'user', targetId: id, changes: { before: { email: before }, after: { email: user.email } } }, manager);
        return { id: user.id, email: user.email, accountType: user.accountType, status: user.status };
      });
    } catch (error) {
      if (UsersService.isUniqueViolation(error)) throw new ConflictException('Email is already registered.');
      throw error;
    }
  }

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.passwordHash)) || user.status !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    await this.assertProfileExists(user);
    return user;
  }

  async generateAccessToken(user: User): Promise<string> {
    return this.jwtService.signAsync({ sub: user.id });
  }

  async hashPassword(password: string): Promise<string> { return bcrypt.hash(password, 10); }

  private async assertProfileExists(user: User) {
    if (user.accountType === AccountType.STUDENT && !(await this.studentRepository.findOne({ where: { user: { id: user.id } } }))) {
      throw new ConflictException('Account setup is incomplete. Contact an administrator.');
    }
    if (user.accountType === AccountType.STAFF && !(await this.staffRepository.findOne({ where: { user: { id: user.id } } }))) {
      throw new ConflictException('Account setup is incomplete. Contact an administrator.');
    }
  }

  static isUniqueViolation(error: unknown): boolean {
    return error instanceof QueryFailedError && typeof error.driverError === 'object' && error.driverError !== null && 'code' in error.driverError && error.driverError.code === '23505';
  }
}
