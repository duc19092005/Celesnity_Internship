-- Connect to production_db and create factory production tables
\c production_db;

-- Step 2: SORTING
CREATE TABLE IF NOT EXISTS sorting_events (
    id SERIAL PRIMARY KEY,
    work_order_id VARCHAR(50) NOT NULL,
    batch_id VARCHAR(50) NOT NULL,
    station_code VARCHAR(50) DEFAULT 'SORTING',
    pieces_count INT NOT NULL,
    sorted_by VARCHAR(100),
    linen_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: WASHING
CREATE TABLE IF NOT EXISTS washing_events (
    id SERIAL PRIMARY KEY,
    work_order_id VARCHAR(50) NOT NULL,
    batch_id VARCHAR(50) NOT NULL,
    station_code VARCHAR(50) DEFAULT 'WASHING',
    machine_id VARCHAR(50),
    water_temperature_c INT,
    wash_cycle_type VARCHAR(100),
    completed_quantity INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: DRYING
CREATE TABLE IF NOT EXISTS drying_events (
    id SERIAL PRIMARY KEY,
    work_order_id VARCHAR(50) NOT NULL,
    batch_id VARCHAR(50) NOT NULL,
    station_code VARCHAR(50) DEFAULT 'DRYING',
    dryer_machine_id VARCHAR(50),
    dry_temperature_c INT,
    completed_quantity INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 5: FOLDING
CREATE TABLE IF NOT EXISTS folding_events (
    id SERIAL PRIMARY KEY,
    work_order_id VARCHAR(50) NOT NULL,
    batch_id VARCHAR(50) NOT NULL,
    station_code VARCHAR(50) DEFAULT 'FOLDING',
    folding_line_id VARCHAR(50),
    pieces_folded INT NOT NULL,
    quality_passed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed initial sample data with shared workOrderId and batchId values across batches
INSERT INTO sorting_events (work_order_id, batch_id, station_code, pieces_count, sorted_by, linen_type, created_at)
VALUES
('WO-1001', 'BATCH-001', 'SORTING', 120, 'Nguyen Van B', 'Bath Towel 70x140', NOW() - INTERVAL '45 minutes'),
('WO-1001', 'BATCH-002', 'SORTING', 80, 'Nguyen Van B', 'Hand Towel 34x70', NOW() - INTERVAL '40 minutes'),
('WO-1002', 'BATCH-003', 'SORTING', 200, 'Tran Thi C', 'Bed Sheet King 280x280', NOW() - INTERVAL '30 minutes'),
('WO-1002', 'BATCH-004', 'SORTING', 150, 'Tran Thi C', 'Pillow Case 50x70', NOW() - INTERVAL '25 minutes'),
('WO-1003', 'BATCH-005', 'SORTING', 90, 'Le Van D', 'Bathrobe L', NOW() - INTERVAL '10 minutes');

INSERT INTO washing_events (work_order_id, batch_id, station_code, machine_id, water_temperature_c, wash_cycle_type, completed_quantity, created_at)
VALUES
('WO-1001', 'BATCH-001', 'WASHING', 'WASHER-01', 65, 'HEAVY_COTTON', 120, NOW() - INTERVAL '35 minutes'),
('WO-1001', 'BATCH-002', 'WASHING', 'WASHER-02', 60, 'DELICATE_TOWEL', 80, NOW() - INTERVAL '30 minutes'),
('WO-1002', 'BATCH-003', 'WASHING', 'WASHER-03', 70, 'HOT_DISINFECT', 200, NOW() - INTERVAL '20 minutes'),
('WO-1002', 'BATCH-004', 'WASHING', 'WASHER-01', 65, 'STANDARD_WASH', 150, NOW() - INTERVAL '15 minutes');

INSERT INTO drying_events (work_order_id, batch_id, station_code, dryer_machine_id, dry_temperature_c, completed_quantity, created_at)
VALUES
('WO-1001', 'BATCH-001', 'DRYING', 'DRYER-01', 75, 120, NOW() - INTERVAL '25 minutes'),
('WO-1001', 'BATCH-002', 'DRYING', 'DRYER-02', 70, 80, NOW() - INTERVAL '20 minutes'),
('WO-1002', 'BATCH-003', 'DRYING', 'DRYER-01', 80, 200, NOW() - INTERVAL '10 minutes');

INSERT INTO folding_events (work_order_id, batch_id, station_code, folding_line_id, pieces_folded, quality_passed, created_at)
VALUES
('WO-1001', 'BATCH-001', 'FOLDING', 'FOLD-01', 120, TRUE, NOW() - INTERVAL '12 minutes'),
('WO-1001', 'BATCH-002', 'FOLDING', 'FOLD-02', 80, TRUE, NOW() - INTERVAL '8 minutes');
