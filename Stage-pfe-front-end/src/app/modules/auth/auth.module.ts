import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthHomeComponent } from './components/auth-home/auth-home.component';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { AuthDebugComponent } from './components/auth-debug/auth-debug.component';
import { AuthRoutingModule } from './auth-routing.module';
import { HttpClientModule } from '@angular/common/http'; 
import { FormsModule, ReactiveFormsModule } from '@angular/forms'; 

@NgModule({
  declarations: [
    AuthHomeComponent, 
    LoginComponent, 
    RegisterComponent,
    AuthDebugComponent
  ],
  imports: [
    CommonModule,
    AuthRoutingModule,
    HttpClientModule, 
    FormsModule, 
    ReactiveFormsModule 
  ]
})
export class AuthModule { }
