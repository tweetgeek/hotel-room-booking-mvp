<script setup lang="ts">
import { computed, ref } from 'vue';
import { pl } from '../i18n/pl';

const props = defineProps<{
  busy: boolean;
  error: string | null;
  attemptsLeft: number | null;
  retryAfterSeconds: number | null;
}>();
const emit = defineEmits<{ submit: [secureCode: string] }>();

const raw = ref('');
const localError = ref<string | null>(null);

const locked = computed(() => props.error === 'TOO_MANY_ATTEMPTS');

const serverMessage = computed(() => {
  if (locked.value) return pl.ui.reservation.lockedFor(props.retryAfterSeconds ?? 900);
  if (props.error === 'INVALID_SECURE_CODE' && props.attemptsLeft !== null)
    return pl.ui.reservation.attemptsLeft(props.attemptsLeft);
  if (props.error) return pl.errorMessage(props.error);
  return null;
});

function submit(): void {
  const code = raw.value.replace(/-/g, '').trim();
  if (!/^[A-Za-z0-9]{6}$/.test(code)) {
    localError.value = pl.fields.secureCode.INVALID_FORMAT;
    return;
  }
  localError.value = null;
  emit('submit', code);
}
</script>

<template>
  <form class="card gate" novalidate @submit.prevent="submit">
    <div class="card-body">
      <h1>{{ pl.ui.reservation.gateTitle }}</h1>
      <p>{{ pl.ui.reservation.gateText }}</p>
      <label class="field">
        <span>{{ pl.ui.reservation.code }}</span>
        <input
          v-model="raw"
          name="secureCode"
          type="text"
          inputmode="text"
          autocapitalize="off"
          autocomplete="one-time-code"
          spellcheck="false"
          maxlength="7"
          placeholder="abc-xyz"
          class="code-input"
          :disabled="locked || busy"
          :aria-invalid="Boolean(localError || error)"
        />
        <small v-if="localError" class="field-error">{{ localError }}</small>
        <small v-else-if="serverMessage" class="field-error" role="alert">{{ serverMessage }}</small>
      </label>
      <button type="submit" class="button primary block" :disabled="locked || busy">
        {{ pl.ui.reservation.gateSubmit }}
      </button>
    </div>
  </form>
</template>
