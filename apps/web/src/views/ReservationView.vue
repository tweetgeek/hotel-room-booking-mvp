<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import ReservationTimeline from '../components/ReservationTimeline.vue';
import SecureCodeGate from '../components/SecureCodeGate.vue';
import SaveDetailsCard from '../components/SaveDetailsCard.vue';
import StatusBanner from '../components/StatusBanner.vue';
import { pl } from '../i18n/pl';
import { formatDate } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { useReservationStore } from '../stores/reservation.store';

const route = useRoute();
const reservation = useReservationStore();
const reservationId = String(route.params.reservationId);

const current = computed(() => reservation.current);
const details = computed(() => reservation.current?.details ?? null);
const notFound = computed(() => reservation.error === 'NOT_FOUND');
const permalink = computed(() => `${window.location.origin}/reservations/${reservationId}`);
const roomId = computed(() => reservation.roomId ?? details.value?.room.id ?? null);
const needsCode = computed(
  () => Boolean(current.value) && !reservation.hasAccess && current.value?.status !== 'PendingPayment',
);
const unlocking = ref(false);
const showCancelHint = computed(
  () => details.value?.status === 'Confirmed' && !details.value.cancellable && !reservation.cancelling,
);

async function unlock(code: string): Promise<void> {
  unlocking.value = true;
  await reservation.unlock(code);
  unlocking.value = false;
}

onMounted(async () => {
  reservation.openPermalink(reservationId);
  await reservation.refreshStatus();
  if (reservation.current?.status === 'PendingPayment') {
    reservation.pollStatus();
  } else if (reservation.hasAccess) {
    await reservation.loadDetails();
  }
});

onBeforeUnmount(() => {
  reservation.stopPolling();
  // The code is shown exactly once: leaving the page forgets it (FR-013)
  reservation.forgetSecureCode();
});
</script>

<template>
  <main class="page">
    <section v-if="notFound" class="card">
      <div class="card-body">
        <h1>{{ pl.ui.reservation.notFoundTitle }}</h1>
        <p>{{ pl.ui.reservation.notFoundText }}</p>
        <RouterLink class="button primary" to="/">{{ pl.ui.room.back }}</RouterLink>
      </div>
    </section>

    <SecureCodeGate
      v-else-if="needsCode"
      :busy="unlocking"
      :error="reservation.error"
      :attempts-left="reservation.attemptsLeft"
      :retry-after-seconds="reservation.retryAfterSeconds"
      @submit="unlock"
    />

    <template v-else-if="current">
      <h1>{{ pl.ui.reservation.details }}</h1>
      <p class="muted">
        <code>{{ reservationId }}</code>
      </p>

      <StatusBanner :status="current.status" :reason="details?.reason" :error="reservation.error" />

      <SaveDetailsCard v-if="current.secureCode" :link="permalink" :secure-code="current.secureCode" />

      <section v-if="details" class="card">
        <div class="card-body">
          <dl class="summary-list">
            <dt>{{ pl.ui.reservation.room }}</dt>
            <dd>{{ details.room.name }}</dd>
            <dt>{{ pl.ui.reservation.checkIn }}</dt>
            <dd>
              {{ formatDate(details.checkIn) }}, {{ pl.ui.reservation.from }} {{ details.room.checkInTime }}
            </dd>
            <dt>{{ pl.ui.reservation.checkOut }}</dt>
            <dd>
              {{ formatDate(details.checkOut) }}, {{ pl.ui.reservation.to }} {{ details.room.checkOutTime }}
            </dd>
            <dt>{{ pl.ui.reservation.nights }}</dt>
            <dd>{{ pl.nights(details.nights) }}</dd>
            <dt>{{ pl.ui.reservation.guest }}</dt>
            <dd>{{ details.guestName }}</dd>
            <dt>{{ pl.ui.reservation.email }}</dt>
            <dd>{{ details.guestEmail }}</dd>
            <dt>{{ pl.ui.reservation.amount }}</dt>
            <dd>
              <strong>{{ formatMoney(details.totalAmount, details.currency) }}</strong>
            </dd>
          </dl>
          <p v-if="details.refundAmount !== null" class="muted">
            {{ pl.ui.reservation.refunded }} {{ formatMoney(details.refundAmount, details.currency) }}
          </p>
          <h2>{{ pl.ui.reservation.history }}</h2>
          <ReservationTimeline :items="details.timeline" />
          <button
            v-if="details.cancellable"
            type="button"
            class="button danger block"
            :disabled="reservation.cancelling"
            @click="reservation.cancel()"
          >
            {{ reservation.cancelling ? pl.ui.reservation.cancelling : pl.ui.reservation.cancel }}
          </button>
          <p v-else-if="showCancelHint" class="muted">{{ pl.ui.reservation.notCancellableToday }}</p>
          <RouterLink
            v-if="['Rejected', 'Expired'].includes(details.status) && roomId"
            class="button primary block"
            :to="`/rooms/${roomId}/book`"
          >
            {{ pl.ui.reservation.bookAgain }}
          </RouterLink>
        </div>
      </section>
    </template>
  </main>
</template>
