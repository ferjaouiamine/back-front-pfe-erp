import { NgModule } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared/shared.module';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';

// Imports Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';

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
    QuantiteDialogComponent
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
    // Modules Angular Material
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTableModule,
    MatDividerModule,
    MatTooltipModule,
    MatListModule,
    MatChipsModule,
    MatExpansionModule
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
