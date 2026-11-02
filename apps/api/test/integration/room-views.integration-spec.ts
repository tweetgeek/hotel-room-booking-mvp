import type { Knex } from 'knex';
import { connectTestDatabase, truncateAll } from './support/test-database';
import { KnexReadModelViews } from '../../src/booking/infrastructure/read-models/knex-read-model-views';

describe('KnexReadModelViews (rooms)', () => {
  let db: Knex;
  let views: KnexReadModelViews;

  beforeAll(() => {
    db = connectTestDatabase();
    views = new KnexReadModelViews(db);
  });
  beforeEach(() => truncateAll(db));
  afterAll(() => db.destroy());

  it('reads the three seeded room cards from v_room_card with features as arrays', async () => {
    const cards = await views.roomCards();
    expect(cards.map((c) => c.id)).toEqual([1, 2, 3]);
    expect(cards[0]).toMatchObject({
      name: 'Pokój dwuosobowy z balkonem',
      features: ['balcony', 'wifi', 'tv'],
      pricePerNight: 32000,
      currency: 'PLN',
      checkInTime: '15:00',
      checkOutTime: '11:00',
      imageUrl: null,
    });
    expect(await views.roomCard(3)).toMatchObject({ id: 3, pricePerNight: 62000 });
    expect(await views.roomCard(42)).toBeNull();
  });

  it('filters blocked nights by room and inclusive date range from v_room_blocked_nights', async () => {
    await db('rm_room_nights').insert([
      { room_id: 1, night: '2026-11-05', reservation_id: 'RES-AAAAAA', status: 'held' },
      { room_id: 1, night: '2026-11-06', reservation_id: 'RES-AAAAAA', status: 'confirmed' },
      { room_id: 1, night: '2026-11-30', reservation_id: 'RES-BBBBBB', status: 'held' },
      { room_id: 1, night: '2026-12-01', reservation_id: 'RES-BBBBBB', status: 'held' },
      { room_id: 2, night: '2026-11-05', reservation_id: 'RES-CCCCCC', status: 'held' },
    ]);

    const nights = await views.blockedNights(1, '2026-11-01', '2026-11-30');

    expect(nights).toEqual([
      { night: '2026-11-05', status: 'held' },
      { night: '2026-11-06', status: 'confirmed' },
      { night: '2026-11-30', status: 'held' },
    ]);
  });
});
