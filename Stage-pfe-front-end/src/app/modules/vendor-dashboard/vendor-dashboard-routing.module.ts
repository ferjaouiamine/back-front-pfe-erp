import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VendorDashboardHomeComponent } from './components/vendor-dashboard-home/vendor-dashboard-home.component';
import { VendorProfileComponent } from './components/vendor-profile/vendor-profile.component';
import { AuthGuard } from '../../core/guards/auth.guard';
import { RoleGuard } from '../../core/guards/role.guard';

const routes: Routes = [
  {
    path: '',
    component: VendorDashboardHomeComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['VENDEUR'], breadcrumb: 'Tableau de bord' }
  },
  {
    path: 'profil',
    component: VendorProfileComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['VENDEUR'], breadcrumb: 'Mon profil' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class VendorDashboardRoutingModule { }
