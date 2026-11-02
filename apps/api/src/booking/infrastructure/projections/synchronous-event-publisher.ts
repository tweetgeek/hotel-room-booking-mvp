import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { EventCommitted } from '../../../shared/application/event-committed';
import type { StoredEvent } from '../../../shared/domain/domain-event';
import type { EventPublisher } from '../../application/ports/event-publisher';
import { ProjectionRunner } from './projection-runner';

/**
 * Projections run in-process and are awaited before the command answers, so a guest never reads
 * a stale status right after their own command (ADR-004). Other subscribers get the EventBus envelope.
 */
@Injectable()
export class SynchronousEventPublisher implements EventPublisher {
  constructor(
    private readonly runner: ProjectionRunner,
    private readonly eventBus: EventBus,
  ) {}

  async publish(events: readonly StoredEvent[]): Promise<void> {
    await this.runner.project(events);
    for (const stored of events) this.eventBus.publish(new EventCommitted(stored));
  }
}
