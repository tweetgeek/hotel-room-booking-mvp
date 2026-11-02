import {
  GetBlockedNightsHandler,
  GetBlockedNightsQuery,
} from '../../../../src/booking/application/queries/get-blocked-nights.query';
import { InMemoryReadModelCache } from '../../support/in-memory-read-model-cache';
import { InMemoryReadModelViews } from '../../support/in-memory-read-model-views';

describe('GetBlockedNightsHandler', () => {
  it('returns held and confirmed nights of the room inside the range, cached for 60 s', async () => {
    const views = new InMemoryReadModelViews();
    views.roomNights.push(
      { roomId: 1, night: '2026-11-05', reservationId: 'RES-AAAAAA', status: 'held' },
      { roomId: 1, night: '2026-11-06', reservationId: 'RES-AAAAAA', status: 'confirmed' },
      { roomId: 1, night: '2026-12-01', reservationId: 'RES-BBBBBB', status: 'held' },
      { roomId: 2, night: '2026-11-05', reservationId: 'RES-CCCCCC', status: 'held' },
    );
    const cache = new InMemoryReadModelCache();

    const result = await new GetBlockedNightsHandler(views, cache).execute(
      new GetBlockedNightsQuery(1, '2026-11-01', '2026-11-30'),
    );

    expect(result).toEqual({
      roomId: 1,
      nights: [
        { night: '2026-11-05', status: 'held' },
        { night: '2026-11-06', status: 'confirmed' },
      ],
    });
    expect(cache.loads).toEqual(['room:1:nights:2026-11-01:2026-11-30']);
    expect(cache.ttlOf('room:1:nights:2026-11-01:2026-11-30')).toBe(60);
  });
});
