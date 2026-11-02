<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  fetchPayment,
  type DecisionDelay,
  type PaymentOutcome,
  type PaymentView,
} from '../api/payment-operator';
import { pl } from '../i18n/pl';
import { formatDate } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { useReservationStore } from '../stores/reservation.store';
import { useRoomStore } from '../stores/room.store';

const router = useRouter();
const reservation = useReservationStore();
const rooms = useRoomStore();

const delay = ref<DecisionDelay>(3);
const busy = ref(false);
const expired = ref(false);
const payment = ref<PaymentView | null>(null);

const amount = computed(() => {
  if (reservation.draft) return formatMoney(reservation.draft.totalAmount, reservation.draft.currency);
  if (payment.value) return formatMoney(payment.value.amount, payment.value.currency);
  return null;
});
const stay = computed(() => reservation.draft ?? payment.value);
const reservationId = computed(() => reservation.current?.id ?? pl.ui.payment.creating);
const roomId = computed(() => reservation.roomId ?? rooms.current?.id ?? null);

onMounted(async () => {
  // Refresh without a draft (page reload): the operator screen is rebuilt from the API
  if (!reservation.draft && reservation.current?.paymentId) {
    try {
      payment.value = await fetchPayment(reservation.current.paymentId);
      if (payment.value.status !== 'PendingPayment') expired.value = true;
    } catch {
      await router.replace('/');
    }
  }
});

async function decide(outcome: PaymentOutcome): Promise<void> {
  busy.value = true;
  const accepted = await reservation.decide(outcome, delay.value);
  busy.value = false;
  if (!accepted) {
    if (reservation.error === 'RESERVATION_NOT_PENDING') expired.value = true;
    return;
  }
  if (outcome === 'abandoned') {
    await router.replace(roomId.value ? `/rooms/${roomId.value}/book` : '/');
    return;
  }
  await router.replace(`/reservations/${reservation.current?.id}`);
}
</script>

<template>
  <main class="page payment">
    <h1>{{ pl.ui.payment.title }}</h1>

    <section v-if="expired" class="banner warning">
      <p>{{ pl.ui.payment.expired }}</p>
      <RouterLink class="button" :to="roomId ? `/rooms/${roomId}` : '/'">{{
        pl.ui.payment.backToRoom
      }}</RouterLink>
    </section>

    <template v-else>
      <section class="card">
        <div class="card-body">
          <dl class="summary-list">
            <dt>{{ pl.ui.payment.amount }}</dt>
            <dd class="amount">{{ amount }}</dd>
            <dt>{{ pl.ui.payment.stay }}</dt>
            <dd v-if="stay">{{ formatDate(stay.checkIn) }} – {{ formatDate(stay.checkOut) }}</dd>
            <dt>{{ pl.ui.payment.reservation }}</dt>
            <dd>
              <code>{{ reservationId }}</code>
            </dd>
          </dl>
        </div>
      </section>

      <p
        v-if="reservation.error && reservation.error !== 'RESERVATION_NOT_PENDING'"
        class="banner error"
        role="alert"
      >
        {{ reservation.errorMessage }}
      </p>

      <fieldset class="delay">
        <legend>{{ pl.ui.payment.delay }}</legend>
        <label v-for="option in [0, 3, 10]" :key="option" class="delay-option">
          <input v-model="delay" type="radio" name="delay" :value="option" />
          <span>{{ option }} {{ pl.ui.payment.seconds }}</span>
        </label>
      </fieldset>

      <div class="actions">
        <button type="button" class="button primary block" :disabled="busy" @click="decide('paid')">
          {{ pl.ui.payment.pay }}
        </button>
        <button type="button" class="button danger block" :disabled="busy" @click="decide('rejected')">
          {{ pl.ui.payment.reject }}
        </button>
        <button type="button" class="button block" :disabled="busy" @click="decide('abandoned')">
          {{ pl.ui.payment.abandon }}
        </button>
      </div>
    </template>
  </main>
</template>
