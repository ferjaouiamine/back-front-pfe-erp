import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

const routes: Routes = [
  { 
    path: 'auth',
    loadChildren: () => import('./modules/auth/auth.module').then(m => m.AuthModule)
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
    path: 'caisse',
    loadChildren: () => import('./modules/caisse/caisse.module').then(m => m.CaisseModule),
    canActivate: [AuthGuard]
  },
  { 
    path: 'achat',
    loadChildren: () => import('./modules/achat/achat.module').then(m => m.AchatModule),
    canActivate: [AuthGuard]
  },
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/auth/login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { } 