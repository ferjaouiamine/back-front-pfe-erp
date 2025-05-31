import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VendorFacturesComponent } from './components/vendor-factures/vendor-factures.component';
import { VendorFactureDetailComponent } from './components/vendor-facture-detail/vendor-facture-detail.component';
import { VendorDashboardComponent } from './components/vendor-dashboard/vendor-dashboard.component';
import { FactureCreateComponent } from './components/facture-create/facture-create.component';
import { ProfileComponent } from './components/profile/profile.component';
import { RoleGuard } from '../../core/guards/role.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    component: VendorDashboardComponent,
    canActivate: [RoleGuard],
    data: { roles: ['VENDEUR'] } // Restreindre l'accès uniquement au rôle VENDEUR
  },
  {
    path: 'list',
    component: VendorFacturesComponent,
    canActivate: [RoleGuard],
    data: { roles: ['VENDEUR'] } // Restreindre l'accès uniquement au rôle VENDEUR
  },
  {
    path: 'create',
    component: FactureCreateComponent,
    canActivate: [RoleGuard],
    data: { roles: ['VENDEUR', 'ADMIN'] } // Permettre l'accès aux vendeurs et aux administrateurs
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [RoleGuard],
    data: { roles: ['VENDEUR'] } // Restreindre l'accès uniquement au rôle VENDEUR
  },
  {
    path: ':id',
    component: VendorFactureDetailComponent,
    canActivate: [RoleGuard],
    data: { roles: ['VENDEUR', 'ADMIN'] } // Permettre l'accès aux vendeurs et aux administrateurs
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FacturationRoutingModule { }
