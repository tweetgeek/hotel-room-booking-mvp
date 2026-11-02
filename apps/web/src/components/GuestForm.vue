<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ValidationDetail } from '../api/client';
import { pl } from '../i18n/pl';

const props = withDefaults(defineProps<{ disabled: boolean; serverDetails?: ValidationDetail[] }>(), {
  serverDetails: () => [],
});
const emit = defineEmits<{ submit: [guest: { guestName: string; guestEmail: string }] }>();

const guestName = ref('');
const guestEmail = ref('');
const localErrors = ref<Record<string, string>>({});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const errors = computed<Record<string, string>>(() => {
  const fromServer: Record<string, string> = {};
  for (const detail of props.serverDetails)
    fromServer[detail.field] = pl.fieldMessage(detail.field, detail.code);
  return { ...fromServer, ...localErrors.value };
});

function validate(): boolean {
  const next: Record<string, string> = {};
  const name = guestName.value.trim();
  if (name.length === 0) next.guestName = pl.fields.guestName.REQUIRED;
  else if (name.length > 100) next.guestName = pl.fields.guestName.TOO_LONG;
  const email = guestEmail.value.trim();
  if (email.length === 0) next.guestEmail = pl.fields.guestEmail.REQUIRED;
  else if (!EMAIL.test(email)) next.guestEmail = pl.fields.guestEmail.INVALID_EMAIL;
  localErrors.value = next;
  return Object.keys(next).length === 0;
}

function submit(): void {
  if (!validate()) return;
  emit('submit', { guestName: guestName.value.trim(), guestEmail: guestEmail.value.trim() });
}
</script>

<template>
  <form class="guest-form" novalidate @submit.prevent="submit">
    <label class="field">
      <span>{{ pl.ui.book.guestName }}</span>
      <input
        v-model="guestName"
        name="guestName"
        type="text"
        autocomplete="name"
        maxlength="120"
        :aria-invalid="Boolean(errors.guestName)"
      />
      <small v-if="errors.guestName" class="field-error">{{ errors.guestName }}</small>
    </label>
    <label class="field">
      <span>{{ pl.ui.book.guestEmail }}</span>
      <input
        v-model="guestEmail"
        name="guestEmail"
        type="email"
        autocomplete="email"
        inputmode="email"
        :aria-invalid="Boolean(errors.guestEmail)"
      />
      <small v-if="errors.guestEmail" class="field-error">{{ errors.guestEmail }}</small>
    </label>
    <button type="submit" class="button primary block" :disabled="disabled">{{ pl.ui.book.submit }}</button>
  </form>
</template>
