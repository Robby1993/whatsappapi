import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  status: boolean;
  code: number;
  message: string;
  result: T;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const response = context.switchToHttp().getResponse();
    const statusCode = response.statusCode || HttpStatus.OK;

    return next.handle().pipe(
      map((data) => {
        // Handle custom message if returned as an object with message property
        let message = 'Success';
        let result = data;

        if (data && typeof data === 'object' && 'message' in data && 'result' in data) {
          message = data.message;
          result = data.result;
        } else if (data && typeof data === 'object' && 'message' in data) {
          message = data.message;
          result = null;
        }

        return {
          status: statusCode >= 200 && statusCode < 300,
          code: statusCode,
          message: message,
          result: result,
        };
      }),
    );
  }
}
