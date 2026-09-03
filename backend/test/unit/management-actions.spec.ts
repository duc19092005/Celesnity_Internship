import {
  BlockBatchUseCase,
  ResumeBatchUseCase,
  AcknowledgeExceptionUseCase,
  AddBatchNoteUseCase,
} from '../../src/application/use-cases/management/management-actions.use-cases';
import { Batch } from '../../src/domain/entities/batch.entity';
import { ManagementAction } from '../../src/domain/enums/common.enums';
import { StationCode } from '../../src/domain/enums/station-code.enum';
import { BatchStatus } from '../../src/domain/enums/common.enums';
import { BatchNotFoundException, InvalidOperationException } from '../../src/domain/exceptions/domain.exceptions';

describe('ManagementActionsUseCases (Unit Tests - Phase 3 & 4)', () => {
  let mockBatchRepo: any;
  let mockMgmtRepo: any;
  let mockCanonRepo: any;

  const orgId = 'org-celesnity-laundry';
  const batchId = 'BATCH-001';

  beforeEach(() => {
    mockBatchRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findByLineId: jest.fn(),
      save: jest.fn().mockImplementation(async (b: any) => b),
      saveMany: jest.fn(),
    };

    mockMgmtRepo = {
      save: jest.fn().mockImplementation(async (e: any) => e),
      findByBatchId: jest.fn(),
    };

    mockCanonRepo = {
      save: jest.fn(),
      saveMany: jest.fn(),
      findById: jest.fn(),
      findByBatchId: jest.fn(),
      findByBatchAndStation: jest.fn(),
      findAll: jest.fn(),
    };
  });

  describe('1. BlockBatchUseCase (TC-3.5 & TC-3.7)', () => {
    it('TC-3.5: should successfully block an active batch and record append-only event', async () => {
      const activeBatch = new Batch(
        batchId,
        orgId,
        'WO-1001',
        'LINE-A',
        StationCode.WASHING,
        120,
        BatchStatus.IN_PROGRESS,
      );
      mockBatchRepo.findById.mockResolvedValue(activeBatch);
      mockCanonRepo.findByBatchAndStation.mockResolvedValue(null);

      const useCase = new BlockBatchUseCase(mockBatchRepo, mockMgmtRepo, mockCanonRepo);
      const result = await useCase.execute({
        organizationId: orgId,
        batchId,
        actorId: 'user-01',
        actorName: 'Nguyen Van Quan Doc',
        reason: 'Phat hien rach vai tai tram Giặt',
      });

      expect(result.action).toBe(ManagementAction.BLOCK);
      expect(result.reason).toBe('Phat hien rach vai tai tram Giặt');
      expect(result.actorName).toBe('Nguyen Van Quan Doc');
      expect(activeBatch.status).toBe(BatchStatus.BLOCKED);
      expect(mockMgmtRepo.save).toHaveBeenCalledTimes(1);
      expect(mockBatchRepo.save).toHaveBeenCalledTimes(1);
    });

    it('TC-3.7: should THROW InvalidOperationException when attempting to block a COMPLETED batch (Dispatch Invariance)', async () => {
      const completedBatch = new Batch(
        batchId,
        orgId,
        'WO-1001',
        'LINE-A',
        StationCode.DISPATCH,
        120,
        BatchStatus.COMPLETED,
      );
      mockBatchRepo.findById.mockResolvedValue(completedBatch);

      const useCase = new BlockBatchUseCase(mockBatchRepo, mockMgmtRepo, mockCanonRepo);
      await expect(
        useCase.execute({
          organizationId: orgId,
          batchId,
          actorId: 'user-01',
          actorName: 'Nguyen Van Quan Doc',
          reason: 'Thu chan lo hang da xuat',
        }),
      ).rejects.toThrow(InvalidOperationException);
    });

    it('should throw BatchNotFoundException if batch does not exist', async () => {
      mockBatchRepo.findById.mockResolvedValue(null);
      const useCase = new BlockBatchUseCase(mockBatchRepo, mockMgmtRepo, mockCanonRepo);
      await expect(
        useCase.execute({
          organizationId: orgId,
          batchId: 'NON-EXISTENT',
          actorId: 'user-01',
          actorName: 'Admin',
          reason: 'Test',
        }),
      ).rejects.toThrow(BatchNotFoundException);
    });
  });

  describe('2. ResumeBatchUseCase (TC-3.6)', () => {
    it('TC-3.6: should resume a blocked batch and clear activeBlockReason', async () => {
      const blockedBatch = new Batch(
        batchId,
        orgId,
        'WO-1001',
        'LINE-A',
        StationCode.WASHING,
        120,
        BatchStatus.BLOCKED,
      );
      blockedBatch.activeBlockReason = 'Rach vai';
      mockBatchRepo.findById.mockResolvedValue(blockedBatch);
      mockCanonRepo.findByBatchAndStation.mockResolvedValue(null);

      const useCase = new ResumeBatchUseCase(mockBatchRepo, mockMgmtRepo, mockCanonRepo);
      const result = await useCase.execute({
        organizationId: orgId,
        batchId,
        actorId: 'user-01',
        actorName: 'Nguyen Van Quan Doc',
        note: 'Da thay the mẻ giat moi thanh cong',
      });

      expect(result.action).toBe(ManagementAction.RESUME);
      expect(blockedBatch.status).toBe(BatchStatus.IN_PROGRESS);
      expect(blockedBatch.activeBlockReason).toBeNull();
      expect(mockBatchRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: BatchStatus.IN_PROGRESS, activeBlockReason: null }),
      );
    });
  });

  describe('3. AcknowledgeExceptionUseCase & AddBatchNoteUseCase (TC-4.1 Append-Only Audit)', () => {
    it('TC-4.1a: should record ACKNOWLEDGE event with exceptionKey and actor timestamp', async () => {
      const batch = new Batch(
        batchId,
        orgId,
        'WO-1001',
        'LINE-A',
        StationCode.SORTING,
        120,
        BatchStatus.IN_PROGRESS,
      );
      mockBatchRepo.findById.mockResolvedValue(batch);

      const useCase = new AcknowledgeExceptionUseCase(mockBatchRepo, mockMgmtRepo);
      const event = await useCase.execute({
        organizationId: orgId,
        batchId,
        actorId: 'user-02',
        actorName: 'KCS Inspector',
        exceptionKey: 'DEFECT_STAIN',
        note: 'Da giat lai voi hoa chat tay diem',
      });

      expect(event.action).toBe(ManagementAction.ACKNOWLEDGE);
      expect(event.exceptionKey).toBe('DEFECT_STAIN');
      expect(event.note).toBe('Da giat lai voi hoa chat tay diem');
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(mockMgmtRepo.save).toHaveBeenCalledTimes(1);
    });

    it('TC-4.1b: should append a general management NOTE without modifying existing batch state', async () => {
      const batch = new Batch(
        batchId,
        orgId,
        'WO-1001',
        'LINE-A',
        StationCode.SORTING,
        120,
        BatchStatus.IN_PROGRESS,
      );
      mockBatchRepo.findById.mockResolvedValue(batch);

      const useCase = new AddBatchNoteUseCase(mockBatchRepo, mockMgmtRepo);
      const event = await useCase.execute({
        organizationId: orgId,
        batchId,
        actorId: 'user-01',
        actorName: 'Shift Supervisor',
        note: 'Giao truoc 14:00 theo yeu cau cua khach san JW Marriott',
      });

      expect(event.action).toBe(ManagementAction.NOTE);
      expect(event.note).toContain('JW Marriott');
      expect(event.actorName).toBe('Shift Supervisor');
    });
  });
});
