import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuditEvent } from './entities/audit-event.entity.js';

@Injectable()
export class AuditService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AuditEvent) private readonly events: Repository<AuditEvent>,
  ) {}

  async record(event: Partial<AuditEvent>, manager?: EntityManager): Promise<void> {
    const repository = manager ? manager.getRepository(AuditEvent) : this.events;
    await repository.save(repository.create(event));
  }

  async list(limit = 100, beforeId?: number): Promise<AuditEvent[]> {
    const query = this.events.createQueryBuilder('event').orderBy('event.id', 'DESC').take(Math.min(Math.max(limit, 1), 200));
    if (beforeId) query.andWhere('event.id < :beforeId', { beforeId });
    return query.getMany();
  }
}
