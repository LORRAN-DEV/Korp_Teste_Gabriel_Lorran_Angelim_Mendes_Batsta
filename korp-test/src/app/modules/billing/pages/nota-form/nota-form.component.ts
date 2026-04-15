import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import { BillingService } from '../../services/billing.service';
import { InventoryService } from '../../../inventory/services/inventory.service';

interface NotaItem {
  id?: number;
  produto_id: number;
  codigo: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

interface Nota {
  id?: number;
  numero_nf: string;
  cliente_nome: string;
  cliente_cpf_cnpj?: string;
  status: 'ABERTA' | 'IMPRESSA' | 'CANCELADA';
  itens: NotaItem[];
  valor_total: number;
}

@Component({
  selector: 'app-nota-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './nota-form.component.html',
  styleUrls: ['./nota-form.component.css']
})
export class NotaFormComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  nota: Nota = {
    numero_nf: '',
    cliente_nome: '',
    status: 'ABERTA',
    itens: [],
    valor_total: 0
  };

  produtos: any[] = [];
  selectedProduct: any = null;
  quantity: number = 1;
  loading = false;
  error = '';
  message = '';
  isEditMode = false;

  constructor(
    private billingService: BillingService,
    private inventoryService: InventoryService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.loadProducts();

    // Verifica se há um ID na rota (/notas/:id)
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEditMode = true;
      this.loadExistingNote(Number(idParam));
    } else {
      this.generateNoteNumber();
    }
  }

  // Carrega nota existente + seus itens do backend
  loadExistingNote(id: number) {
    this.loading = true;
    this.error = '';

    this.billingService.getNote(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (nota: any) => {
          // Carrega os itens da nota
          this.billingService.getNoteItems(id)
            .pipe(
              takeUntilDestroyed(this.destroyRef),
              finalize(() => this.loading = false)
            )
            .subscribe({
              next: (items: any[]) => {
                this.nota = {
                  id: nota.id,
                  numero_nf: nota.numero_nf,
                  cliente_nome: nota.cliente_nome,
                  cliente_cpf_cnpj: nota.cliente_cpf_cnpj,
                  status: nota.status,
                  valor_total: nota.valor_total,
                  itens: (items || []).map((item: any) => ({
                    id: item.id,
                    produto_id: item.produto_id,
                    codigo: item.produto_codigo || item.produto_id,
                    descricao: item.produto_nome || 'Produto #' + item.produto_id,
                    quantidade: item.quantidade,
                    valor_unitario: item.valor_unitario,
                    valor_total: item.valor_total
                  }))
                };
              },
              error: () => {
                this.error = 'Erro ao carregar itens da nota.';
              }
            });
        },
        error: (err: any) => {
          this.loading = false;
          this.error = 'Nota não encontrada: ' + (err.error?.message || 'Erro no servidor');
        }
      });
  }

  generateNoteNumber() {
    // A numeração sequencial é gerada no backend no momento do POST /api/notas.
    this.nota.numero_nf = '';
  }

  loadProducts() {
    this.inventoryService.getAllProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: any) => this.produtos = data,
        error: () => this.error = 'Erro ao carregar produtos.'
      });
  }

  updateItemTotal(index: number) {
    const item = this.nota.itens[index];
    if (item) {
      item.valor_total = item.quantidade * item.valor_unitario;
      this.calculateTotal();
    }
  }

  calculateTotal() {
    this.nota.valor_total = this.nota.itens.reduce(
      (sum, item) => sum + item.quantidade * item.valor_unitario, 0
    );
  }

  addProduct() {
    if (!this.selectedProduct) return;

    // Verifica se produto já está na nota
    const jaExiste = this.nota.itens.find(i => i.produto_id === this.selectedProduct.id);
    if (jaExiste) {
      jaExiste.quantidade += this.quantity;
      jaExiste.valor_total = jaExiste.quantidade * jaExiste.valor_unitario;
      this.calculateTotal();
      this.selectedProduct = null;
      this.quantity = 1;
      return;
    }

    this.nota.itens.push({
      produto_id: this.selectedProduct.id,
      codigo: this.selectedProduct.codigo,
      descricao: this.selectedProduct.nome,
      quantidade: this.quantity,
      valor_unitario: this.selectedProduct.preco_unitario,
      valor_total: this.quantity * this.selectedProduct.preco_unitario
    });

    this.calculateTotal();
    this.selectedProduct = null;
    this.quantity = 1;
  }

  removeItem(index: number) {
    this.nota.itens.splice(index, 1);
    this.calculateTotal();
  }

  saveNote() {
    this.error = '';
    this.message = '';

    if (!this.nota.cliente_nome.trim()) {
      this.error = 'Preencha o nome do cliente.';
      return;
    }

    if (this.nota.itens.length === 0) {
      this.error = 'Adicione pelo menos um produto antes de salvar.';
      return;
    }

    this.loading = true;

    this.billingService.createNote(this.nota)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (response: any) => {
          this.nota.id = response.id;
          if (response?.numero_nf) this.nota.numero_nf = response.numero_nf;
          this.isEditMode = true;

          const itemRequests = this.nota.itens.map(item =>
            this.billingService.addNoteItem(this.nota.id!, {
              produto_id: item.produto_id,
              quantidade: item.quantidade,
              valor_unitario: item.valor_unitario
            })
          );

          (itemRequests.length > 0 ? forkJoin(itemRequests) : of([]))
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                this.message = '✅ Nota salva com sucesso!';
                // Atualiza a URL para /notas/:id sem recarregar o componente
                this.router.navigate(['/notas', this.nota.id], { replaceUrl: true });
              },
              error: () => {
                this.error = 'Nota criada, mas erro ao adicionar itens. Verifique a nota.';
              }
            });
        },
        error: (err: any) => {
          this.error = 'Erro ao salvar nota: ' + (err.error?.message || 'Erro no servidor');
        }
      });
  }

  printNote() {
    this.error = '';
    this.message = '';

    if (this.loading) return;

    if (this.nota.status !== 'ABERTA') {
      this.error = 'Apenas notas com status "Aberta" podem ser finalizadas.';
      return;
    }

    if (!this.nota.id) {
      this.error = 'Salve a nota antes de finalizar.';
      return;
    }

    if (this.nota.itens.length === 0) {
      this.error = 'Adicione pelo menos um produto antes de finalizar.';
      return;
    }

    this.loading = true;

    const deductions = this.nota.itens.map((item) =>
      this.inventoryService.deductStock(item.produto_id, item.quantidade, this.nota.numero_nf).pipe(
        map(() => ({ ok: true as const, item })),
        catchError((err) => of({ ok: false as const, item, err }))
      )
    );

    forkJoin(deductions)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((results) => {
          const failed = results.filter((r) => !r.ok);
          if (failed.length > 0) {
            const succeeded = results.filter((r) => r.ok);
            const compensations = succeeded.map((r) =>
              this.inventoryService.restoreStock(r.item.produto_id, r.item.quantidade, this.nota.numero_nf).pipe(
                catchError(() => of(null))
              )
            );

            return (compensations.length ? forkJoin(compensations) : of([])).pipe(
              switchMap(() =>
                throwError(() => new Error('Falha ao baixar saldo de 1 ou mais itens. Operação cancelada.'))
              )
            );
          }

          // Todos os saldos baixados OK -> fecha a nota no MS-Faturamento
          return this.billingService.printNote(this.nota.id!);
        }),
        finalize(() => (this.loading = false))
      )
      .subscribe({
        next: () => {
          this.nota.status = 'IMPRESSA';
          this.message = '✅ Nota finalizada e fechada com sucesso!';
          setTimeout(() => window.print(), 500);
        },
        error: (err: any) => {
          this.error = 'Erro ao finalizar: ' + (err?.error?.message || err?.message || 'Erro no servidor');
        }
      });
  }

  get notaFinalizada(): boolean {
    return this.nota.status === 'IMPRESSA';
  }

  cancelForm() {
    this.router.navigate(['/notas']);
  }

  formatCurrency(val: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  }
}
