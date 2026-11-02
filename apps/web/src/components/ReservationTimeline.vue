<script setup lang="ts">
import type { TimelineItem } from '../api/reservations';
import { pl } from '../i18n/pl';
import { formatDateTime } from '../lib/dates';

defineProps<{ items: TimelineItem[] }>();
</script>

<template>
  <ol class="timeline">
    <li v-for="item in items" :key="`${item.eventType}-${item.occurredAt}`">
      <span class="timeline-label">{{ pl.timelineLabel(item.eventType, item.reason) }}</span>
      <time class="timeline-time" :datetime="item.occurredAt">{{ formatDateTime(item.occurredAt) }}</time>
    </li>
  </ol>
</template>
