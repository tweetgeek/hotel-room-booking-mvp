import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import StayCalendar from '../../src/components/StayCalendar.vue';
import { pl } from '../../src/i18n/pl';

const TODAY = '2026-11-03';

function mountCalendar(blocked: Record<string, 'held' | 'confirmed' | 'optimistic'> = {}) {
  return mount(StayCalendar, { props: { today: TODAY, blocked } });
}

const day = (wrapper: ReturnType<typeof mountCalendar>, date: string) =>
  wrapper.find(`[data-date="${date}"]`);

describe('StayCalendar', () => {
  it('renders the current month and the two following ones', () => {
    const wrapper = mountCalendar();
    expect(wrapper.findAll('[data-month]').map((m) => m.attributes('data-month'))).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
    ]);
    expect(day(wrapper, '2027-01-31').exists()).toBe(true);
  });

  it('disables past days and blocked nights so they cannot be clicked', async () => {
    const wrapper = mountCalendar({ '2026-11-05': 'held', '2026-11-06': 'confirmed', '2026-11-07': 'held' });
    expect(day(wrapper, '2026-11-02').attributes('disabled')).toBeDefined();
    expect(day(wrapper, '2026-11-03').attributes('disabled')).toBeUndefined();
    expect(day(wrapper, '2026-11-06').attributes('disabled')).toBeDefined();

    await day(wrapper, '2026-11-06').trigger('click');
    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('emits the stay after a check-in click and a check-out click', async () => {
    const wrapper = mountCalendar();
    await day(wrapper, '2026-11-10').trigger('click');
    expect(wrapper.text()).toContain(pl.ui.book.pickCheckOut);
    await day(wrapper, '2026-11-13').trigger('click');

    expect(wrapper.emitted('select')?.[0]).toEqual([
      { checkIn: '2026-11-10', checkOut: '2026-11-13', nights: 3 },
    ]);
    expect(day(wrapper, '2026-11-11').classes()).toContain('in-range');
  });

  it('rejects a range that spans a blocked night and restarts from the clicked day', async () => {
    const wrapper = mountCalendar({ '2026-11-05': 'held', '2026-11-06': 'held', '2026-11-07': 'held' });
    await day(wrapper, '2026-11-03').trigger('click');
    await day(wrapper, '2026-11-09').trigger('click');

    expect(wrapper.emitted('select')).toBeUndefined();
    expect(wrapper.text()).toContain(pl.ui.book.rangeBlocked);
    expect(day(wrapper, '2026-11-03').classes()).toContain('check-in');
    expect(day(wrapper, '2026-11-09').classes()).not.toContain('check-out');
  });

  it('treats a click before the check-in as a new check-in', async () => {
    const wrapper = mountCalendar();
    await day(wrapper, '2026-11-10').trigger('click');
    await day(wrapper, '2026-11-08').trigger('click');

    expect(wrapper.emitted('select')).toBeUndefined();
    expect(day(wrapper, '2026-11-08').classes()).toContain('check-in');
    expect(day(wrapper, '2026-11-10').classes()).not.toContain('check-in');
  });

  it('rejects stays longer than 30 nights with a message', async () => {
    const wrapper = mountCalendar();
    await day(wrapper, '2026-11-10').trigger('click');
    await day(wrapper, '2026-12-15').trigger('click');

    expect(wrapper.emitted('select')).toBeUndefined();
    expect(wrapper.text()).toContain(pl.ui.book.tooManyNights);
  });
});
