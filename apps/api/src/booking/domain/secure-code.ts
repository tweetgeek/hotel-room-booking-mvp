import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { InvalidValueError } from '../../shared/domain/domain-error';

// Letters and digits without the look-alikes 0, O, 1, l and I: 57 characters (research R-15)
export const SECURE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
export const SECURE_CODE_LENGTH = 6;

const INPUT_PATTERN = /^[A-Za-z0-9]{6}$/;
// scrypt cost is deliberately modest: the attempt limit (5 per 15 minutes) is the real defence (ADR-006)
const SCRYPT = { N: 16384, r: 8, p: 1, keyLength: 32, saltBytes: 16 };

function derive(code: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(code, salt, SCRYPT.keyLength, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export class SecureCode {
  private constructor(readonly value: string) {}

  static generate(random: (bytes: number) => Buffer = randomBytes): SecureCode {
    const bytes = random(SECURE_CODE_LENGTH);
    let code = '';
    for (let i = 0; i < SECURE_CODE_LENGTH; i += 1) {
      code += SECURE_CODE_ALPHABET[bytes[i] % SECURE_CODE_ALPHABET.length];
    }
    return new SecureCode(code);
  }

  /** Guest input: hyphens are ignored, case is preserved (comparison is case-sensitive). */
  static fromInput(raw: string): SecureCode {
    const normalized = raw.replace(/-/g, '');
    if (!INPUT_PATTERN.test(normalized)) {
      throw new InvalidValueError('Secure code must be six letters or digits.');
    }
    return new SecureCode(normalized);
  }

  async hash(): Promise<string> {
    const salt = randomBytes(SCRYPT.saltBytes);
    const key = await derive(this.value, salt);
    return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
  }

  async matches(hash: string): Promise<boolean> {
    const [scheme, saltHex, keyHex] = hash.split('$');
    if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
    const expected = Buffer.from(keyHex, 'hex');
    const actual = await derive(this.value, Buffer.from(saltHex, 'hex'));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  display(): string {
    return `${this.value.slice(0, 3)}-${this.value.slice(3)}`;
  }
}
