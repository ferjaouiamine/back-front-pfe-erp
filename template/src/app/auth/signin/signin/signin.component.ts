import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { routes } from 'src/app/core/helpers/routes';
import { AuthService, LoginRequest } from 'src/app/core/service/auth/auth.service';

@Component({
  selector: 'app-signin',
  templateUrl: './signin.component.html',
  styleUrl: './signin.component.scss'
})
export class SigninComponent {
  public routes = routes;
  public password: boolean[] = [false];
  public loginForm: FormGroup;
  public loading = false;
  public error = '';
  public rememberMe = false;
  
  constructor(
    private router: Router,
    private formBuilder: FormBuilder,
    private authService: AuthService
  ) {
    // Création du formulaire de connexion
    this.loginForm = this.formBuilder.group({
      usernameOrEmail: ['', [Validators.required]],
      password: ['', Validators.required]
    });
    
    // Vérifier si l'utilisateur est déjà connecté
    if (this.authService.isLoggedIn()) {
      this.router.navigate([routes.adminDashboard]);
    }
  }

  // Getter pour accéder facilement aux contrôles du formulaire
  get f() { return this.loginForm.controls; }

  navigation() {
    if (this.loginForm.invalid) {
      this.markFormGroupTouched(this.loginForm);
      return;
    }
    
    this.loading = true;
    this.error = '';
    
    const loginRequest: LoginRequest = {
      usernameOrEmail: this.f['usernameOrEmail'].value,
      password: this.f['password'].value
    };
    
    this.authService.login(loginRequest).subscribe(
      () => {
        // Si l'utilisateur est un administrateur, rediriger vers le tableau de bord admin
        if (this.authService.isAdmin()) {
          this.router.navigate([routes.adminDashboard]);
        } else {
          // Sinon, rediriger vers une autre page par défaut
          this.router.navigate([routes.salesDashboard]);
        }
      },
      error => {
        this.error = 'Identifiants incorrects. Veuillez réessayer.';
        this.loading = false;
        console.error('Erreur de connexion', error);
      }
    );
  }

  public togglePassword(index: number) {
    this.password[index] = !this.password[index];
  }
  
  private markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
}
