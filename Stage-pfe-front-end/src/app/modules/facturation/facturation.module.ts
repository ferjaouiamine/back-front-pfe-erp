import { NgModule } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FacturationRoutingModule } from './facturation-routing.module';
import { FactureDetailComponent } from './components/facture-detail/facture-detail.component';
import { RouterModule } from '@angular/router';
import { VendorFacturesComponent } from './components/vendor-factures/vendor-factures.component';
import { VendorFactureDetailComponent } from './components/vendor-facture-detail/vendor-facture-detail.component';
import { VendorDashboardComponent } from './components/vendor-dashboard/vendor-dashboard.component';


@NgModule({
  declarations: [
    VendorFacturesComponent,
    VendorFactureDetailComponent,
    VendorDashboardComponent,
    FactureDetailComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    FacturationRoutingModule
  ],
  providers: [
    DatePipe,
    CurrencyPipe
  ]
})
export class FacturationModule { }
