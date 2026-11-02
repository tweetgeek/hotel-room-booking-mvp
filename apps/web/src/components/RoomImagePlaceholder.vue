<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ name: string; roomId: number }>();

// Rooms have no photos in the MVP; a generated tile keeps the card layout from the mockups
const initial = computed(() => props.name.trim().charAt(0).toUpperCase());
const hue = computed(() => 170 + ((props.roomId * 37) % 40));
</script>

<template>
  <svg class="room-image" viewBox="0 0 320 200" role="img" :aria-label="name">
    <defs>
      <linearGradient :id="`room-${roomId}`" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" :stop-color="`hsl(${hue} 45% 32%)`" />
        <stop offset="1" :stop-color="`hsl(${hue + 20} 35% 55%)`" />
      </linearGradient>
    </defs>
    <rect width="320" height="200" :fill="`url(#room-${roomId})`" />
    <circle cx="260" cy="60" r="28" fill="rgba(255,255,255,0.25)" />
    <text x="24" y="168" fill="#fff" font-size="96" font-weight="700" font-family="system-ui, sans-serif">
      {{ initial }}
    </text>
  </svg>
</template>
