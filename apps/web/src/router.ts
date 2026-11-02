import { createRouter, createWebHistory } from 'vue-router';
import { useReservationStore } from './stores/reservation.store';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'rooms', component: () => import('./views/RoomListView.vue') },
    { path: '/rooms/:roomId', name: 'room', component: () => import('./views/RoomView.vue') },
    { path: '/rooms/:roomId/book', name: 'book', component: () => import('./views/BookView.vue') },
    {
      path: '/payment',
      name: 'payment',
      component: () => import('./views/PaymentView.vue'),
      // The operator screen only makes sense with a reservation in progress (spec edge case)
      beforeEnter: () => {
        const reservation = useReservationStore();
        if (reservation.current || reservation.restoreFromSession()) return true;
        return '/';
      },
    },
    {
      path: '/reservations/:reservationId',
      name: 'reservation',
      component: () => import('./views/ReservationView.vue'),
    },
  ],
});
