import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AchatRoutingModule } from './achat-routing.module';
import { AchatDashboardComponent } from './components/achat-dashboard/achat-dashboard.component';
import { AchatListComponent } from './components/achat-list/achat-list.component';
import { AchatDetailComponent } from './components/achat-detail/achat-detail.component';
import { FournisseurListComponent } from './components/fournisseur-list/fournisseur-list.component';

@NgModule({
  declarations: [
    AchatDashboardComponent,
    AchatListComponent,
    AchatDetailComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    AchatRoutingModule,
    FournisseurListComponent
  ]
})
export class AchatModule { }
