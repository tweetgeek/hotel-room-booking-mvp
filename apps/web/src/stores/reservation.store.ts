import { defineStore } from 'pinia';
import {
  cancelReservation,
  createReservation,
  fetchReservationDetails,
  fetchReservationStatus,
  verifySecureCode,
  type ReservationDetails,
} from '../api/reservations';
import { decidePayment, type DecisionDelay, type PaymentOutcome } from '../api/payment-operator';
import { ApiError, type ValidationDetail } from '../api/client';
import { pl, type ReservationStatus } from '../i18n/pl';
import { nightsBetween } from '../lib/dates';
import { clearSession, loadSession, saveSession } from '../lib/session';
import { useRoomStore } from './room.store';

export interface ReservationDraft {
  roomId: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalAmount: number;
  currency: string;
  guestName: string;
  guestEmail: string;
}

export interface CurrentReservation {
  id: string | null;
  paymentId: string | null;
  status: ReservationStatus;
  optimistic: boolean;
  accessToken: string | null;
  /** Shown once after creation; never persisted (FR-013, FR-019). */
  secureCode: string | null;
  details: ReservationDetails | null;
}

interface QueuedDecision {
  outcome: PaymentOutcome;
  delaySeconds: DecisionDelay;
}

interface ReservationState {
  draft: ReservationDraft | null;
  roomId: number | null;
  current: CurrentReservation | null;
  pendingDecision: QueuedDecision | null;
  error: string | null;
  validationDetails: ValidationDetail[];
  cancelling: boolean;
  attemptsLeft: number | null;
  retryAfterSeconds: number | null;
}

const POLL_INTERVAL_MS = 2000;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let queuedDecisionResolver: ((accepted: boolean) => void) | null = null;

function codeOf(error: unknown): string {
  return error instanceof ApiError ? error.code : 'UNKNOWN_ERROR';
}

/**
 * Optimistic UI rules (ADR-008): creation and cancellation show their result immediately
 * and roll back with a visible message when the server refuses.
 */
export const useReservationStore = defineStore('reservation', {
  state: (): ReservationState => ({
    draft: null,
    roomId: null,
    current: null,
    pendingDecision: null,
    error: null,
    validationDetails: [],
    cancelling: false,
    attemptsLeft: null,
    retryAfterSeconds: null,
  }),

  getters: {
    errorMessage: (state) => (state.error ? pl.errorMessage(state.error) : null),
    hasAccess: (state) => Boolean(state.current?.id && state.current.accessToken),
  },

  actions: {
    async create(draft: ReservationDraft): Promise<boolean> {
      const rooms = useRoomStore();
      const nights = nightsBetween(draft.checkIn, draft.checkOut);
      this.draft = draft;
      this.roomId = draft.roomId;
      this.error = null;
      this.validationDetails = [];
      this.current = {
        id: null,
        paymentId: null,
        status: 'PendingPayment',
        optimistic: true,
        accessToken: null,
        secureCode: null,
        details: null,
      };
      rooms.holdNightsLocally(draft.roomId, nights);

      try {
        const created = await createReservation({
          roomId: draft.roomId,
          checkIn: draft.checkIn,
          checkOut: draft.checkOut,
          guestName: draft.guestName,
          guestEmail: draft.guestEmail,
        });
        this.current = {
          id: created.reservationId,
          paymentId: created.paymentId,
          status: created.status,
          optimistic: false,
          accessToken: created.accessToken,
          secureCode: created.secureCode,
          details: null,
        };
        saveSession({
          reservationId: created.reservationId,
          accessToken: created.accessToken,
          roomId: draft.roomId,
          paymentId: created.paymentId,
        });
        await this.flushQueuedDecision();
        return true;
      } catch (error) {
        rooms.releaseNightsLocally(draft.roomId, nights);
        this.current = null;
        this.error = codeOf(error);
        this.validationDetails = error instanceof ApiError ? error.details : [];
        this.rejectQueuedDecision();
        clearSession();
        return false;
      }
    },

    decide(outcome: PaymentOutcome, delaySeconds: DecisionDelay): Promise<boolean> {
      if (!this.current) return Promise.resolve(false);
      if (!this.current.paymentId) {
        // Clicked while the POST is still in flight: send as soon as the paymentId is known
        this.pendingDecision = { outcome, delaySeconds };
        return new Promise((resolve) => {
          queuedDecisionResolver = resolve;
        });
      }
      return this.sendDecision(this.current.paymentId, outcome, delaySeconds);
    },

    async sendDecision(
      paymentId: string,
      outcome: PaymentOutcome,
      delaySeconds: DecisionDelay,
    ): Promise<boolean> {
      this.error = null;
      try {
        await decidePayment(paymentId, outcome, delaySeconds);
        return true;
      } catch (error) {
        this.error = codeOf(error);
        return false;
      }
    },

    async flushQueuedDecision(): Promise<void> {
      const queued = this.pendingDecision;
      const resolve = queuedDecisionResolver;
      this.pendingDecision = null;
      queuedDecisionResolver = null;
      if (!queued || !this.current?.paymentId) {
        resolve?.(false);
        return;
      }
      const accepted = await this.sendDecision(this.current.paymentId, queued.outcome, queued.delaySeconds);
      resolve?.(accepted);
    },

    rejectQueuedDecision(): void {
      this.pendingDecision = null;
      queuedDecisionResolver?.(false);
      queuedDecisionResolver = null;
    },

    pollStatus(): void {
      this.stopPolling();
      pollTimer = setInterval(() => void this.refreshStatus(), POLL_INTERVAL_MS);
    },

    stopPolling(): void {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    },

    async refreshStatus(): Promise<void> {
      const id = this.current?.id;
      if (!id) return;
      try {
        const { status } = await fetchReservationStatus(id);
        if (!this.current) return;
        this.current.status = status;
        if (status !== 'PendingPayment') {
          this.stopPolling();
          await this.loadDetails();
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          this.stopPolling();
          this.error = 'NOT_FOUND';
        }
      }
    },

    async loadDetails(): Promise<boolean> {
      if (!this.current?.id || !this.current.accessToken) return false;
      try {
        const details = await fetchReservationDetails(this.current.id, this.current.accessToken);
        this.current.details = details;
        this.current.status = details.status;
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          this.current.accessToken = null;
          clearSession();
        } else {
          this.error = codeOf(error);
        }
        return false;
      }
    },

    async unlock(secureCode: string): Promise<boolean> {
      if (!this.current?.id) return false;
      this.error = null;
      this.attemptsLeft = null;
      this.retryAfterSeconds = null;
      try {
        const granted = await verifySecureCode(this.current.id, secureCode);
        this.current.accessToken = granted.accessToken;
        saveSession({
          reservationId: this.current.id,
          accessToken: granted.accessToken,
          roomId: this.roomId ?? this.current.details?.room.id ?? 0,
          paymentId: this.current.paymentId,
        });
        return this.loadDetails();
      } catch (error) {
        this.error = codeOf(error);
        if (error instanceof ApiError) {
          this.attemptsLeft = error.attemptsLeft ?? null;
          this.retryAfterSeconds = error.retryAfterSeconds ?? null;
        }
        return false;
      }
    },

    async cancel(): Promise<boolean> {
      const current = this.current;
      if (!current?.id || !current.accessToken || !current.details) return false;
      const previous = current.details;
      const rooms = useRoomStore();
      this.error = null;
      this.cancelling = true;
      current.details = {
        ...previous,
        status: 'Cancelled',
        cancellable: false,
        refundAmount: previous.totalAmount,
        timeline: [
          ...previous.timeline,
          { eventType: 'ReservationCancelled', occurredAt: new Date().toISOString(), reason: null },
        ],
      };
      current.status = 'Cancelled';
      rooms.releaseNightsLocally(previous.room.id, nightsBetween(previous.checkIn, previous.checkOut));

      const attempt = () => cancelReservation(current.id as string, current.accessToken as string);
      try {
        let details: ReservationDetails;
        try {
          details = await attempt();
        } catch (error) {
          // One retry on a version conflict (contracts/frontend.md, rule 4)
          if (error instanceof ApiError && error.code === 'CONCURRENCY_CONFLICT') details = await attempt();
          else throw error;
        }
        current.details = details;
        current.status = details.status;
        return true;
      } catch (error) {
        current.details = previous;
        current.status = previous.status;
        this.error = codeOf(error);
        return false;
      } finally {
        this.cancelling = false;
      }
    },

    forgetSecureCode(): void {
      if (this.current) this.current.secureCode = null;
    },

    restoreFromSession(): boolean {
      const session = loadSession();
      if (!session) return false;
      this.roomId = session.roomId;
      this.current = {
        id: session.reservationId,
        paymentId: session.paymentId,
        status: 'PendingPayment',
        optimistic: false,
        accessToken: session.accessToken,
        secureCode: null,
        details: null,
      };
      return true;
    },

    openPermalink(reservationId: string): void {
      if (this.current?.id === reservationId) return;
      const session = loadSession();
      this.current = {
        id: reservationId,
        paymentId: session?.reservationId === reservationId ? session.paymentId : null,
        status: 'PendingPayment',
        optimistic: false,
        accessToken: session?.reservationId === reservationId ? session.accessToken : null,
        secureCode: null,
        details: null,
      };
      this.roomId = session?.reservationId === reservationId ? session.roomId : null;
    },

    clearError(): void {
      this.error = null;
    },
  },
});
