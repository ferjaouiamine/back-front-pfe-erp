import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared.module';
import { AuthHomeComponent } from './components/auth-home/auth-home.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { AuthDebugComponent } from './components/auth-debug/auth-debug.component';
import { AuthRoutingModule } from './auth-routing.module';

@NgModule({
  declarations: [
    AuthHomeComponent, 
    LoginComponent, 
    RegisterComponent,
    AuthDebugComponent
  ],
  imports: [
    SharedModule,
    AuthRoutingModule
  ]
})
export class AuthModule { }
