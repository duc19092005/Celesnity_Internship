import { Client, Pool } from 'pg';
import { SourceConfig } from '../../domain/entities/source.entity';
import { SourceType } from '../../domain/enums/common.enums';
import { CollectorExecutionResult, DiscoveredSchemaResult, ICollectorAdapter, RawCollectedItem } from '../../application/ports';

export class PostgresDbCollectorAdapter implements ICollectorAdapter {
  public supports(type: SourceType): boolean {
    return type === SourceType.POSTGRESQL;
  }

  private createClient(config: SourceConfig, secret?: string): Client {
    const password = secret || process.env.PRODUCTION_DB_PASSWORD;
    if (!password && process.env.NODE_ENV !== 'test') {
      throw new Error('PostgreSQL password is required through a masked secret or PRODUCTION_DB_PASSWORD');
    }
    return new Client({
      host: config.host || process.env.PRODUCTION_DB_HOST || 'localhost',
      port: Number(config.port || process.env.PRODUCTION_DB_PORT || 5432),
      database: config.database || process.env.PRODUCTION_DB_NAME || 'production_db',
      user: config.username || process.env.PRODUCTION_DB_USER || 'postgres',
      password,
      connectionTimeoutMillis: config.timeoutMs || 5000,
    });
  }

  public async testConnection(config: SourceConfig, secret?: string): Promise<{ connected: boolean; latencyMs: number; message: string }> {
    const start = Date.now();
    const client = this.createClient(config, secret);
    try {
      await client.connect();
      const res = await client.query('SELECT current_database() as db, version() as ver;');
      await client.end();
      const latencyMs = Date.now() - start;
      return {
        connected: true,
        latencyMs,
        message: `Successfully connected to PostgreSQL database '${res.rows[0]?.db}'`,
      };
    } catch (err: any) {
      try { await client.end(); } catch {}
      return {
        connected: false,
        latencyMs: Date.now() - start,
        message: `PostgreSQL connection failed: ${err.message}`,
      };
    }
  }

  public async discoverSchema(config: SourceConfig, secret?: string): Promise<DiscoveredSchemaResult> {
    const client = this.createClient(config, secret);
    try {
      await client.connect();
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `;
      const tablesRes = await client.query(tablesQuery);

      const columnsQuery = `
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        ORDER BY table_name, ordinal_position;
      `;
      const columnsRes = await client.query(columnsQuery);
      await client.end();

      const tableMap = new Map<string, Array<{ name: string; type: string }>>();
      for (const row of columnsRes.rows) {
        if (!tableMap.has(row.table_name)) {
          tableMap.set(row.table_name, []);
        }
        tableMap.get(row.table_name)!.push({
          name: row.column_name,
          type: row.data_type,
        });
      }

      const tables = tablesRes.rows.map((t: any) => ({
        name: t.table_name,
        columns: tableMap.get(t.table_name) || [],
      }));

      return {
        tables,
        metadata: {
          tableCount: tables.length,
        },
      };
    } catch (err: any) {
      try { await client.end(); } catch {}
      throw new Error(`Schema discovery failed: ${err.message}`);
    }
  }

  public async collect(config: SourceConfig, selectedSchema?: any, secret?: string): Promise<CollectorExecutionResult> {
    const start = Date.now();
    const tableName = String(selectedSchema?.selectedTable || '');
    const requestedColumns = Array.isArray(selectedSchema?.selectedColumns)
      ? selectedSchema.selectedColumns.map(String)
      : [];
    const items: RawCollectedItem[] = [];
    const errors: Array<{ code: string; message: string; rowNumber?: number; rawExcerpt?: string }> = [];

    if (!tableName) {
      return { success: false, items, errors: [{ code: 'MISSING_TABLE_SELECTION', message: 'Select a production table before collection' }], durationMs: Date.now() - start };
    }
    if (!this.isSafeIdentifier(tableName) || requestedColumns.some((column: string) => !this.isSafeIdentifier(column))) {
      return { success: false, items, errors: [{ code: 'INVALID_SCHEMA_SELECTION', message: 'Table or column selection contains an invalid identifier' }], durationMs: Date.now() - start };
    }

    let client: Client;
    try {
      client = this.createClient(config, secret);
    } catch (err: any) {
      return { success: false, items, errors: [{ code: 'MISSING_DATABASE_SECRET', message: err.message }], durationMs: Date.now() - start };
    }

    try {
      await client.connect();
      const columnsResult = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
        [tableName],
      );
      const availableColumns = columnsResult.rows.map((row: any) => String(row.column_name));
      if (availableColumns.length === 0) {
        throw new Error(`Selected table '${tableName}' does not exist in schema public`);
      }
      const selectedColumns = requestedColumns.length > 0 ? requestedColumns : availableColumns;
      const unknownColumns = selectedColumns.filter((column: string) => !availableColumns.includes(column));
      if (unknownColumns.length > 0) {
        throw new Error(`Selected columns do not exist on '${tableName}': ${unknownColumns.join(', ')}`);
      }
      const requiredGroups = [
        { name: 'batch identity', choices: ['batch_id', 'batchId'] },
        { name: 'station', choices: ['station', 'station_code'] },
        { name: 'quantity', choices: ['quantity', 'pieces_count', 'pieces', 'completed_quantity'] },
        { name: 'event time', choices: ['event_time', 'eventTime', 'occurred_at', 'recorded_at', 'created_at'] },
      ];
      const missingRequired = requiredGroups
        .filter((group) => !group.choices.some((column) => availableColumns.includes(column)))
        .map((group) => group.name);
      if (missingRequired.length > 0) {
        throw new Error(`Table '${tableName}' is not a production-event table; missing ${missingRequired.join(', ')}`);
      }

      const primaryKeyResult = await client.query(
        `SELECT a.attname AS column_name
           FROM pg_index i
           JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
           JOIN pg_class c ON c.oid = i.indrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE i.indisprimary AND n.nspname = 'public' AND c.relname = $1
          ORDER BY array_position(i.indkey, a.attnum)`,
        [tableName],
      );
      const primaryKeyColumns = primaryKeyResult.rows.map((row: any) => String(row.column_name));
      if (primaryKeyColumns.length === 0 && !availableColumns.includes('source_record_id')) {
        throw new Error(`Table '${tableName}' requires a primary key or source_record_id for stable observation identity`);
      }
      const requiredProjection = new Set<string>(selectedColumns);
      for (const group of requiredGroups) {
        const column = group.choices.find((candidate) => availableColumns.includes(candidate));
        if (column) requiredProjection.add(column);
      }
      for (const column of ['source_record_id', 'source_revision']) {
        if (availableColumns.includes(column)) requiredProjection.add(column);
      }
      for (const column of primaryKeyColumns) requiredProjection.add(column);

      const orderColumns = primaryKeyColumns.length > 0 ? primaryKeyColumns : ['source_record_id'];
      const projection = [...requiredProjection].map((column: string) => this.quoteIdentifier(column)).join(', ');
      const orderBy = orderColumns.map((column) => `${this.quoteIdentifier(column)} ASC`).join(', ');
      const query = `SELECT ${projection} FROM ${this.quoteIdentifier(tableName)} ORDER BY ${orderBy}`;
      const res = await client.query(query);

      for (const row of res.rows) {
        const primaryKeyIdentity = primaryKeyColumns.map((column) => String(row[column])).join('::');
        const stableRecordId = row.source_record_id || primaryKeyIdentity;
        items.push({
          sourceRecordId: String(stableRecordId),
          sourceRevision: Number(row.source_revision || 1),
          payload: { ...row, sourceTable: tableName },
          observedAt: new Date(),
        });
      }

      return { success: true, items, errors, durationMs: Date.now() - start };
    } catch (err: any) {
      errors.push({ code: 'DB_COLLECT_ERROR', message: `Failed to collect table '${tableName}': ${err.message}` });
      return { success: false, items, errors, durationMs: Date.now() - start };
    } finally {
      try { await client.end(); } catch {}
    }
  }

  private isSafeIdentifier(value: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);
  }

  private quoteIdentifier(value: string): string {
    if (!this.isSafeIdentifier(value)) {
      throw new Error(`Unsafe SQL identifier: ${value}`);
    }
    return `"${value}"`;
  }
}
