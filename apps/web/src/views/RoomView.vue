<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useRoomStore } from '../stores/room.store';
import { pl } from '../i18n/pl';
import { formatMoney } from '../lib/money';
import RoomImagePlaceholder from '../components/RoomImagePlaceholder.vue';

const route = useRoute();
const rooms = useRoomStore();
const roomId = Number(route.params.roomId);
onMounted(() => rooms.loadRoom(roomId));
</script>

<template>
  <main class="page">
    <RouterLink class="back-link" to="/">← {{ pl.ui.room.back }}</RouterLink>
    <p v-if="rooms.error" class="banner error">{{ pl.errorMessage(rooms.error) }}</p>
    <article v-if="rooms.current" class="card">
      <RoomImagePlaceholder :name="rooms.current.name" :room-id="rooms.current.id" />
      <div class="card-body">
        <h1>{{ rooms.current.name }}</h1>
        <p class="price">
          <strong>{{ formatMoney(rooms.current.pricePerNight, rooms.current.currency) }}</strong>
          {{ pl.ui.room.perNight }}
        </p>
        <p>{{ rooms.current.description }}</p>
        <h2>{{ pl.ui.room.features }}</h2>
        <ul class="features">
          <li v-for="feature in rooms.current.features" :key="feature">{{ pl.featureLabel(feature) }}</li>
        </ul>
        <RouterLink class="button primary block" :to="`/rooms/${rooms.current.id}/book`">
          {{ pl.ui.room.chooseDates }}
        </RouterLink>
      </div>
    </article>
  </main>
</template>
