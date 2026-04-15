import { Routes } from '@angular/router';
import { DashboardComponent } from './modules/dashboard/dashboard.component';
import { ProdutosPageComponent } from './modules/inventory/pages/produtos-page/produtos-page.component';
import { NotaListComponent } from './modules/billing/pages/nota-list/nota-list.component';
import { NotaFormComponent } from './modules/billing/pages/nota-form/nota-form.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'produtos', component: ProdutosPageComponent },
  { path: 'notas', component: NotaListComponent },
  { path: 'nota-nova', component: NotaFormComponent },
  { path: '**', redirectTo: '' }
];
