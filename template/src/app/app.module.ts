import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { LoaderComponent } from './common-component/loader/loader.component';
import { sharedModule } from './shared/shared.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

// Services d'authentification
import { AuthService } from './core/service/auth/auth.service';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { AdminGuard } from './core/guard/auth/admin.guard';



@NgModule({
  declarations: [AppComponent, LoaderComponent],
  imports: [
    BrowserModule, 
    AppRoutingModule, 
    HttpClientModule, // Ajout du HttpClientModule pour les appels API
    sharedModule, 
    BrowserAnimationsModule
  ],
  providers: [
    AuthService, // Service d'authentification
    AdminGuard, // Guard pour la protection des routes admin
    { // Intercepteur HTTP pour ajouter le token JWT aux requêtes
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ],
  exports: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
