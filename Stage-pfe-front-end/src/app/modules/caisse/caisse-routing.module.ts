import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VendorDashboardComponent } from './components/vendor-dashboard/vendor-dashboard.component';
import { PosComponent } from './components/pos/pos.component';
import { RoleGuard } from '../../core/guards/role.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'pos',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    redirectTo: 'pos',
    pathMatch: 'full'
  },
  {
    path: 'pos',
    component: PosComponent,
    canActivate: [RoleGuard],
    data: { roles: ['VENDEUR', 'ADMIN'] } // Restreindre l'accès aux rôles VENDEUR et ADMIN
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CaisseRoutingModule { }
