import { request } from './client';

export interface RoomCard {
  id: number;
  name: string;
  description: string;
  features: string[];
  pricePerNight: number;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  imageUrl: string | null;
}

export type BlockedNightStatus = 'held' | 'confirmed';

export interface BlockedNightsResponse {
  roomId: number;
  nights: Array<{ night: string; status: BlockedNightStatus }>;
}

export const fetchRooms = (): Promise<RoomCard[]> => request('/rooms');

export const fetchRoom = (roomId: number): Promise<RoomCard> => request(`/rooms/${roomId}`);

export const fetchBlockedNights = (
  roomId: number,
  from: string,
  to: string,
): Promise<BlockedNightsResponse> => request(`/rooms/${roomId}/blocked-nights?from=${from}&to=${to}`);
