import { Injectable } from '@nestjs/common';

@Injectable()
export class BloomFilterService {
  private bitArray: Uint8Array;
  private sizeInBits: number;
  private numHashFunctions: number;

  constructor(
    expectedItems: number = 100_000,
    falsePositiveRate: number = 0.01,
  ) {
    this.sizeInBits = Math.ceil(
      -(expectedItems * Math.log(falsePositiveRate)) / (Math.LN2 * Math.LN2),
    );
    this.numHashFunctions = Math.round(
      (this.sizeInBits / expectedItems) * Math.LN2,
    );
    this.bitArray = new Uint8Array(Math.ceil(this.sizeInBits / 8));
  }

  public add(key: string): void {
    const [h1, h2] = this.hash(key);
    for (let i = 0; i < this.numHashFunctions; i++) {
      const bitIndex = Math.abs((h1 + i * h2) % this.sizeInBits);
      const byteIndex = Math.floor(bitIndex / 8);
      const bitOffset = bitIndex % 8;
      this.bitArray[byteIndex] |= 1 << bitOffset;
    }
  }

  public has(key: string): boolean {
    const [h1, h2] = this.hash(key);
    for (let i = 0; i < this.numHashFunctions; i++) {
      const bitIndex = Math.abs((h1 + i * h2) % this.sizeInBits);
      const byteIndex = Math.floor(bitIndex / 8);
      const bitOffset = bitIndex % 8;
      if ((this.bitArray[byteIndex] & (1 << bitOffset)) === 0) {
        return false;
      }
    }
    return true;
  }

  public clear(): void {
    this.bitArray.fill(0);
  }

  public getMemoryBytes(): number {
    return this.bitArray.byteLength;
  }

  private hash(key: string): [number, number] {
    let h1 = 0x811c9dc5;
    let h2 = 0x45d9f3b;
    for (let i = 0; i < key.length; i++) {
      const code = key.charCodeAt(i);
      h1 ^= code;
      h1 = Math.imul(h1, 0x01000193);
      h2 = (h2 << 5) - h2 + code;
      h2 |= 0;
    }
    return [h1, h2];
  }
}
