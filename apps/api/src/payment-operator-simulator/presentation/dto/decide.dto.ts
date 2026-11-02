import { IsIn } from 'class-validator';
import type { PaymentOutcome } from '../../../shared/contracts/webhook-signature';

export const DECISION_DELAYS = [0, 3, 10] as const;

export class DecideDto {
  @IsIn(['paid', 'rejected', 'abandoned'], { message: 'INVALID_FORMAT' })
  outcome!: PaymentOutcome;

  @IsIn(DECISION_DELAYS, { message: 'INVALID_FORMAT' })
  delaySeconds!: (typeof DECISION_DELAYS)[number];
}
