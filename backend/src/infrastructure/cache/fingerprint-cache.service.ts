import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class FingerprintCacheService {
  private readonly logger = new Logger(FingerprintCacheService.name);
  // Store 128-bit hex fingerprints in memory
  private readonly store = new Set<string>();

  public add(key: string): void {
    const hash = this.computeHash128(key);
    this.store.add(hash);
  }

  public has(key: string): boolean {
    const hash = this.computeHash128(key);
    return this.store.has(hash);
  }

  public delete(key: string): boolean {
    const hash = this.computeHash128(key);
    return this.store.delete(hash);
  }

  public clear(): void {
    this.store.clear();
  }

  public size(): number {
    return this.store.size;
  }

  /**
   * Computes a deterministic 128-bit fingerprint using MD5 (16 bytes / 32 hex chars)
   * Collision probability for 128-bit is ~ 1 / 3.4e38 (Mathematically negligible)
   */
  public computeHash128(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex');
  }
}
