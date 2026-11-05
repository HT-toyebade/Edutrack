import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Student } from '../student/entities/student.entity/student.entity.js';
import { User, AccountStatus, AccountType } from '../users/entities/user.entity.js';
import { CreateStudentDto } from './dto/create-student.dto/create-student.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto/update-student.dto.js';
import { UpdateAccountStatusDto } from '../users/dto/update-account-status.dto.js';
import { InvitationsService } from '../invitations/invitations.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuthenticatedUser } from '../auth/current-user.decorator.js';

@Injectable()
export class StudentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly invitations: InvitationsService,
    private readonly audit: AuditService,
    @InjectRepository(Student) private readonly studentRepository: Repository<Student>,
  ) {}

  async createStudent(dto: CreateStudentDto, actor: AuthenticatedUser) {
    const email = dto.email.trim().toLowerCase();
    try {
      return await this.dataSource.transaction(async (manager) => {
        const users = manager.getRepository(User);
        const students = manager.getRepository(Student);
        if (await users.findOne({ where: { email } }) || await students.findOne({ where: { email } })) {
          throw new ConflictException('Email is already registered.');
        }
        const user = await users.save(users.create({
          email, passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
          accountType: AccountType.STUDENT, status: AccountStatus.PENDING,
        }));
        const student = await students.save(students.create({ user, email, firstName: dto.firstName.trim(), lastName: dto.lastName.trim() }));
        const invitation = await this.invitations.createFor(manager, user, actor.userId);
        await this.audit.record({ actorUserId: actor.userId, action: 'student.registered', targetType: 'student', targetId: student.id }, manager);
        return { ...this.toResponse(student), invitation: { id: invitation.id, expiresAt: invitation.expiresAt, status: 'pending_delivery' } };
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (this.isUniqueViolation(error)) throw new ConflictException('Email is already registered.');
      throw error;
    }
  }

  async findAll() {
    return (await this.studentRepository.find({ relations: { user: true }, order: { id: 'ASC' } })).map((student) => this.toResponse(student));
  }

  async findOne(id: number, actor: AuthenticatedUser) {
    const student = await this.studentRepository.findOne({ where: { id }, relations: { user: true } });
    if (!student) throw new NotFoundException('Student profile not found.');
    this.assertMayRead(student, actor);
    return this.toResponse(student);
  }

  async findMine(actor: AuthenticatedUser) {
    const student = await this.studentRepository.findOne({ where: { user: { id: actor.userId } }, relations: { user: true } });
    if (!student) throw new ConflictException('Account setup is incomplete. Contact an administrator.');
    return this.toResponse(student);
  }

  async updateStudent(id: number, dto: UpdateStudentDto, actor: AuthenticatedUser) {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const student = await manager.getRepository(Student).findOne({ where: { id }, relations: { user: true } });
        if (!student) throw new NotFoundException('Student profile not found.');
        const before = { email: student.email, firstName: student.firstName, lastName: student.lastName };
        if (dto.email !== undefined) {
          const email = dto.email.trim().toLowerCase();
          const users = manager.getRepository(User);
          const otherUser = await users.findOne({ where: { email } });
          if (otherUser && otherUser.id !== student.user?.id) throw new ConflictException('Email is already registered.');
          const otherStudent = await manager.getRepository(Student).findOne({ where: { email } });
          if (otherStudent && otherStudent.id !== student.id) throw new ConflictException('Email is already registered.');
          student.email = email;
          if (student.user) {
            student.user.email = email;
            await users.save(student.user);
          }
        }
        if (dto.firstName !== undefined) student.firstName = dto.firstName.trim();
        if (dto.lastName !== undefined) student.lastName = dto.lastName.trim();
        await manager.getRepository(Student).save(student);
        await this.audit.record({ actorUserId: actor.userId, action: 'student.profile_updated', targetType: 'student', targetId: id, changes: { before, after: { email: student.email, firstName: student.firstName, lastName: student.lastName } } }, manager);
        return this.toResponse(student);
      });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) throw error;
      if (this.isUniqueViolation(error)) throw new ConflictException('Email is already registered.');
      throw error;
    }
  }

  async setStatus(id: number, dto: UpdateAccountStatusDto, actor: AuthenticatedUser) {
    return this.dataSource.transaction(async (manager) => {
      const student = await manager.getRepository(Student).findOne({ where: { id }, relations: { user: true } });
      if (!student || !student.user) throw new NotFoundException('Linked Student account not found.');
      const previous = student.user.status;
      const allowed: Record<AccountStatus, AccountStatus[]> = {
        [AccountStatus.PENDING]: [], [AccountStatus.ACTIVE]: [AccountStatus.INACTIVE, AccountStatus.SUSPENDED],
        [AccountStatus.INACTIVE]: [AccountStatus.ACTIVE], [AccountStatus.SUSPENDED]: [AccountStatus.ACTIVE, AccountStatus.INACTIVE],
      };
      if (!allowed[previous].includes(dto.status)) throw new BadRequestException(`Invalid account status transition: ${previous} to ${dto.status}.`);
      if (dto.status === AccountStatus.SUSPENDED && !dto.reason?.trim()) throw new BadRequestException('A reason is required when suspending an account.');
      student.user.status = dto.status;
      await manager.getRepository(User).save(student.user);
      await this.audit.record({ actorUserId: actor.userId, action: `student.status_${dto.status}`, targetType: 'student', targetId: id, reason: dto.reason?.trim() ?? null, changes: { before: { status: previous }, after: { status: dto.status } } }, manager);
      return { id, userId: student.user.id, status: dto.status };
    });
  }

  private assertMayRead(student: Student, actor: AuthenticatedUser) {
    if (actor.accountType === AccountType.STUDENT && student.user?.id !== actor.userId) {
      throw new ForbiddenException('You can only access your own Student profile.');
    }
  }

  private toResponse(student: Student) {
    return {
      id: student.id, userId: student.user?.id ?? null, firstName: student.firstName, lastName: student.lastName,
      email: student.email, status: student.user?.status ?? null,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
  }
}
