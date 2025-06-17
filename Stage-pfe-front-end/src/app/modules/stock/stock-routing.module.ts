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
  { path: 'purchase-orders/new', component: PurchaseOrderDetailComponent },
  { path: 'purchase-orders/:id', component: PurchaseOrderDetailComponent, data: { mode: 'view' } },
  { path: 'purchase-orders/edit/:id', component: PurchaseOrderDetailComponent, data: { mode: 'edit' } }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class StockRoutingModule { }
