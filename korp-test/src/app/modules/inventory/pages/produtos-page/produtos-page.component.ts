import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface Produto {
  id?: number;
  codigo: string;
  nome: string;
  quantidade_estoque: number;
  preco_unitario: number;
}

@Component({
  selector: 'app-produtos-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './produtos-page.component.html',
  styleUrls: ['./produtos-page.component.css']
})
export class ProdutosPageComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  
  produtos: Produto[] = [];
  showModal = false;
  editingId: number | null = null;
  loading = false;
  error = '';
  message = '';

  formData = {
    codigo: '',
    nome: '',
    quantidade_estoque: 0,
    preco_unitario: 0
  };

  constructor(private inventoryService: InventoryService) {}

  ngOnInit() {
    this.loadProdutos();
  }

  loadProdutos() {
    this.loading = true;
    this.inventoryService.getAllProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data: any) => {
          this.produtos = data;
          this.loading = false;
        },
        error: (err: any) => {
          this.error = 'Erro ao carregar produtos: ' + (err.error?.message || 'Verifique a conexão');
          this.loading = false;
        }
      });
  }

  openModal() {
    this.showModal = true;
    this.resetForm();
  }

  closeModal() {
    this.showModal = false;
    this.resetForm();
  }

  resetForm() {
    this.formData = {
      codigo: '',
      nome: '',
      quantidade_estoque: 0,
      preco_unitario: 0
    };
    this.editingId = null;
    this.error = '';
  }

  saveProduto() {
    // Validações
    if (!this.formData.codigo.trim()) {
      this.error = 'Preencha o código do produto';
      return;
    }
    if (!this.formData.nome.trim()) {
      this.error = 'Preencha o nome do produto';
      return;
    }
    if (this.formData.quantidade_estoque < 0) {
      this.error = 'Quantidade não pode ser negativa';
      return;
    }
    if (this.formData.preco_unitario < 0) {
      this.error = 'Preço não pode ser negativo';
      return;
    }

    this.loading = true;
    const data = { ...this.formData };

    if (this.editingId) {
      // Editar produto existente
      this.inventoryService.updateProduct(this.editingId, data)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.message = '✅ Produto atualizado com sucesso!';
            this.loading = false;
            this.closeModal();
            this.loadProdutos();
            setTimeout(() => this.message = '', 3000);
          },
          error: (err: any) => {
            this.error = 'Erro ao atualizar: ' + (err.error?.message || err.statusText);
            this.loading = false;
          }
        });
    } else {
      // Criar novo produto
      this.inventoryService.createProduct(data)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.message = '✅ Produto cadastrado com sucesso!';
            this.loading = false;
            this.closeModal();
            this.loadProdutos();
            setTimeout(() => this.message = '', 3000);
          },
          error: (err: any) => {
            this.error = 'Erro ao cadastrar: ' + (err.error?.message || err.statusText);
            this.loading = false;
          }
      });
    }
  }

  editProduto(produto: Produto) {
    // NÃ£o chamar openModal() aqui, porque openModal() reseta o form.
    this.editingId = produto.id ?? null;
    this.formData = {
      codigo: produto.codigo ?? '',
      nome: produto.nome ?? '',
      quantidade_estoque: produto.quantidade_estoque ?? 0,
      preco_unitario: produto.preco_unitario ?? 0,
    };
    this.error = '';
    this.showModal = true;
  }

  deleteProduto(id: number | undefined) {
    if (id && confirm('Deseja remover este produto?')) {
      this.loading = true;
      this.inventoryService.deleteProduct(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.message = '✅ Produto removido com sucesso!';
            this.loading = false;
            this.loadProdutos();
            setTimeout(() => this.message = '', 3000);
          },
          error: (err: any) => {
            this.error = 'Erro ao remover: ' + (err.error?.message || err.statusText);
            this.loading = false;
          }
        });
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }
}
