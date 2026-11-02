import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SaveDetailsCard from '../../src/components/SaveDetailsCard.vue';
import { pl } from '../../src/i18n/pl';

describe('SaveDetailsCard', () => {
  const writeText = vi.fn(async () => undefined);

  beforeEach(() => {
    writeText.mockClear();
    Object.assign(navigator, { clipboard: { writeText } });
  });

  it('shows the code as abc-xyz in a monospace element and the permanent link', () => {
    const wrapper = mount(SaveDetailsCard, {
      props: { link: 'http://host/reservations/RES-7F3K2A', secureCode: 'aBc7xY' },
    });
    expect(wrapper.find('[data-testid="secure-code"]').text()).toBe('aBc-7xY');
    expect(wrapper.find('[data-testid="permalink"]').text()).toBe('http://host/reservations/RES-7F3K2A');
    expect(wrapper.text()).toContain(pl.ui.reservation.saveText);
  });

  it('copies the code without the hyphen and the link verbatim', async () => {
    const wrapper = mount(SaveDetailsCard, {
      props: { link: 'http://host/reservations/RES-7F3K2A', secureCode: 'aBc7xY' },
    });
    const buttons = wrapper.findAll('button');
    await buttons[1].trigger('click');
    expect(writeText).toHaveBeenCalledWith('aBc7xY');
    await buttons[0].trigger('click');
    expect(writeText).toHaveBeenCalledWith('http://host/reservations/RES-7F3K2A');
  });
});
