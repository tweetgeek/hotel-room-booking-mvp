import {
  ListRoomsHandler,
  ListRoomsQuery,
} from '../../../../src/booking/application/queries/list-rooms.query';
import { InMemoryReadModelCache } from '../../support/in-memory-read-model-cache';
import { InMemoryReadModelViews, roomCardFixture } from '../../support/in-memory-read-model-views';

describe('ListRoomsHandler', () => {
  it('returns the three room cards through the cache under rooms:list for 600 s', async () => {
    const views = new InMemoryReadModelViews();
    views.rooms.push(roomCardFixture(1), roomCardFixture(2), roomCardFixture(3));
    const cache = new InMemoryReadModelCache();
    const handler = new ListRoomsHandler(views, cache);

    const cards = await handler.execute(new ListRoomsQuery());

    expect(cards.map((c) => c.id)).toEqual([1, 2, 3]);
    expect(cache.loads).toEqual(['rooms:list']);
    expect(cache.ttlOf('rooms:list')).toBe(600);
  });

  it('serves the second call from the cache', async () => {
    const views = new InMemoryReadModelViews();
    views.rooms.push(roomCardFixture(1));
    const cache = new InMemoryReadModelCache();
    const handler = new ListRoomsHandler(views, cache);

    await handler.execute(new ListRoomsQuery());
    views.rooms.length = 0;
    const cards = await handler.execute(new ListRoomsQuery());

    expect(cards).toHaveLength(1);
    expect(cache.loads).toHaveLength(1);
  });
});
