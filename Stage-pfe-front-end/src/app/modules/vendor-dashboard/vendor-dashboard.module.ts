import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { VendorDashboardRoutingModule } from './vendor-dashboard-routing.module';
import { VendorDashboardHomeComponent } from './components/vendor-dashboard-home/vendor-dashboard-home.component';

// Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatGridListModule } from '@angular/material/grid-list';

@NgModule({
  declarations: [
    VendorDashboardHomeComponent
  ],
  imports: [
    CommonModule,
    VendorDashboardRoutingModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
    MatGridListModule
  ]
})
export class VendorDashboardModule { }
