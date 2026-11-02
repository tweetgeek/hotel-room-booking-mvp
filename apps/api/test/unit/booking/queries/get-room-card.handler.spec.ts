import {
  GetRoomCardHandler,
  GetRoomCardQuery,
} from '../../../../src/booking/application/queries/get-room-card.query';
import { NotFoundError } from '../../../../src/shared/domain/errors/not-found.error';
import { InMemoryReadModelCache } from '../../support/in-memory-read-model-cache';
import { InMemoryReadModelViews, roomCardFixture } from '../../support/in-memory-read-model-views';

describe('GetRoomCardHandler', () => {
  it('returns one card under room:{id}:card for 600 s', async () => {
    const views = new InMemoryReadModelViews();
    views.rooms.push(roomCardFixture(2, { name: 'Pokój rodzinny', pricePerNight: 45000 }));
    const cache = new InMemoryReadModelCache();

    const card = await new GetRoomCardHandler(views, cache).execute(new GetRoomCardQuery(2));

    expect(card).toMatchObject({ id: 2, name: 'Pokój rodzinny', pricePerNight: 45000, checkInTime: '15:00' });
    expect(cache.loads).toEqual(['room:2:card']);
    expect(cache.ttlOf('room:2:card')).toBe(600);
  });

  it('throws NotFoundError for an unknown room and caches nothing', async () => {
    const cache = new InMemoryReadModelCache();
    const handler = new GetRoomCardHandler(new InMemoryReadModelViews(), cache);

    await expect(handler.execute(new GetRoomCardQuery(9))).rejects.toBeInstanceOf(NotFoundError);
    expect(cache.entries.size).toBe(0);
  });
});
