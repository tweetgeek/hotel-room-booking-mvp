import { request } from './client';
import type { EventType, RejectionReason, ReservationStatus } from '../i18n/pl';

export interface CreateReservationRequest {
  roomId: number;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string;
}

export interface CreateReservationResponse {
  reservationId: string;
  paymentId: string;
  secureCode: string;
  accessToken: string;
  status: ReservationStatus;
  totalAmount: number;
  currency: string;
  nights: number;
}

export interface ReservationStatusResponse {
  reservationId: string;
  status: ReservationStatus;
  reason: RejectionReason | null;
}

export interface TimelineItem {
  eventType: EventType;
  occurredAt: string;
  reason: RejectionReason | null;
}

export interface ReservationDetails {
  reservationId: string;
  status: ReservationStatus;
  room: { id: number; name: string; checkInTime: string; checkOutTime: string };
  checkIn: string;
  checkOut: string;
  nights: number;
  guestName: string;
  guestEmail: string;
  totalAmount: number;
  currency: string;
  reason: RejectionReason | null;
  refundAmount: number | null;
  cancellable: boolean;
  timeline: TimelineItem[];
}

export interface AccessGranted {
  accessToken: string;
  expiresInSeconds: number;
}

export const createReservation = (body: CreateReservationRequest): Promise<CreateReservationResponse> =>
  request('/reservations', { method: 'POST', body });

export const fetchReservationStatus = (reservationId: string): Promise<ReservationStatusResponse> =>
  request(`/reservations/${reservationId}/status`);

export const fetchReservationDetails = (
  reservationId: string,
  accessToken: string,
): Promise<ReservationDetails> => request(`/reservations/${reservationId}`, { accessToken });

export const verifySecureCode = (reservationId: string, secureCode: string): Promise<AccessGranted> =>
  request(`/reservations/${reservationId}/access`, { method: 'POST', body: { secureCode } });

export const cancelReservation = (reservationId: string, accessToken: string): Promise<ReservationDetails> =>
  request(`/reservations/${reservationId}/cancel`, { method: 'POST', accessToken });
