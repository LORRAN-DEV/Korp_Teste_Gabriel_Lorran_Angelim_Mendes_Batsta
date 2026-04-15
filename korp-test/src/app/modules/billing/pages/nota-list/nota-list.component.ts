import { Component, OnInit, inject, DestroyRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BillingService } from '../../services/billing.service';
import { InventoryService } from '../../../inventory/services/inventory.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { StatusNotaPipe } from '../../../../shared/pipes/status-nota.pipe';

interface NotaFiscal {
  id: number;
  numero_nf: string;
  cliente_nome: string;
  cliente_cpf_cnpj?: string;
  valor_total: number;
  status: 'ABERTA' | 'IMPRESSA' | 'CANCELADA';
  data_emissao?: string;
}

interface NotaItem {
  id: number;
  nota_id: number;
  produto_id: number;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  produto_nome?: string;
}

@Component({
  selector: 'app-nota-list',
  standalone: true,
  imports: [CommonModule, RouterLink, StatusNotaPipe],
  templateUrl: './nota-list.component.html',
  styleUrls: ['./nota-list.component.css']
})
export class NotaListComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  notas = signal<NotaFiscal[]>([]);
  filtredNotas = signal<NotaFiscal[]>([]);
  loading = signal(true);
  error = signal('');

  filterStatus = signal<string>('');
  searchTerm = signal<string>('');

  printingNotaId = signal<number | null>(null);

  showDetailsModal = signal(false);
  detailsLoading = signal(false);
  notaDetails = signal<NotaFiscal | null>(null);
  notaItems = signal<NotaItem[]>([]);

  constructor(
    private billingService: BillingService,
    private inventoryService: InventoryService
  ) {}

  ngOnInit() {
    this.loadNotas();
  }

  loadNotas() {
    this.loading.set(true);
    this.error.set('');

    this.billingService.getAllNotes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (notes: NotaFiscal[]) => {
          this.notas.set(notes || []);
          this.applyFilters();
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set('Erro ao carregar: ' + (err.error?.message || err.statusText));
          this.loading.set(false);
        }
      });
  }

  applyFilters() {
    let filtered = this.notas();
    if (this.filterStatus()) {
      filtered = filtered.filter(n => n.status === this.filterStatus());
    }
    if (this.searchTerm()) {
      const term = this.searchTerm().toLowerCase();
      filtered = filtered.filter(n =>
        n.numero_nf.toLowerCase().includes(term) ||
        n.cliente_nome.toLowerCase().includes(term)
      );
    }
    this.filtredNotas.set(filtered);
  }

  onStatusFilterChange(status: string) {
    this.filterStatus.set(status);
    this.applyFilters();
  }

  onSearchChange(term: string) {
    this.searchTerm.set(term);
    this.applyFilters();
  }

  printNota(nota: NotaFiscal) {
    // GUARD: bloqueia status diferente de ABERTA (segurança dupla além do *ngIf)
    if (nota.status !== 'ABERTA') return;

    // GUARD: bloqueia se já há uma nota sendo processada
    if (this.printingNotaId() !== null) return;

    // Exibe spinner no botão imediatamente — impede cliques duplos
    this.printingNotaId.set(nota.id);
    this.error.set('');

    this.billingService.finalizeAndPrint(nota.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.printingNotaId.set(null)) // sempre limpa o spinner
      )
      .subscribe({
        next: () => {
          // CORREÇÃO DO RACE CONDITION:
          // Atualiza o signal localmente em vez de recarregar do backend.
          // Recarregar causava race condition: o backend podia ainda não ter
          // persistido o status IMPRESSA quando a nova lista chegava ao frontend,
          // fazendo a nota aparecer como ABERTA novamente.
          this.notas.update(notas =>
            notas.map(n =>
              n.id === nota.id ? { ...n, status: 'IMPRESSA' } : n
            )
          );
          this.applyFilters(); // re-aplica filtros com o novo status
        },
        error: (err: any) => {
          // Nota continua ABERTA se o backend retornou erro — sem dedução de estoque
          this.error.set('Erro ao processar: ' + (err.error?.message || 'Erro no servidor'));
        }
      });
  }

  deleteNota(id: number) {
    if (!confirm('Tem certeza que deseja deletar?')) return;
    this.billingService.deleteNote(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadNotas(),
        error: (err) => this.error.set('Erro ao deletar: ' + (err.error?.message || err.statusText))
      });
  }

  viewDetails(nota: NotaFiscal) {
    this.notaDetails.set(nota);
    this.detailsLoading.set(true);
    this.showDetailsModal.set(true);
    this.billingService.getNoteItems(nota.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.notaItems.set(items || []);
          this.detailsLoading.set(false);
        },
        error: () => this.detailsLoading.set(false)
      });
  }

  closeDetailsModal() {
    this.showDetailsModal.set(false);
    this.notaDetails.set(null);
    this.notaItems.set([]);
  }

  get isAnyPrinting(): boolean {
    return this.printingNotaId() !== null;
  }
}
