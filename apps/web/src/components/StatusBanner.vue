<script setup lang="ts">
import { computed } from 'vue';
import { pl, type RejectionReason, type ReservationStatus } from '../i18n/pl';

const props = defineProps<{
  status: ReservationStatus;
  reason?: RejectionReason | null;
  error?: string | null;
}>();

const tone = computed(() => {
  if (props.status === 'Confirmed') return 'success';
  if (props.status === 'PendingPayment') return 'info';
  return 'warning';
});

const text = computed(() => {
  switch (props.status) {
    case 'PendingPayment':
      return pl.ui.reservation.waitingText;
    case 'Rejected':
      return props.reason === 'abandoned_by_guest'
        ? pl.ui.reservation.abandonedText
        : pl.ui.reservation.rejectedText;
    case 'Expired':
      return pl.ui.reservation.expiredText;
    case 'Cancelled':
      return pl.ui.reservation.cancelledText;
    default:
      return null;
  }
});
</script>

<template>
  <div>
    <p v-if="error" class="banner error" role="alert">{{ pl.errorMessage(error) }}</p>
    <section class="banner" :class="tone" role="status">
      <strong class="status-chip">{{ pl.statusLabel(status, reason) }}</strong>
      <p v-if="text">{{ text }}</p>
    </section>
  </div>
</template>
