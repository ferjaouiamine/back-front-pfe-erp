import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { RoleGuard } from './core/guards/role.guard';
import { AuthTestComponent } from './auth-test.component';

const routes: Routes = [
  { path: 'auth', loadChildren: () => import('./modules/auth/auth.module').then(m => m.AuthModule) },
  { 
    path: 'caisse', 
    loadChildren: () => import('./modules/caisse/caisse.module').then(m => m.CaisseModule),
    canActivate: [AuthGuard]
  },
  { 
    path: 'facturation', 
    loadChildren: () => import('./modules/facturation/facturation.module').then(m => m.FacturationModule),
    canActivate: [AuthGuard]
  },
  { 
    path: 'stock', 
    loadChildren: () => import('./modules/stock/stock.module').then(m => m.StockModule),
    canActivate: [AuthGuard]
  },
  { 
    path: 'auth-test',
    component: AuthTestComponent
  },
  { 
    path: 'admin', 
    loadChildren: () => import('./modules/admin/admin.module').then(m => m.AdminModule),
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN'] } // Restreindre l'accès uniquement au rôle ADMIN
  },
  { 
    path: 'achat', 
    loadChildren: () => import('./modules/achat/achat.module').then(m => m.AchatModule),
    canActivate: [AuthGuard]
  },
  { 
    path: 'access-denied', 
    loadChildren: () => import('./modules/shared/access-denied/access-denied.module').then(m => m.AccessDeniedModule) 
  },
  { path: '', redirectTo: 'auth', pathMatch: 'full' },
  { path: '**', redirectTo: 'auth' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
