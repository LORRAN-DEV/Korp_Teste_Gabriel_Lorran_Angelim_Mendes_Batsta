  import { Component, OnInit, inject, DestroyRef, signal } from '@angular/core';
  import { CommonModule } from '@angular/common';
  import { RouterLink, Router, NavigationEnd } from '@angular/router';
  import { BillingService } from '../billing/services/billing.service';
  import { InventoryService } from '../inventory/services/inventory.service';
  import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
  import { filter, timeout } from 'rxjs';

  @Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css']
  })
  export class DashboardComponent implements OnInit {
    private destroyRef = inject(DestroyRef);

    productsCount = 0;
    openInvoices = 0;
    closedInvoices = 0;
    lowStockProducts = 0;
    loading = true;

    suggestionsLoading = signal(false);
    showSuggestions = signal(false);
    suggestions = signal<any>(null);
    suggestionsError = signal('');

    constructor(
      private billingService: BillingService,
      private inventoryService: InventoryService,
      private router: Router
    ) {}

    ngOnInit() {
      this.loadStats();

      // Recarrega sempre que navegar para esta página
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(() => {
        this.loadStats();
      });
    }

    loadStats() {
      this.loading = true;

      this.inventoryService.getAllProducts()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (products: any) => {
            this.productsCount = products.length;
            this.lowStockProducts = products.filter((p: any) => p.quantidade_estoque < p.quantidade_minima).length;
          },
          error: () => {
            this.productsCount = 0;
            this.lowStockProducts = 0;
          }
        });

      this.billingService.getAllNotes()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (notes: any) => {
            this.openInvoices = notes.filter((n: any) => n.status === 'ABERTA').length;
            this.closedInvoices = notes.filter((n: any) => n.status === 'IMPRESSA').length;
            this.loading = false;
          },
          error: () => {
            this.openInvoices = 0;
            this.closedInvoices = 0;
            this.loading = false;
          }
        });
    }

    suggestReposition() {
      this.suggestionsLoading.set(true);
      this.suggestionsError.set('');
      this.suggestions.set(null);

      this.inventoryService.getSuggestReposition()
        .pipe(
          timeout(60000), // Aumentar timeout para 60 segundos
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe({
          next: (data: any) => {
            this.suggestions.set(data);
            this.showSuggestions.set(true);
            this.suggestionsLoading.set(false);
          },
          error: (err: any) => {
            this.suggestionsError.set('Erro ao obter sugestões: ' + (err.error?.message || err.statusText || err.name));
            this.suggestionsLoading.set(false);
          }
        });
    }

    closeSuggestions() {
      this.showSuggestions.set(false);
      this.suggestions.set(null);
    }
  }
