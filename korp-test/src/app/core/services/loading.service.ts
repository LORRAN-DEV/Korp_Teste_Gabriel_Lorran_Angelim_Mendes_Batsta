import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private requestCounter = signal(0);
  isLoading = this.requestCounter.asReadonly();

  incrementRequest() {
    this.requestCounter.update(count => count + 1);
  }

  decrementRequest() {
    this.requestCounter.update(count => Math.max(0, count - 1));
  }

  reset() {
    this.requestCounter.set(0);
  }
}
