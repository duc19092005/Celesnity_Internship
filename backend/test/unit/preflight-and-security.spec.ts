import { of } from 'rxjs';
import { Aes256EncryptionService } from '../../src/infrastructure/crypto/aes256-encryption.service';
import { LoggingAndRedactionInterceptor } from '../../src/presentation/interceptors/logging-and-redaction.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { RunCollectionUseCase } from '../../src/application/use-cases/collection/run-collection.use-case';
import { Source } from '../../src/domain/entities/source.entity';
import { SourceStatus, SourceType, CollectionRunStatus } from '../../src/domain/enums/common.enums';

describe('Preflight & Security Test Suite (Unit Tests - Phase 1 & 5)', () => {
  describe('1. AES-256-GCM Encryption & Masking (TC-1.7)', () => {
    const cryptoService = new Aes256EncryptionService('test-key-32-chars-long-12345678');

    it('should encrypt sensitive password into iv:authTag:cipherText format', () => {
      const plaintext = 'SuperSecretDbPassword123!';
      const encrypted = cryptoService.encrypt(plaintext);

      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.split(':').length).toBe(3);
    });

    it('should decrypt cipherText back to the original plaintext', () => {
      const plaintext = 'postgres_production_pwd';
      const encrypted = cryptoService.encrypt(plaintext);
      const decrypted = cryptoService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should mask sensitive plaintext into bullet dots', () => {
      expect(cryptoService.mask('mySecret')).toBe('••••••••');
      expect(cryptoService.mask('')).toBe('');
    });
  });

  describe('2. LoggingAndRedactionInterceptor & Date ISO UTC Preservation (TC-1.7 & TC-5.2)', () => {
    const interceptor = new LoggingAndRedactionInterceptor();
    const mockExecutionContext = {} as ExecutionContext;

    it('TC-1.7: should redact passwords and secrets into hasSecret: true in API response', (done) => {
      const rawData = {
        id: 'src-postgres',
        name: 'Production DB',
        password: 'cleartext-password',
        encryptedSecret: 'iv:tag:cipher',
        config: {
          host: 'localhost',
          password: 'another-secret',
        },
      };

      const callHandler: CallHandler = {
        handle: () => of(rawData),
      };

      interceptor.intercept(mockExecutionContext, callHandler).subscribe({
        next: (result) => {
          expect(result.password).toBeUndefined();
          expect(result.encryptedSecret).toBeUndefined();
          expect(result.hasSecret).toBe(true);
          expect(result.config.password).toBeUndefined();
          expect(result.config.hasSecret).toBe(true);
          done();
        },
      });
    });

    it('TC-5.2: should preserve Date objects as ISO strings and NEVER return empty {}', (done) => {
      const testDate = new Date('2026-09-04T00:15:30.500Z');
      const payload = {
        id: 'run-101',
        startedAt: testDate,
        finishedAt: new Date(testDate.getTime() + 1200),
        nested: {
          createdAt: new Date('2026-09-01T10:00:00.000Z'),
        },
      };

      const callHandler: CallHandler = {
        handle: () => of(payload),
      };

      interceptor.intercept(mockExecutionContext, callHandler).subscribe({
        next: (result) => {
          expect(typeof result.startedAt).toBe('string');
          expect(result.startedAt).toBe('2026-09-04T00:15:30.500Z');
          expect(result.finishedAt).toBe('2026-09-04T00:15:31.700Z');
          expect(result.nested.createdAt).toBe('2026-09-01T10:00:00.000Z');
          expect(result.startedAt).not.toEqual({});
          done();
        },
      });
    });
  });

  describe('3. Pre-flight Check Connection Resilience (TC-1.8)', () => {
    it('should abort collection and record PREFLIGHT_CONNECTION_FAILED if source ping fails', async () => {
      const mockSourceRepo = {
        findById: jest.fn(),
        save: jest.fn(),
      } as any;

      const mockRunRepo = {
        save: jest.fn(),
        findById: jest.fn(),
      } as any;

      const mockAdapter = {
        supports: (t: any) => t === SourceType.POSTGRESQL,
        testConnection: jest.fn().mockResolvedValue({
          connected: false,
          latencyMs: 50,
          message: 'Connection refused on port 5432',
        }),
        collect: jest.fn(),
      };

      const mockCollectors = [mockAdapter] as any;
      const mockCrypto = new Aes256EncryptionService();
      const mockPipeline = {
        process: jest.fn(),
      } as any;

      const source = new Source(
        'src-unreachable',
        'org-1',
        'Unreachable DB',
        SourceType.POSTGRESQL,
        { host: 'dead-host', port: 9999 },
        null,
        { selectedTable: 'production_events' },
      );

      mockSourceRepo.findById.mockResolvedValue(source);

      const useCase = new RunCollectionUseCase(
        mockSourceRepo,
        mockRunRepo,
        mockCrypto,
        mockCollectors,
        mockPipeline,
      );

      const run = await useCase.execute('src-unreachable', 'org-1');

      expect(run.status).toBe(CollectionRunStatus.FAILED);
      expect(run.errors.length).toBeGreaterThan(0);
      expect(run.errors[0].code).toBe('PREFLIGHT_CONNECTION_FAILED');
      expect(source.status).toBe(SourceStatus.ERROR);
      expect(mockAdapter.collect).not.toHaveBeenCalled();
      expect(mockPipeline.process).not.toHaveBeenCalled();
    });
  });
});
