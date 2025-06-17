import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import {
  AcheteurDashboardComponent,
  PaiementListComponent,
  PaiementCreateComponent,
  FactureListComponent,
  AcheteurLayoutComponent
} from './components';
import { RoleGuard } from '../../core/guards/role.guard';

const routes: Routes = [
  { 
    path: '', 
    component: AcheteurLayoutComponent,
    canActivate: [RoleGuard],
    data: { roles: ['CLIENT'] }, // Spécifier que seuls les utilisateurs avec le rôle CLIENT peuvent accéder
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AcheteurDashboardComponent },
      { path: 'paiements', component: PaiementListComponent },
      { path: 'paiements/new', component: PaiementCreateComponent },
      { path: 'factures', component: FactureListComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AcheteurRoutingModule { }
