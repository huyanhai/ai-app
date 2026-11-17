import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class PlatformFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const status = error instanceof HttpException
      ? error.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = error instanceof HttpException ? error.getResponse() : undefined;
    const message = typeof body === 'string'
      ? body
      : typeof body === 'object' && body && 'message' in body
        ? Array.isArray(body.message) ? body.message.join('；') : String(body.message)
        : status >= 500 ? '平台桥接内部错误' : '请求失败';
    if (request.path.includes('/model/')) {
      response.status(status).setHeader('X-Agent-Error-Code', String(status)).json({
        error: { message, type: status >= 500 ? 'api_error' : 'invalid_request_error' },
      });
      return;
    }
    response.status(status).json({ code: status || 500, msg: message });
  }
}
