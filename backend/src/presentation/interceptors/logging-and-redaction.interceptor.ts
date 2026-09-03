import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class LoggingAndRedactionInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => this.redactSensitiveData(data)),
    );
  }

  private redactSensitiveData(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.redactSensitiveData(item));
    }
    if (typeof obj === 'object') {
      const sanitized: Record<string, any> = {};
      for (const key of Object.keys(obj)) {
        if (['encryptedSecret', 'password', 'secret', 'connectionString'].includes(key)) {
          // If source entity or DTO has secret, replace with safe indicator
          sanitized.hasSecret = Boolean(obj[key]);
        } else {
          sanitized[key] = this.redactSensitiveData(obj[key]);
        }
      }
      return sanitized;
    }
    return obj;
  }
}
