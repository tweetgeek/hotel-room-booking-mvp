import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useRoomStore } from '../../src/stores/room.store';
import * as roomsApi from '../../src/api/rooms';

vi.mock('../../src/api/rooms', () => ({
  fetchRooms: vi.fn(),
  fetchRoom: vi.fn(),
  fetchBlockedNights: vi.fn(),
}));

const card = (id: number) => ({
  id,
  name: `Pokój ${id}`,
  description: '',
  features: ['wifi'],
  pricePerNight: 32000,
  currency: 'PLN',
  checkInTime: '15:00',
  checkOutTime: '11:00',
  imageUrl: null,
});

describe('useRoomStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(roomsApi.fetchRooms).mockReset();
    vi.mocked(roomsApi.fetchRoom).mockReset();
    vi.mocked(roomsApi.fetchBlockedNights).mockReset();
  });

  it('loads the room list and a single room', async () => {
    vi.mocked(roomsApi.fetchRooms).mockResolvedValue([card(1), card(2), card(3)]);
    vi.mocked(roomsApi.fetchRoom).mockResolvedValue(card(2));
    const store = useRoomStore();

    await store.loadRooms();
    await store.loadRoom(2);

    expect(store.rooms.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(store.current?.id).toBe(2);
    expect(store.error).toBeNull();
  });

  it('maps blocked nights per room and exposes isNightBlocked', async () => {
    vi.mocked(roomsApi.fetchBlockedNights).mockResolvedValue({
      roomId: 1,
      nights: [
        { night: '2026-11-05', status: 'held' },
        { night: '2026-11-06', status: 'confirmed' },
      ],
    });
    const store = useRoomStore();

    await store.loadBlockedNights(1, '2026-11-01', '2027-01-31');

    expect(roomsApi.fetchBlockedNights).toHaveBeenCalledWith(1, '2026-11-01', '2027-01-31');
    expect(store.isNightBlocked(1, '2026-11-05')).toBe(true);
    expect(store.isNightBlocked(1, '2026-11-07')).toBe(false);
    expect(store.isNightBlocked(2, '2026-11-05')).toBe(false);
    expect(store.blockedNights['1']).toEqual({ '2026-11-05': 'held', '2026-11-06': 'confirmed' });
  });

  it('holds and releases nights locally without touching other nights', () => {
    const store = useRoomStore();
    store.blockedNights['1'] = { '2026-11-05': 'held' };

    store.holdNightsLocally(1, ['2026-11-10', '2026-11-11']);
    expect(store.blockedNights['1']).toEqual({
      '2026-11-05': 'held',
      '2026-11-10': 'optimistic',
      '2026-11-11': 'optimistic',
    });
    expect(store.isNightBlocked(1, '2026-11-10')).toBe(true);

    store.releaseNightsLocally(1, ['2026-11-10', '2026-11-11']);
    expect(store.blockedNights['1']).toEqual({ '2026-11-05': 'held' });
  });

  it('records an error code when loading fails', async () => {
    vi.mocked(roomsApi.fetchRooms).mockRejectedValue(
      Object.assign(new Error('x'), { code: 'NETWORK_ERROR' }),
    );
    const store = useRoomStore();

    await store.loadRooms();

    expect(store.error).toBe('NETWORK_ERROR');
  });

  it('counts nights between two dates', () => {
    expect(useRoomStore().nightsBetween('2026-11-10', '2026-11-13')).toEqual([
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
    ]);
  });
});
