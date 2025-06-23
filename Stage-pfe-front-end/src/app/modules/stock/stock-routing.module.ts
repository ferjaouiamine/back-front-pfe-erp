import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StockDashboardComponent } from './components/dashboard/dashboard.component';
import { StockListComponent } from './components/stock-list/stock-list.component';
import { StockDetailComponent } from './components/stock-detail/stock-detail.component';
import { StockCreateComponent } from './components/stock-create/stock-create.component';
import { StockMovementComponent } from './components/stock-movement/stock-movement.component';
import { InventoryComponent } from './components/inventory/inventory.component';
import { ProfileComponent } from './components/profile/profile.component';
import { PurchaseOrderListComponent } from './components/purchase-order-list/purchase-order-list.component';
import { PurchaseOrderDetailComponent } from './components/purchase-order-detail/purchase-order-detail.component';
import { PurchaseOrderDetailPlusComponent } from './components/purchase-order-detail-plus/purchase-order-detail-plus.component';
import { LowStockComponent } from './components/low-stock/low-stock.component';
import { CategoryManagementComponent } from './components/category-management/category-management.component';

const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: StockDashboardComponent },
  { path: 'list', component: StockListComponent },
  { path: 'detail/:id', component: StockDetailComponent },
  { path: 'create', component: StockCreateComponent },
  { path: 'edit/:id', component: StockCreateComponent },
  { path: 'movements', component: StockMovementComponent },
  { path: 'inventory', component: InventoryComponent },
  { path: 'profile', component: ProfileComponent },
  
  // Routes pour la gestion des commandes d'achat
  { path: 'purchase-orders', component: PurchaseOrderListComponent },
  { path: 'purchase-orders/new', component: PurchaseOrderDetailPlusComponent },
  { path: 'purchase-orders/view/:id', component: PurchaseOrderDetailPlusComponent, data: { readonly: true } },
  { path: 'purchase-orders/edit/:id', component: PurchaseOrderDetailPlusComponent },
  
  // Routes de l'ancien composant (gardées temporairement pour compatibilité)
  { path: 'purchase-orders-old/new', component: PurchaseOrderDetailComponent },
  { path: 'purchase-orders-old/:id', component: PurchaseOrderDetailComponent, data: { mode: 'view' } },
  { path: 'purchase-orders-old/edit/:id', component: PurchaseOrderDetailComponent, data: { mode: 'edit' } },
  
  // Route pour les produits à faible stock
  { path: 'low-stocks', component: LowStockComponent },
  
  // Route pour la gestion des catégories
  { path: 'categories', component: CategoryManagementComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class StockRoutingModule { }
