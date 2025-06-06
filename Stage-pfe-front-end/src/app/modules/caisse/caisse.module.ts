import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CaisseRoutingModule } from './caisse-routing.module';
import { VendorDashboardComponent } from './components/vendor-dashboard/vendor-dashboard.component';
import { PosComponent } from './components/pos/pos.component';
import { ProductDetailsDialogComponent } from './components/product-details-dialog/product-details-dialog.component';

// Angular Material Imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';


@NgModule({
  declarations: [
    VendorDashboardComponent,
    PosComponent,
    ProductDetailsDialogComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CaisseRoutingModule,
    // Angular Material
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    MatListModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatDialogModule,
    MatExpansionModule,
    MatTooltipModule
  ]
})
export class CaisseModule { }
