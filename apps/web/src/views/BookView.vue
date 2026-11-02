<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import GuestForm from '../components/GuestForm.vue';
import StayCalendar from '../components/StayCalendar.vue';
import { pl } from '../i18n/pl';
import { addDays, formatDate, monthGrid, threeMonthsFrom, todayInWarsaw, type IsoDate } from '../lib/dates';
import { formatMoney } from '../lib/money';
import { useReservationStore } from '../stores/reservation.store';
import { useRoomStore } from '../stores/room.store';

const route = useRoute();
const router = useRouter();
const rooms = useRoomStore();
const reservation = useReservationStore();
const roomId = Number(route.params.roomId);
const today = todayInWarsaw();

const stay = ref<{ checkIn: IsoDate; checkOut: IsoDate; nights: number } | null>(null);
const submitting = ref(false);
const calendar = ref<InstanceType<typeof StayCalendar> | null>(null);

const blocked = computed(() => rooms.blockedNights[String(roomId)] ?? {});
const totalAmount = computed(() =>
  stay.value && rooms.current ? stay.value.nights * rooms.current.pricePerNight : 0,
);
const total = computed(() => (rooms.current ? formatMoney(totalAmount.value, rooms.current.currency) : null));

function visibleRange(): { from: IsoDate; to: IsoDate } {
  const months = threeMonthsFrom(today);
  const first = months[0];
  const last = months[2];
  const lastGrid = monthGrid(last.year, last.month);
  return {
    from: `${first.year}-${String(first.month).padStart(2, '0')}-01`,
    to: lastGrid[lastGrid.length - 1] ?? addDays(today, 92),
  };
}

async function reloadNights(): Promise<void> {
  const { from, to } = visibleRange();
  await rooms.loadBlockedNights(roomId, from, to);
}

onMounted(async () => {
  reservation.clearError();
  await Promise.all([rooms.loadRoom(roomId), reloadNights()]);
});

async function submit(guest: { guestName: string; guestEmail: string }): Promise<void> {
  if (!stay.value || !rooms.current) return;
  submitting.value = true;
  const draft = {
    roomId,
    checkIn: stay.value.checkIn,
    checkOut: stay.value.checkOut,
    nights: stay.value.nights,
    totalAmount: totalAmount.value,
    currency: rooms.current.currency,
    ...guest,
  };
  // Navigate first: the payment screen renders from the draft while the POST is in flight (ADR-008)
  const creating = reservation.create(draft);
  await router.push('/payment');
  const ok = await creating;
  submitting.value = false;
  if (!ok) {
    await router.replace(`/rooms/${roomId}/book`);
    stay.value = null;
    calendar.value?.reset();
    await reloadNights();
  }
}
</script>

<template>
  <main class="page">
    <RouterLink class="back-link" :to="`/rooms/${roomId}`">← {{ pl.ui.book.backToRoom }}</RouterLink>
    <h1>{{ pl.ui.book.title }}</h1>
    <p v-if="rooms.current" class="muted">{{ rooms.current.name }}</p>
    <p v-if="rooms.error" class="banner error">{{ pl.errorMessage(rooms.error) }}</p>
    <p v-if="reservation.error" class="banner error" role="alert">{{ reservation.errorMessage }}</p>

    <StayCalendar ref="calendar" :today="today" :blocked="blocked" @select="stay = $event" />

    <section v-if="stay && rooms.current" class="card summary">
      <h2>{{ pl.ui.book.summary }}</h2>
      <dl>
        <dt>{{ pl.ui.book.checkIn }}</dt>
        <dd>{{ formatDate(stay.checkIn) }}, {{ rooms.current.checkInTime }}</dd>
        <dt>{{ pl.ui.book.checkOut }}</dt>
        <dd>{{ formatDate(stay.checkOut) }}, {{ rooms.current.checkOutTime }}</dd>
        <dt>{{ pl.ui.book.total }}</dt>
        <dd>
          <strong>{{ pl.nights(stay.nights) }} · {{ total }}</strong>
        </dd>
      </dl>
      <GuestForm :disabled="submitting" :server-details="reservation.validationDetails" @submit="submit" />
    </section>
  </main>
</template>
