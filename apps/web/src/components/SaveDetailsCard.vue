<script setup lang="ts">
import { computed, ref } from 'vue';
import { pl } from '../i18n/pl';

const props = defineProps<{ link: string; secureCode: string }>();

const display = computed(() => `${props.secureCode.slice(0, 3)}-${props.secureCode.slice(3)}`);
const copied = ref<'link' | 'code' | null>(null);

async function copy(what: 'link' | 'code'): Promise<void> {
  const value = what === 'link' ? props.link : props.secureCode;
  try {
    await navigator.clipboard.writeText(value);
    copied.value = what;
    setTimeout(() => (copied.value = null), 2000);
  } catch {
    // Clipboard may be unavailable on http:// in some browsers; the text stays selectable
  }
}
</script>

<template>
  <section class="card save-details">
    <div class="card-body">
      <h2>{{ pl.ui.reservation.saveTitle }}</h2>
      <p>{{ pl.ui.reservation.saveText }}</p>
      <div class="save-row">
        <span class="save-label">{{ pl.ui.reservation.link }}</span>
        <code class="save-value link" data-testid="permalink">{{ link }}</code>
        <button type="button" class="button" @click="copy('link')">
          {{ copied === 'link' ? pl.ui.reservation.copied : pl.ui.reservation.copy }}
        </button>
      </div>
      <div class="save-row">
        <span class="save-label">{{ pl.ui.reservation.code }}</span>
        <code class="save-value code" data-testid="secure-code">{{ display }}</code>
        <button type="button" class="button" @click="copy('code')">
          {{ copied === 'code' ? pl.ui.reservation.copied : pl.ui.reservation.copy }}
        </button>
      </div>
    </div>
  </section>
</template>
