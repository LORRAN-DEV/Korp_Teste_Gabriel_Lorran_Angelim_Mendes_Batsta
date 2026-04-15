import { Injectable, signal } from '@angular/core';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  notifications = signal<Notification[]>([]);

  success(message: string) { this.add('success', message); }
  error(message: string) { this.add('error', message); }
  warning(message: string) { this.add('warning', message); }
  info(message: string) { this.add('info', message); }

  private add(type: Notification['type'], message: string) {
    const id = Date.now().toString();
    this.notifications.update(n => [...n, { id, type, message }]);
    setTimeout(() => this.remove(id), 5000);
  }

  remove(id: string) {
    this.notifications.update(n => n.filter(x => x.id !== id));
  }
}
