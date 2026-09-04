import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import {
  AdapterNotFoundException,
  EntityNotFoundException,
  InvalidOperationException,
} from '../../domain/exceptions/domain.exceptions';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;
      message = typeof res === 'string' ? res : res.message || exception.message;
      code = res.error || 'HTTP_ERROR';
    } else if (exception instanceof EntityNotFoundException) {
      status = HttpStatus.NOT_FOUND;
      message = exception.message;
      code = 'NOT_FOUND';
    } else if (exception instanceof AdapterNotFoundException) {
      status = HttpStatus.BAD_REQUEST;
      message = exception.message;
      code = 'ADAPTER_NOT_FOUND';
    } else if (exception instanceof InvalidOperationException) {
      status = HttpStatus.CONFLICT;
      message = exception.message;
      code = 'INVALID_OPERATION';
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Redact any potential credentials/keys from error message
    const sanitizedMessage = this.redactSecrets(String(message));

    this.logger.error(`[${status}] ${code}: ${sanitizedMessage}`);

    response.status(status).json({
      statusCode: status,
      code,
      message: sanitizedMessage,
      timestamp: new Date().toISOString(),
    });
  }

  private redactSecrets(str: string): string {
    return str
      .replace(/(postgres(?:ql)?:\/\/[^:\s/@]+:)([^@\s/]+)(@)/gi, '$1••••••••$3')
      .replace(/(bearer\s+)[a-z0-9._~+\/-]+=*/gi, '$1••••••••')
      .replace(/(["']?(?:password|secret|key|token|authorization|api[_-]?key|client[_-]?secret)["']?\s*[:=]\s*["']?)([^"'\s&,;}]+)/gi, '$1••••••••')
      .replace(/((?:password|secret|key|token|authorization|api[_-]?key|client[_-]?secret)=)([^\s&;]+)/gi, '$1••••••••');
  }
}
