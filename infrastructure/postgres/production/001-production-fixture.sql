-- Factory Production Source Database Fixture
-- Represents existing factory production line operations

CREATE TABLE IF NOT EXISTS production_events (
    row_id SERIAL PRIMARY KEY,
    source_record_id VARCHAR(100) NOT NULL,
    source_revision INT DEFAULT 1,
    batch_id VARCHAR(50) NOT NULL,
    work_order_id VARCHAR(50),
    station_code VARCHAR(50) NOT NULL,
    quantity INT NOT NULL,
    event_time TIMESTAMP WITH TIME ZONE NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    quality_status VARCHAR(20) DEFAULT 'PASS',
    machine_id VARCHAR(50),
    payload JSONB
);

-- Unrelated table to demonstrate schema discovery & single table selection
CREATE TABLE IF NOT EXISTS machine_catalog (
    id SERIAL PRIMARY KEY,
    machine_code VARCHAR(50) NOT NULL,
    machine_type VARCHAR(50) NOT NULL,
    station_assigned VARCHAR(50) NOT NULL,
    manufacturer VARCHAR(100),
    installed_at DATE
);

INSERT INTO machine_catalog (machine_code, machine_type, station_assigned, manufacturer, installed_at)
VALUES
('SORT-01', 'OPTICAL_SORTER', 'SORTING', 'LaundryTech Global', '2025-01-15'),
('WASH-01', 'BARRIER_WASHER_100KG', 'WASHING', 'HydroClean Systems', '2025-02-01'),
('WASH-02', 'BARRIER_WASHER_100KG', 'WASHING', 'HydroClean Systems', '2025-02-01'),
('DRY-01', 'INDUSTRIAL_DRYER_80KG', 'DRYING', 'ThermoDry Co', '2025-02-10'),
('FOLD-01', 'AUTO_FEED_FOLDER', 'FOLDING', 'PrecisionFold', '2025-03-01');

-- Seed Production Events
-- Covers SORTING, WASHING, DRYING, FOLDING
-- Includes:
-- 1. Exact Duplicate Observation (BATCH-002 FOLDING event recorded twice)
-- 2. Late event from an earlier station (BATCH-004 SORTING recorded after WASHING/DRYING)
-- 3. Quality warning event (BATCH-006 WASHING with quality FAIL)

INSERT INTO production_events (source_record_id, source_revision, batch_id, work_order_id, station_code, quantity, event_time, recorded_at, quality_status, machine_id, payload)
VALUES
-- BATCH-001: Standard flow through SORTING, WASHING, DRYING, FOLDING (will be completed by DISPATCH in API)
('PROD-EVT-001', 1, 'BATCH-001', 'WO-1001', 'SORTING', 120, NOW() - INTERVAL '60 minutes', NOW() - INTERVAL '60 minutes', 'PASS', 'SORT-01', '{"linenType": "Bath Towel", "sortedBy": "Nguyen Van A"}'),
('PROD-EVT-002', 1, 'BATCH-001', 'WO-1001', 'WASHING', 120, NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '45 minutes', 'PASS', 'WASH-01', '{"washTempC": 65, "waterLevel": "HIGH"}'),
('PROD-EVT-003', 1, 'BATCH-001', 'WO-1001', 'DRYING', 120, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes', 'PASS', 'DRY-01', '{"dryTempC": 75, "durationMin": 25}'),
('PROD-EVT-004', 1, 'BATCH-001', 'WO-1001', 'FOLDING', 120, NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes', 'PASS', 'FOLD-01', '{"folderLane": 1, "operator": "Tran Thi B"}'),

-- BATCH-002: In FOLDING stage with a DUPLICATE source observation (same source_record_id & payload)
('PROD-EVT-005', 1, 'BATCH-002', 'WO-1001', 'SORTING', 80, NOW() - INTERVAL '50 minutes', NOW() - INTERVAL '50 minutes', 'PASS', 'SORT-01', '{"linenType": "Hand Towel"}'),
('PROD-EVT-006', 1, 'BATCH-002', 'WO-1001', 'WASHING', 80, NOW() - INTERVAL '35 minutes', NOW() - INTERVAL '35 minutes', 'PASS', 'WASH-02', '{"washTempC": 60}'),
('PROD-EVT-007', 1, 'BATCH-002', 'WO-1001', 'DRYING', 80, NOW() - INTERVAL '20 minutes', NOW() - INTERVAL '20 minutes', 'PASS', 'DRY-01', '{"dryTempC": 70}'),
('PROD-EVT-008', 1, 'BATCH-002', 'WO-1001', 'FOLDING', 80, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes', 'PASS', 'FOLD-01', '{"folderLane": 2}'),
-- Duplicate observation of PROD-EVT-008 (identical record):
('PROD-EVT-008', 1, 'BATCH-002', 'WO-1001', 'FOLDING', 80, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '5 minutes', 'PASS', 'FOLD-01', '{"folderLane": 2}'),

-- BATCH-003: Later station (WASHING) without earlier SORTING event -> Demonstrates MISSING_DATA indicator
('PROD-EVT-009', 1, 'BATCH-003', 'WO-1002', 'WASHING', 200, NOW() - INTERVAL '40 minutes', NOW() - INTERVAL '40 minutes', 'PASS', 'WASH-01', '{"washTempC": 70}'),
('PROD-EVT-010', 1, 'BATCH-003', 'WO-1002', 'DRYING', 200, NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '25 minutes', 'PASS', 'DRY-01', '{"dryTempC": 75}'),

-- BATCH-004: Demonstrates Late earlier-station event (SORTING event timestamped earlier but recorded later)
('PROD-EVT-011', 1, 'BATCH-004', 'WO-1002', 'WASHING', 150, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes', 'PASS', 'WASH-02', '{"washTempC": 65}'),
('PROD-EVT-012', 1, 'BATCH-004', 'WO-1002', 'DRYING', 150, NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '15 minutes', 'PASS', 'DRY-01', '{"dryTempC": 70}'),
-- Late event from earlier station SORTING (occurred at -45m, recorded recently at -2m):
('PROD-EVT-013', 1, 'BATCH-004', 'WO-1002', 'SORTING', 150, NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '2 minutes', 'PASS', 'SORT-01', '{"linenType": "Pillow Case"}'),

-- BATCH-006: Has Quality Failure warning at WASHING
('PROD-EVT-014', 1, 'BATCH-006', 'WO-1003', 'SORTING', 90, NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes', 'PASS', 'SORT-01', '{"linenType": "Bathrobe"}'),
('PROD-EVT-015', 1, 'BATCH-006', 'WO-1003', 'WASHING', 90, NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes', 'FAIL', 'WASH-01', '{"washTempC": 42, "reason": "Low wash temperature under sterilization limit"}');
