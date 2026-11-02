import { IsIn, IsISO8601, IsOptional, IsString, Matches } from 'class-validator';
import type { PaymentOutcome } from '../../../shared/contracts/webhook-signature';
import { REJECTION_REASONS, type RejectionReason } from '../../domain/rejection-reason';

export class PaymentWebhookDto {
  @Matches(/^PAY-[0-9A-HJKMNP-TV-Z]{10}$/, { message: 'INVALID_FORMAT' })
  paymentId!: string;

  @IsIn(['paid', 'rejected', 'abandoned'], { message: 'INVALID_FORMAT' })
  outcome!: PaymentOutcome;

  @IsOptional()
  @IsIn(REJECTION_REASONS, { message: 'INVALID_FORMAT' })
  reason?: RejectionReason | null;

  @IsISO8601({ strict: true }, { message: 'INVALID_FORMAT' })
  sentAt!: string;

  @IsString({ message: 'REQUIRED' })
  signature!: string;
}
