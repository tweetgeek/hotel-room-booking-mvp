import { defineStore } from 'pinia';
import { fetchBlockedNights, fetchRoom, fetchRooms, type RoomCard } from '../api/rooms';
import { nightsBetween } from '../lib/dates';

export type NightState = 'held' | 'confirmed' | 'optimistic';
export type RoomNights = Record<string, NightState>;

interface RoomState {
  rooms: RoomCard[];
  current: RoomCard | null;
  blockedNights: Record<string, RoomNights>;
  loading: boolean;
  error: string | null;
}

const errorCode = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : 'UNKNOWN_ERROR';

export const useRoomStore = defineStore('rooms', {
  state: (): RoomState => ({ rooms: [], current: null, blockedNights: {}, loading: false, error: null }),

  getters: {
    isNightBlocked: (state) => (roomId: number, night: string) =>
      Boolean(state.blockedNights[String(roomId)]?.[night]),
    nightsBetween: () => (checkIn: string, checkOut: string) => nightsBetween(checkIn, checkOut),
  },

  actions: {
    async loadRooms() {
      await this.track(async () => {
        this.rooms = await fetchRooms();
      });
    },

    async loadRoom(roomId: number) {
      await this.track(async () => {
        this.current = await fetchRoom(roomId);
      });
    },

    async loadBlockedNights(roomId: number, from: string, to: string) {
      await this.track(async () => {
        const response = await fetchBlockedNights(roomId, from, to);
        const nights: RoomNights = {};
        for (const { night, status } of response.nights) nights[night] = status;
        this.blockedNights[String(roomId)] = nights;
      });
    },

    // Optimistic hold: the calendar shows the nights as taken before the server answers (ADR-008)
    holdNightsLocally(roomId: number, nights: string[]) {
      const room = (this.blockedNights[String(roomId)] ??= {});
      for (const night of nights) room[night] = 'optimistic';
    },

    releaseNightsLocally(roomId: number, nights: string[]) {
      const room = this.blockedNights[String(roomId)];
      if (!room) return;
      for (const night of nights) {
        if (room[night] === 'optimistic') delete room[night];
      }
    },

    async track(work: () => Promise<void>) {
      this.loading = true;
      this.error = null;
      try {
        await work();
      } catch (error) {
        this.error = errorCode(error);
      } finally {
        this.loading = false;
      }
    },
  },
});
