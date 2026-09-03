import * as crypto from 'crypto';
import { IEncryptionService } from '../../application/ports';

export class Aes256EncryptionService implements IEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(secretKeyHex?: string) {
    const rawKey = secretKeyHex || process.env.SOURCE_SECRET_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef';
    // Ensure 32 bytes key
    this.key = crypto.createHash('sha256').update(rawKey).digest();
  }

  public encrypt(plainText: string): string {
    if (!plainText) return '';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  public decrypt(cipherText: string): string {
    if (!cipherText || !cipherText.includes(':')) return '';
    const [ivHex, authTagHex, encryptedHex] = cipherText.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) return '';

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  public mask(plainText?: string): string {
    return plainText ? '••••••••' : '';
  }
}
