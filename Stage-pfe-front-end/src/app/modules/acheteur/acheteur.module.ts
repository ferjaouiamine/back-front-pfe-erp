import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { NgxStripeModule } from 'ngx-stripe';
import { HttpClientModule } from '@angular/common/http';

import {
  AcheteurDashboardComponent,
  PaiementListComponent,
  PaiementCreateComponent,
  FactureListComponent,
  AcheteurLayoutComponent,
  AcheteurProfileComponent
} from './components';
import { AcheteurService } from './services';
import { RoleGuard } from '../../core/guards/role.guard';
import { FactureService } from '../facturation/services/facture.service';

// Définir les routes directement dans ce module pour éviter les problèmes d'importation
const routes: Routes = [
  { 
    path: '', 
    component: AcheteurLayoutComponent,
    canActivate: [RoleGuard],
    data: { roles: ['ACHETEUR'] }, // Spécifier que seuls les utilisateurs avec le rôle ACHETEUR peuvent accéder
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AcheteurDashboardComponent },
      { path: 'paiements', component: PaiementListComponent },
      { path: 'paiements/new', component: PaiementCreateComponent },
      { path: 'factures', component: FactureListComponent },
      { path: 'profile', component: AcheteurProfileComponent }
    ]
  }
];

@NgModule({
  declarations: [
    AcheteurDashboardComponent,
    PaiementListComponent,
    PaiementCreateComponent,
    FactureListComponent,
    AcheteurLayoutComponent,
    AcheteurProfileComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    HttpClientModule,
    NgxStripeModule.forRoot('pk_test_51YOURSTRIPEKEY'), // Remplacer par votre clé publique Stripe
  ],
  providers: [
    AcheteurService,
    FactureService
  ]
})
export class AcheteurModule { }
