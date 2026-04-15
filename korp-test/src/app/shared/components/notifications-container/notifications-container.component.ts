import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Notification } from '../../services/notification.service';

@Component({
  selector: 'app-notifications-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed top-4 right-4 z-9999 space-y-2">
      <div *ngFor="let notification of notificationService.notifications()" 
           class="notification" 
           [ngClass]="'notification-' + notification.type"
           [@slideIn]>
        <div class="flex items-start justify-between">
          <div class="flex-1 flex items-center gap-3">
            <svg *ngIf="notification.type === 'success'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <svg *ngIf="notification.type === 'error'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
            <svg *ngIf="notification.type === 'warning'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4v2m0-10a8 8 0 110 16 8 8 0 010-16z"></path>
            </svg>
            <svg *ngIf="notification.type === 'info'" class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <p class="text-sm font-medium">{{ notification.message }}</p>
          </div>
          <button (click)="notificationService.remove(notification.id)" class="ml-4 flex-shrink-0">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .notification {
      @apply p-4 rounded-lg shadow-lg min-w-80 max-w-md;
      animation: slideInRight 0.3s ease-out;
    }

    .notification-success {
      @apply bg-green-50 text-green-800 border border-green-200;
    }

    .notification-error {
      @apply bg-red-50 text-red-800 border border-red-200;
    }

    .notification-warning {
      @apply bg-yellow-50 text-yellow-800 border border-yellow-200;
    }

    .notification-info {
      @apply bg-blue-50 text-blue-800 border border-blue-200;
    }

    @keyframes slideInRight {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `]
})
export class NotificationsContainerComponent {
  notificationService = inject(NotificationService);
}
