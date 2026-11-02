import { SECURE_CODE_ALPHABET, SecureCode } from '../../../../src/booking/domain/secure-code';
import { DomainError } from '../../../../src/shared/domain/domain-error';

describe('SecureCode', () => {
  it('generates six characters from an alphabet without 0, O, 1, l and I', () => {
    expect(SECURE_CODE_ALPHABET).toHaveLength(57);
    for (const forbidden of ['0', 'O', '1', 'l', 'I']) expect(SECURE_CODE_ALPHABET).not.toContain(forbidden);
    for (let i = 0; i < 100; i += 1) {
      const code = SecureCode.generate().value;
      expect(code).toHaveLength(6);
      for (const ch of code) expect(SECURE_CODE_ALPHABET).toContain(ch);
    }
  });

  it('hashes with scrypt in the scrypt$salt$hash format and verifies case-sensitively', async () => {
    const code = SecureCode.fromInput('aBc7xY');
    const hash = await code.hash();
    expect(hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(await SecureCode.fromInput('aBc7xY').matches(hash)).toBe(true);
    expect(await SecureCode.fromInput('abc7xy').matches(hash)).toBe(false);
    expect(await SecureCode.fromInput('aBc7xZ').matches(hash)).toBe(false);
  });

  it('salts every hash differently', async () => {
    const code = SecureCode.fromInput('aBc7xY');
    expect(await code.hash()).not.toBe(await code.hash());
  });

  it('accepts hyphens in input and rejects anything else than six letters or digits', () => {
    expect(SecureCode.fromInput('aBc-7xY').value).toBe('aBc7xY');
    expect(() => SecureCode.fromInput('aBc7x')).toThrow(DomainError);
    expect(() => SecureCode.fromInput('aBc7xYZ')).toThrow(DomainError);
    expect(() => SecureCode.fromInput('aBc7x!')).toThrow(DomainError);
  });

  it('formats for display as abc-xyz', () => {
    expect(SecureCode.fromInput('aBc7xY').display()).toBe('aBc-7xY');
  });
});
