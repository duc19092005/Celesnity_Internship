import * as mqtt from 'mqtt';
import { SourceConfig } from '../../domain/entities/source.entity';
import { SourceType } from '../../domain/enums/common.enums';
import { CollectorExecutionResult, DiscoveredSchemaResult, ICollectorAdapter, RawCollectedItem } from '../../application/ports';

export class MosquittoMqttAdapter implements ICollectorAdapter {
  private client: mqtt.MqttClient | null = null;
  private readonly buffer: RawCollectedItem[] = [];

  public supports(type: SourceType): boolean {
    return type === SourceType.MQTT;
  }

  public async testConnection(config: SourceConfig): Promise<{ connected: boolean; latencyMs: number; message: string }> {
    const start = Date.now();
    const brokerUrl = config.brokerUrl || process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

    return new Promise((resolve) => {
      let client: mqtt.MqttClient;
      try {
        client = mqtt.connect(brokerUrl, {
          connectTimeout: config.timeoutMs || 3000,
          reconnectPeriod: 0,
        });

        const timer = setTimeout(() => {
          client.end(true);
          resolve({
            connected: false,
            latencyMs: Date.now() - start,
            message: 'MQTT connection timed out',
          });
        }, config.timeoutMs || 3000);

        client.on('connect', () => {
          clearTimeout(timer);
          client.end(true);
          resolve({
            connected: true,
            latencyMs: Date.now() - start,
            message: `Successfully connected to MQTT Broker at ${brokerUrl}`,
          });
        });

        client.on('error', (err) => {
          clearTimeout(timer);
          client.end(true);
          resolve({
            connected: false,
            latencyMs: Date.now() - start,
            message: `MQTT connection error: ${err.message}`,
          });
        });
      } catch (err: any) {
        resolve({
          connected: false,
          latencyMs: Date.now() - start,
          message: `MQTT connect exception: ${err.message}`,
        });
      }
    });
  }

  public async discoverSchema(config: SourceConfig): Promise<DiscoveredSchemaResult> {
    return {
      fields: [
        { name: 'batchId', type: 'string', example: 'BATCH-001' },
        { name: 'station', type: 'string', example: 'WASHING' },
        { name: 'machineId', type: 'string', example: 'WASH-01' },
        { name: 'temperatureC', type: 'number', example: 65 },
        { name: 'qualityStatus', type: 'string', example: 'PASS' },
      ],
      metadata: {
        topics: [
          'factory/lines/+/washing/+/telemetry',
          'factory/lines/+/drying/+/telemetry',
        ],
      },
    };
  }

  public async collect(config: SourceConfig): Promise<CollectorExecutionResult> {
    const start = Date.now();
    // Flush items from in-memory telemetry buffer if any
    const items = [...this.buffer];
    this.buffer.length = 0;

    return {
      success: true,
      items,
      errors: [],
      durationMs: Date.now() - start,
    };
  }

  public pushTelemetry(item: RawCollectedItem): void {
    this.buffer.push(item);
  }
}
