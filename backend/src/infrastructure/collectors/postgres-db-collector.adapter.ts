import { Client, Pool } from 'pg';
import { SourceConfig } from '../../domain/entities/source.entity';
import { SourceType } from '../../domain/enums/common.enums';
import { CollectorExecutionResult, DiscoveredSchemaResult, ICollectorAdapter, RawCollectedItem } from '../../application/ports';

export class PostgresDbCollectorAdapter implements ICollectorAdapter {
  public supports(type: SourceType): boolean {
    return type === SourceType.POSTGRESQL;
  }

  private createClient(config: SourceConfig, secret?: string): Client {
    return new Client({
      host: config.host || process.env.PRODUCTION_DB_HOST || 'localhost',
      port: Number(config.port || process.env.PRODUCTION_DB_PORT || 5432),
      database: config.database || process.env.PRODUCTION_DB_NAME || 'production_db',
      user: config.username || process.env.PRODUCTION_DB_USER || 'postgres',
      password: secret || process.env.PRODUCTION_DB_PASSWORD || 'postgres',
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
    const tableName = selectedSchema?.selectedTable || 'production_events';
    const items: RawCollectedItem[] = [];
    const errors: Array<{ code: string; message: string; rowNumber?: number; rawExcerpt?: string }> = [];

    // Allowlist check on table name to prevent SQL injection
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return {
        success: false,
        items: [],
        errors: [{ code: 'INVALID_TABLE_NAME', message: `Invalid table name identifier: '${tableName}'` }],
        durationMs: Date.now() - start,
      };
    }

    const client = this.createClient(config, secret);
    try {
      await client.connect();
      const query = `SELECT * FROM "${tableName}" ORDER BY row_id ASC;`;
      const res = await client.query(query);
      await client.end();

      for (let idx = 0; idx < res.rows.length; idx++) {
        const row = res.rows[idx];
        const stableRecordId = row.source_record_id || `ROW-${row.row_id || row.id || idx + 1}`;
        const revision = row.source_revision || 1;

        items.push({
          sourceRecordId: stableRecordId,
          sourceRevision: revision,
          payload: {
            ...row,
            sourceTable: tableName,
          },
          observedAt: new Date(),
        });
      }

      return {
        success: true,
        items,
        errors,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      try { await client.end(); } catch {}
      errors.push({
        code: 'DB_COLLECT_ERROR',
        message: `Failed to collect table '${tableName}': ${err.message}`,
      });
      return {
        success: false,
        items,
        errors,
        durationMs: Date.now() - start,
      };
    }
  }
}
