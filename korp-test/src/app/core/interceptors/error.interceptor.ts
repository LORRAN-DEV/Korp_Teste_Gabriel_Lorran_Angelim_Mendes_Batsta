import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NotificationService } from '../services/notification.service';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(private notificationService: NotificationService) { }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        let errorMessage = 'Ocorreu um erro na requisição';

        if (error.error instanceof ErrorEvent) {
          // Erro do cliente
          errorMessage = error.error.message;
        } else if (error.status === 0) {
          // Sem conexão
          errorMessage = '❌ Erro ao conectar ao servidor. Verifique se os microsserviços estão rodando (porta 8081/8082)';
        } else if (error.status === 404) {
          // Não encontrado
          errorMessage = '❌ Recurso não encontrado (404)';
        } else if (error.status === 400) {
          // Requisição inválida
          errorMessage = `❌ Dados inválidos: ${error.error?.message || 'Verifique os campos preenchidos'}`;
        } else if (error.status === 500) {
          // Erro do servidor
          errorMessage = '❌ Erro no servidor. Tente novamente';
        } else {
          errorMessage = error.error?.message || `Erro ${error.status}: ${error.statusText}`;
        }

        console.error('Erro capturado:', errorMessage, error);
        this.notificationService.error(errorMessage);

        return throwError(() => error);
      })
    );
  }
}
