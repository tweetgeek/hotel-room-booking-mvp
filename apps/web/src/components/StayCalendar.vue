<script setup lang="ts">
import { computed, ref } from 'vue';
import { monthGrid, nightsBetween, threeMonthsFrom, type IsoDate } from '../lib/dates';
import { pl } from '../i18n/pl';
import type { NightState } from '../stores/room.store';

const MAX_NIGHTS = 30;

const props = defineProps<{ today: IsoDate; blocked: Record<string, NightState> }>();
const emit = defineEmits<{ select: [stay: { checkIn: IsoDate; checkOut: IsoDate; nights: number }] }>();

const checkIn = ref<IsoDate | null>(null);
const checkOut = ref<IsoDate | null>(null);
const message = ref<string | null>(null);

const months = computed(() =>
  threeMonthsFrom(props.today).map(({ year, month }) => ({
    key: `${year}-${String(month).padStart(2, '0')}`,
    label: new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(Date.UTC(year, month - 1, 1)),
    ),
    cells: monthGrid(year, month),
  })),
);

const hint = computed(() =>
  checkIn.value && !checkOut.value ? pl.ui.book.pickCheckOut : pl.ui.book.pickCheckIn,
);

function isDisabled(date: IsoDate): boolean {
  return date < props.today || Boolean(props.blocked[date]);
}

function classesFor(date: IsoDate): Record<string, boolean> {
  const inRange = Boolean(checkIn.value && checkOut.value && date > checkIn.value && date < checkOut.value);
  return {
    'check-in': date === checkIn.value,
    'check-out': date === checkOut.value,
    'in-range': inRange,
    blocked: Boolean(props.blocked[date]),
    past: date < props.today,
  };
}

function pick(date: IsoDate): void {
  if (isDisabled(date)) return;
  message.value = null;

  const startsNewSelection = !checkIn.value || checkOut.value !== null || date <= checkIn.value;
  if (startsNewSelection) {
    checkIn.value = date;
    checkOut.value = null;
    return;
  }

  const nights = nightsBetween(checkIn.value as IsoDate, date);
  if (nights.length > MAX_NIGHTS) {
    message.value = pl.ui.book.tooManyNights;
    return;
  }
  // The spec keeps the original check-in selected when the range crosses a blocked night (US1 scenario 5)
  if (nights.some((night) => props.blocked[night])) {
    message.value = pl.ui.book.rangeBlocked;
    return;
  }

  checkOut.value = date;
  emit('select', { checkIn: checkIn.value as IsoDate, checkOut: date, nights: nights.length });
}

function reset(): void {
  checkIn.value = null;
  checkOut.value = null;
  message.value = null;
}

defineExpose({ reset });
</script>

<template>
  <div class="calendar">
    <p class="calendar-hint">{{ hint }}</p>
    <p v-if="message" class="calendar-message" role="alert">{{ message }}</p>
    <section v-for="month in months" :key="month.key" class="calendar-month" :data-month="month.key">
      <h3>{{ month.label }}</h3>
      <div class="calendar-grid">
        <span v-for="weekday in pl.ui.book.weekdays" :key="weekday" class="calendar-weekday">{{
          weekday
        }}</span>
        <template v-for="(cell, index) in month.cells" :key="`${month.key}-${index}`">
          <span v-if="cell === null" class="calendar-empty" />
          <button
            v-else
            type="button"
            class="calendar-day"
            :class="classesFor(cell)"
            :data-date="cell"
            :disabled="isDisabled(cell)"
            @click="pick(cell)"
          >
            {{ Number(cell.slice(8)) }}
          </button>
        </template>
      </div>
    </section>
    <p class="calendar-legend">
      <span class="legend-swatch blocked" /> {{ pl.ui.book.legendBlocked }}
      <span class="legend-swatch selected" /> {{ pl.ui.book.legendSelected }}
    </p>
  </div>
</template>
