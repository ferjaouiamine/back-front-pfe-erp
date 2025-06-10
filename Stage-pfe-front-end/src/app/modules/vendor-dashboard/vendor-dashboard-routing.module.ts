import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VendorDashboardHomeComponent } from './components/vendor-dashboard-home/vendor-dashboard-home.component';
import { AuthGuard } from '../../core/guards/auth.guard';
import { RoleGuard } from '../../core/guards/role.guard';

const routes: Routes = [
  {
    path: '',
    component: VendorDashboardHomeComponent,
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['VENDEUR'] }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class VendorDashboardRoutingModule { }
