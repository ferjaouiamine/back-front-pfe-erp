import { NgModule } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { MaterialModule } from '../../shared/material.module';

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
import { LowStockComponent } from './components/low-stock/low-stock.component';
import { CategoryManagementComponent } from './components/category-management/category-management.component';
import { ProduitsCommandeComponent } from './components/produits-commande/produits-commande.component';
import { ReceptionCommandeComponent } from './components/reception-commande/reception-commande.component';
import { CategoryFormDialogComponent } from './components/category-management/category-form-dialog/category-form-dialog.component';
import { PurchaseOrderDetailPlusComponent } from './components/purchase-order-detail-plus/purchase-order-detail-plus.component';
import { OrderItemCreationComponent } from './components/order-item-creation/order-item-creation.component';
import { QuantiteDialogComponent } from './components/produits-commande/quantite-dialog/quantite-dialog.component';
import { EmailDialogComponent } from './dialogs/email-dialog/email-dialog.component';
import { PurchaseOrderService } from './services/purchase-order.service';
import { ProductService } from './services/product.service';
import { StockCommandeService } from './services/stock-commande.service';

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
    PurchaseOrderDetailComponent,
    PurchaseOrderDetailPlusComponent,
    OrderItemCreationComponent,
    LowStockComponent,
    ProduitsCommandeComponent,
    ReceptionCommandeComponent,
    QuantiteDialogComponent,
    EmailDialogComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    SharedModule,
    StockRoutingModule,
    HttpClientModule,
    CategoryManagementComponent,
    CategoryFormDialogComponent,
    // Module Angular Material centralisé
    MaterialModule
  ],
  providers: [
    // Ajouter les services pour résoudre les problèmes d'injection
    PurchaseOrderService,
    ProductService,
    StockCommandeService,
    CurrencyPipe
  ]
})
export class StockModule { }
