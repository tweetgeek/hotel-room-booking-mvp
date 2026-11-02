import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SecureCodeGate from '../../src/components/SecureCodeGate.vue';
import { pl } from '../../src/i18n/pl';

describe('SecureCodeGate', () => {
  it('renders a single field without autocapitalization and submits the code without hyphens', async () => {
    const wrapper = mount(SecureCodeGate, {
      props: { busy: false, error: null, attemptsLeft: null, retryAfterSeconds: null },
    });
    const input = wrapper.find('input');
    expect(input.attributes('autocapitalize')).toBe('off');
    expect(input.attributes('autocomplete')).toBe('one-time-code');

    await input.setValue('abc-xyz');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('submit')?.[0]).toEqual(['abcxyz']);
  });

  it('rejects anything else than six letters or digits locally', async () => {
    const wrapper = mount(SecureCodeGate, {
      props: { busy: false, error: null, attemptsLeft: null, retryAfterSeconds: null },
    });
    await wrapper.find('input').setValue('abc!');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.text()).toContain(pl.fields.secureCode.INVALID_FORMAT);
  });

  it('shows the remaining attempts after a wrong code', () => {
    const wrapper = mount(SecureCodeGate, {
      props: { busy: false, error: 'INVALID_SECURE_CODE', attemptsLeft: 3, retryAfterSeconds: null },
    });
    expect(wrapper.text()).toContain(pl.ui.reservation.attemptsLeft(3));
  });

  it('shows the lock message and disables the field when locked', () => {
    const wrapper = mount(SecureCodeGate, {
      props: { busy: false, error: 'TOO_MANY_ATTEMPTS', attemptsLeft: 0, retryAfterSeconds: 540 },
    });
    expect(wrapper.text()).toContain(pl.ui.reservation.lockedFor(540));
    expect(wrapper.find('input').attributes('disabled')).toBeDefined();
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined();
  });
});
