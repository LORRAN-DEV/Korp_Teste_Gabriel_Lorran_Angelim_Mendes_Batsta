import { Injectable, signal } from '@angular/core';

export interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  notifications = signal<Notification[]>([]);
  private notificationId = 0;

  success(message: string, duration = 3000) {
    this.show(message, 'success', duration);
  }

  error(message: string, duration = 5000) {
    this.show(message, 'error', duration);
  }

  warning(message: string, duration = 4000) {
    this.show(message, 'warning', duration);
  }

  info(message: string, duration = 3000) {
    this.show(message, 'info', duration);
  }

  private show(message: string, type: Notification['type'], duration: number) {
    const id = `notification-${++this.notificationId}`;
    const notification: Notification = { id, message, type, duration };

    // Adicionar notificação
    const current = this.notifications();
    this.notifications.set([...current, notification]);

    // Remover após duração
    if (duration > 0) {
      setTimeout(() => this.remove(id), duration);
    }
  }

  remove(id: string) {
    const current = this.notifications();
    this.notifications.set(current.filter(n => n.id !== id));
  }
}
