import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import GuestForm from '../../src/components/GuestForm.vue';
import { pl } from '../../src/i18n/pl';

describe('GuestForm', () => {
  it('shows field messages for an empty name and a bad e-mail and does not submit', async () => {
    const wrapper = mount(GuestForm, { props: { disabled: false } });
    await wrapper.find('input[name="guestEmail"]').setValue('anna@');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.text()).toContain(pl.fields.guestName.REQUIRED);
    expect(wrapper.text()).toContain(pl.fields.guestEmail.INVALID_EMAIL);
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('rejects a name longer than 100 characters', async () => {
    const wrapper = mount(GuestForm, { props: { disabled: false } });
    await wrapper.find('input[name="guestName"]').setValue('a'.repeat(101));
    await wrapper.find('input[name="guestEmail"]').setValue('anna@example.com');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.text()).toContain(pl.fields.guestName.TOO_LONG);
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('emits the guest details when valid', async () => {
    const wrapper = mount(GuestForm, { props: { disabled: false } });
    await wrapper.find('input[name="guestName"]').setValue('  Anna Kowalska ');
    await wrapper.find('input[name="guestEmail"]').setValue('anna@example.com');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('submit')?.[0]).toEqual([
      { guestName: 'Anna Kowalska', guestEmail: 'anna@example.com' },
    ]);
  });

  it('shows server validation details next to the fields', () => {
    const wrapper = mount(GuestForm, {
      props: { disabled: false, serverDetails: [{ field: 'guestEmail', code: 'INVALID_EMAIL' }] },
    });
    expect(wrapper.text()).toContain(pl.fields.guestEmail.INVALID_EMAIL);
  });

  it('disables the submit button while a reservation is being created', () => {
    const wrapper = mount(GuestForm, { props: { disabled: true } });
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined();
  });
});
