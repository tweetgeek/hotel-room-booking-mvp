<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoomStore } from '../stores/room.store';
import { pl } from '../i18n/pl';
import { formatMoney } from '../lib/money';
import RoomImagePlaceholder from '../components/RoomImagePlaceholder.vue';

const rooms = useRoomStore();
onMounted(() => rooms.loadRooms());
</script>

<template>
  <main class="page">
    <h1>{{ pl.ui.roomList.title }}</h1>
    <p v-if="rooms.error" class="banner error">{{ pl.errorMessage(rooms.error) }}</p>
    <ul class="room-cards">
      <li v-for="room in rooms.rooms" :key="room.id" class="card room-card">
        <RoomImagePlaceholder :name="room.name" :room-id="room.id" />
        <div class="card-body">
          <h2>{{ room.name }}</h2>
          <p class="price">
            <strong>{{ formatMoney(room.pricePerNight, room.currency) }}</strong>
            {{ pl.ui.roomList.perNight }}
          </p>
          <RouterLink class="button primary" :to="`/rooms/${room.id}`">{{ pl.ui.roomList.view }}</RouterLink>
        </div>
      </li>
    </ul>
  </main>
</template>
