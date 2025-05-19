import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AchatDashboardComponent } from './components/achat-dashboard/achat-dashboard.component';
import { AchatListComponent } from './components/achat-list/achat-list.component';
import { AchatDetailComponent } from './components/achat-detail/achat-detail.component';
import { FournisseurListComponent } from './components/fournisseur-list/fournisseur-list.component';
import { CommandeListComponent } from './components/commande-list/commande-list.component';
import { CommandeDetailComponent } from './components/commande-detail/commande-detail.component';
import { AuthGuard } from '../../core/guards/auth.guard';

const routes: Routes = [
  { 
    path: '', 
    component: AchatDashboardComponent,
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'commandes', pathMatch: 'full' },
      { path: 'commandes', component: CommandeListComponent },
      { path: 'commandes/new', component: CommandeDetailComponent },
      { path: 'commandes/edit/:id', component: CommandeDetailComponent },
      { path: 'commandes/:id', component: CommandeDetailComponent },
      { path: 'achats', component: AchatListComponent },
      { path: 'achats/:id', component: AchatDetailComponent },
      { path: 'fournisseurs', component: FournisseurListComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AchatRoutingModule { }
