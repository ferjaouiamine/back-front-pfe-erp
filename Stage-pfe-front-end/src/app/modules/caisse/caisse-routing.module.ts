import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VendorDashboardComponent } from './components/vendor-dashboard/vendor-dashboard.component';
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
    data: { roles: ['VENDEUR', 'CLIENT'] } // Restreindre l'accès aux rôles VENDEUR et CLIENT
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CaisseRoutingModule { }
