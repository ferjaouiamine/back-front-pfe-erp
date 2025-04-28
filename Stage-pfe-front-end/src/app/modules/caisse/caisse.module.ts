import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CaisseRoutingModule } from './caisse-routing.module';
import { VendorDashboardComponent } from './components/vendor-dashboard/vendor-dashboard.component';


@NgModule({
  declarations: [
    VendorDashboardComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    CaisseRoutingModule
  ]
})
export class CaisseModule { }
