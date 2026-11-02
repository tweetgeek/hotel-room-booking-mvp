export const REJECTION_REASONS = ['rejected_by_operator', 'abandoned_by_guest'] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number];
