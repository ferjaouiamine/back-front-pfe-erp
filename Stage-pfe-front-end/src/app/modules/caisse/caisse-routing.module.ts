import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VendorDashboardComponent } from './components/vendor-dashboard/vendor-dashboard.component';
import { PosComponent } from './components/pos/pos.component';
import { PosNewComponent } from './components/pos/pos-new.component';
import { RoleGuard } from '../../core/guards/role.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'pos-new',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    redirectTo: 'pos',
    pathMatch: 'full'
  },
  {
    path: 'pos',
    redirectTo: 'pos-new',
    pathMatch: 'full'
  },
  {
    path: 'pos-new',
    component: PosNewComponent,
    canActivate: [RoleGuard],
    data: { roles: ['VENDEUR', 'ADMIN'] } // Restreindre l'accès aux rôles VENDEUR et ADMIN
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CaisseRoutingModule { }
