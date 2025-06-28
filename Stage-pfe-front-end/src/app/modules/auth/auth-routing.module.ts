import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthHomeComponent } from './components/auth-home/auth-home.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { AuthDebugComponent } from './components/auth-debug/auth-debug.component';
import { InactiveAccountComponent } from './components/inactive-account/inactive-account.component';

const routes: Routes = [
  {
    path: '',
    component: AuthHomeComponent,
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      { path: 'login', component: LoginComponent },
      { path: 'register', component: RegisterComponent },
      { path: 'debug', component: AuthDebugComponent },
      { path: 'inactive-account', component: InactiveAccountComponent }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AuthRoutingModule { }
