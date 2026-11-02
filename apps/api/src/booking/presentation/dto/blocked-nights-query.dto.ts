import { IsDefined } from 'class-validator';
import { IsCalendarDate, IsRangeEndWithin } from './validators';

// Three calendar months never exceed 93 days (contracts/openapi.yaml)
export const MAX_BLOCKED_NIGHTS_RANGE_DAYS = 93;

export class BlockedNightsQueryDto {
  @IsDefined({ message: 'REQUIRED' })
  @IsCalendarDate()
  from!: string;

  @IsDefined({ message: 'REQUIRED' })
  @IsCalendarDate()
  @IsRangeEndWithin('from', MAX_BLOCKED_NIGHTS_RANGE_DAYS)
  to!: string;
}
