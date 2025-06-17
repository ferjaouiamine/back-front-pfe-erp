import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

import { StockRoutingModule } from './stock-routing.module';
import { StockDashboardComponent } from './components/dashboard/dashboard.component';
import { StockListComponent } from './components/stock-list/stock-list.component';
import { StockDetailComponent } from './components/stock-detail/stock-detail.component';
import { StockCreateComponent } from './components/stock-create/stock-create.component';
import { StockMovementComponent } from './components/stock-movement/stock-movement.component';
import { InventoryComponent } from './components/inventory/inventory.component';
import { StockMovementNewComponent } from './components/stock-movement-new/stock-movement-new.component';
import { PurchaseOrderListComponent } from './components/purchase-order-list/purchase-order-list.component';
import { PurchaseOrderDetailComponent } from './components/purchase-order-detail/purchase-order-detail.component';

@NgModule({
  declarations: [
    StockDashboardComponent,
    StockListComponent,
    StockDetailComponent,
    StockCreateComponent,
    StockMovementComponent,
    InventoryComponent,
    StockMovementNewComponent,
    PurchaseOrderListComponent,
    PurchaseOrderDetailComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    SharedModule,
    StockRoutingModule,
    HttpClientModule
  ],
  providers: []
})
export class StockModule { }
