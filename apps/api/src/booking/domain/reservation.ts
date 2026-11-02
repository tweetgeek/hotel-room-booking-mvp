import { AggregateRoot } from '../../shared/domain/aggregate-root';
import { CalendarDate } from '../../shared/domain/calendar-date';
import type { EventMetadata } from '../../shared/domain/domain-event';
import { PaymentId, ReservationId, RoomId } from '../../shared/domain/ids';
import { Money } from '../../shared/domain/money';
import { ReservationNotCancellableError } from './errors/reservation-not-cancellable.error';
import {
  PaymentConfirmed,
  PaymentRejected,
  ReservationCancelled,
  ReservationExpired,
  ReservationRequested,
  type ReservationEvent,
} from './events';
import { GuestDetails } from './guest-details';
import type { RejectionReason } from './rejection-reason';
import { ReservationStatus } from './reservation-status';
import { Stay } from './stay';

export interface RequestReservation {
  id: ReservationId;
  roomId: RoomId;
  stay: Stay;
  guest: GuestDetails;
  pricePerNight: Money;
  secureCodeHash: string;
  paymentId: PaymentId;
  metadata: EventMetadata;
}

/**
 * One reservation = one event stream. State lives only in `apply`, so `fromHistory`
 * and live commands always agree (constitution III, ADR-002).
 */
export class Reservation extends AggregateRoot<ReservationEvent> {
  private _id!: ReservationId;
  private _roomId!: RoomId;
  private _stay!: Stay;
  private _guest!: GuestDetails;
  private _totalAmount!: Money;
  private _secureCodeHash!: string;
  private _paymentId!: PaymentId;
  private _status!: ReservationStatus;
  private _rejectionReason: RejectionReason | null = null;

  static request(params: RequestReservation): Reservation {
    const reservation = new Reservation();
    const totalAmount = params.pricePerNight.multiply(params.stay.nightCount);
    reservation.raise(
      new ReservationRequested(
        {
          reservationId: params.id.value,
          roomId: params.roomId.value,
          checkIn: params.stay.checkIn.value,
          checkOut: params.stay.checkOut.value,
          nights: params.stay.nightCount,
          guestName: params.guest.name,
          guestEmail: params.guest.email,
          totalAmount: totalAmount.amount,
          currency: totalAmount.currency,
          secureCodeHash: params.secureCodeHash,
          paymentId: params.paymentId.value,
        },
        params.metadata,
      ),
    );
    return reservation;
  }

  static fromHistory(history: readonly ReservationEvent[]): Reservation {
    const reservation = new Reservation();
    reservation.replay(history);
    return reservation;
  }

  get id(): ReservationId {
    return this._id;
  }
  get roomId(): RoomId {
    return this._roomId;
  }
  get stay(): Stay {
    return this._stay;
  }
  get guest(): GuestDetails {
    return this._guest;
  }
  get totalAmount(): Money {
    return this._totalAmount;
  }
  get secureCodeHash(): string {
    return this._secureCodeHash;
  }
  get paymentId(): PaymentId {
    return this._paymentId;
  }
  get status(): ReservationStatus {
    return this._status;
  }
  get rejectionReason(): RejectionReason | null {
    return this._rejectionReason;
  }

  // Payment decisions and expiry are idempotent: a late or repeated decision changes nothing (FR-010)
  confirmPayment(paymentId: PaymentId, metadata: EventMetadata): boolean {
    if (this._status !== ReservationStatus.PendingPayment) return false;
    this.raise(new PaymentConfirmed({ reservationId: this._id.value, paymentId: paymentId.value }, metadata));
    return true;
  }

  rejectPayment(paymentId: PaymentId, reason: RejectionReason, metadata: EventMetadata): boolean {
    if (this._status !== ReservationStatus.PendingPayment) return false;
    this.raise(
      new PaymentRejected({ reservationId: this._id.value, paymentId: paymentId.value, reason }, metadata),
    );
    return true;
  }

  expire(metadata: EventMetadata): boolean {
    if (this._status !== ReservationStatus.PendingPayment) return false;
    this.raise(new ReservationExpired({ reservationId: this._id.value }, metadata));
    return true;
  }

  // Cancellation is a deliberate guest action, so unlike decisions it answers with an error (FR-018)
  cancel(today: CalendarDate, metadata: EventMetadata): void {
    if (this._status !== ReservationStatus.Confirmed) {
      throw new ReservationNotCancellableError(`status is ${this._status}`);
    }
    if (!today.isBefore(this._stay.checkIn)) {
      throw new ReservationNotCancellableError('check-in day has arrived');
    }
    this.raise(
      new ReservationCancelled(
        {
          reservationId: this._id.value,
          refundAmount: this._totalAmount.amount,
          currency: this._totalAmount.currency,
        },
        metadata,
      ),
    );
  }

  protected apply(event: ReservationEvent): void {
    switch (event.eventType) {
      case 'ReservationRequested': {
        const p = event.payload;
        this._id = ReservationId.of(p.reservationId);
        this._roomId = RoomId.of(p.roomId);
        this._stay = Stay.fromHistory(p.checkIn, p.checkOut);
        this._guest = GuestDetails.create(p.guestName, p.guestEmail);
        this._totalAmount = Money.of(p.totalAmount, p.currency as 'PLN');
        this._secureCodeHash = p.secureCodeHash;
        this._paymentId = PaymentId.of(p.paymentId);
        this._status = ReservationStatus.PendingPayment;
        return;
      }
      case 'PaymentConfirmed':
        this._status = ReservationStatus.Confirmed;
        return;
      case 'PaymentRejected':
        this._status = ReservationStatus.Rejected;
        this._rejectionReason = event.payload.reason;
        return;
      case 'ReservationExpired':
        this._status = ReservationStatus.Expired;
        return;
      case 'ReservationCancelled':
        this._status = ReservationStatus.Cancelled;
        return;
    }
  }
}
