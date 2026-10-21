import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { ValueTransformer } from 'typeorm';

const VERSION = 'v1';

/**
 * AES-256-GCM field encryption for personal data at rest (RNF-18): passenger documents,
 * contact and billing data. Output format `v1:<iv>:<tag>:<ciphertext>` (base64), so a future
 * key rotation can tell old and new values apart. The key is set once at boot from the
 * validated configuration (see VuelosCoreModule); using it before that fails loudly instead
 * of silently storing plaintext.
 */
export class FieldCipher {
  private static key: Buffer | null = null;

  static configure(key: Buffer): void {
    if (key.length !== 32) throw new Error('FieldCipher requires a 32-byte key');
    FieldCipher.key = key;
  }

  static encrypt(plain: string): string {
    const key = FieldCipher.requireKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
  }

  static decrypt(payload: string): string {
    const key = FieldCipher.requireKey();
    const [version, iv, tag, data] = payload.split(':');
    if (version !== VERSION || !iv || !tag || data === undefined) {
      throw new Error('Unrecognised encrypted field format');
    }
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  }

  private static requireKey(): Buffer {
    if (!FieldCipher.key) throw new Error('FieldCipher is not configured: no encryption key was loaded');
    return FieldCipher.key;
  }
}

/** TypeORM transformer storing a JSON-serialisable value as an encrypted `text` column. */
export function encryptedJson<T>(): ValueTransformer {
  return {
    to: (value: T | null | undefined) => (value === null || value === undefined ? value : FieldCipher.encrypt(JSON.stringify(value))),
    from: (value: string | null | undefined) =>
      value === null || value === undefined ? value : (JSON.parse(FieldCipher.decrypt(value)) as T),
  };
}
