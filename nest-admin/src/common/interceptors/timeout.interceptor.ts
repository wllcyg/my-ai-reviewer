import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Observable, throwError, TimeoutError } from 'rxjs'
import { catchError, timeout } from 'rxjs/operators'

import { BYPASS_KEY } from '../decorators/bypass.decorator'

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector?: Reflector,
    private readonly time: number = 10000,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (this.reflector) {
      const bypass = this.reflector.get<boolean>(
        BYPASS_KEY,
        context.getHandler(),
      )
      if (bypass)
        return next.handle()
    }

    return next.handle().pipe(
      timeout(this.time),
      catchError((err) => {
        if (err instanceof TimeoutError)
          return throwError(() => new RequestTimeoutException('请求超时'))

        return throwError(() => err)
      }),
    )
  }
}
