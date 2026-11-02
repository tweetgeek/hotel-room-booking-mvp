import request from 'supertest';
import { createTestApp, type TestApp } from './support/create-test-app';
import { truncateAll } from './support/test-database';
import { flushTestRedis } from './support/test-redis';

describe('GET /rooms (HTTP)', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await truncateAll(app.db);
    await flushTestRedis();
  });
  afterAll(() => app.close());

  it('lists the three rooms, serves one card and answers 404 with a code for an unknown room', async () => {
    const server = app.app.getHttpServer();
    const list = await request(server).get('/rooms').expect(200);
    expect(list.body.map((r: { id: number }) => r.id)).toEqual([1, 2, 3]);

    const card = await request(server).get('/rooms/2').expect(200);
    expect(card.body).toMatchObject({
      id: 2,
      name: 'Pokój rodzinny',
      features: ['wifi', 'tv', 'crib', 'kettle'],
    });

    const missing = await request(server).get('/rooms/9').expect(404);
    expect(missing.body).toEqual({ code: 'NOT_FOUND', message: 'Room not found.' });

    const badId = await request(server).get('/rooms/abc').expect(422);
    expect(badId.body.details).toEqual([{ field: 'roomId', code: 'INVALID_FORMAT' }]);
  });

  it('validates the blocked-nights range with field codes', async () => {
    const server = app.app.getHttpServer();
    await app
      .db('rm_room_nights')
      .insert({ room_id: 1, night: '2026-11-05', reservation_id: 'RES-AAAAAA', status: 'held' });

    const ok = await request(server).get('/rooms/1/blocked-nights?from=2026-11-01&to=2026-11-30').expect(200);
    expect(ok.body).toEqual({ roomId: 1, nights: [{ night: '2026-11-05', status: 'held' }] });

    const badDate = await request(server)
      .get('/rooms/1/blocked-nights?from=2026-02-30&to=2026-03-01')
      .expect(422);
    expect(badDate.body.details).toContainEqual({ field: 'from', code: 'INVALID_DATE' });

    const tooLong = await request(server)
      .get('/rooms/1/blocked-nights?from=2026-11-01&to=2027-03-01')
      .expect(422);
    expect(tooLong.body.details).toContainEqual({ field: 'to', code: 'INVALID_FORMAT' });
  });
});
