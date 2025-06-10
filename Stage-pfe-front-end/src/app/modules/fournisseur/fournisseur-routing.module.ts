import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Components
import { FournisseurLayoutComponent } from './components/fournisseur-layout/fournisseur-layout.component';
import { FournisseurDashboardComponent } from './components/fournisseur-dashboard/fournisseur-dashboard.component';
import { CommandeListComponent } from './components/commande-list/commande-list.component';
import { CommandeDetailComponent } from './components/commande-detail/commande-detail.component';
import { ProfilFournisseurComponent } from './components/profil-fournisseur/profil-fournisseur.component';
import { ProduitListComponent } from './components/produit-list/produit-list.component';
import { NotificationsComponent } from './components/notifications/notifications.component';
import { AvisExpeditionComponent } from './components/avis-expedition/avis-expedition.component';
import { FactureListComponent } from './components/facture-list/facture-list.component';
import { FactureFormComponent } from './components/facture-form/facture-form.component';
import { PaiementListComponent } from './components/paiement-list/paiement-list.component';
import { PdfGeneratorComponent } from './components/pdf-generator/pdf-generator.component';

// Guards
import { AuthGuard } from '../../core/guards/auth.guard';
import { RoleGuard } from '../../core/guards/role.guard';

const routes: Routes = [
  {
    path: '',
    component: FournisseurLayoutComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['FOURNISSEUR'] },
    children: [
      {
        path: '',
        component: FournisseurDashboardComponent
      },
      {
        path: 'commandes',
        component: CommandeListComponent
      },
      {
        path: 'commandes/:id',
        component: CommandeDetailComponent
      },
      {
        path: 'commandes/:id/avis-expedition',
        component: AvisExpeditionComponent
      },
      {
        path: 'commandes/:id/documents',
        component: PdfGeneratorComponent
      },
      {
        path: 'factures',
        component: FactureListComponent
      },
      {
        path: 'factures/new/:commandeId',
        component: FactureFormComponent
      },
      {
        path: 'factures/edit/:id',
        component: FactureFormComponent
      },
      {
        path: 'paiements',
        component: PaiementListComponent
      },
      {
        path: 'commandes/:commandeId/factures/new',
        component: FactureFormComponent
      },
      {
        path: 'produits',
        component: ProduitListComponent
      },
      {
        path: 'profil',
        component: ProfilFournisseurComponent
      },
      {
        path: 'notifications',
        component: NotificationsComponent
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FournisseurRoutingModule { }
