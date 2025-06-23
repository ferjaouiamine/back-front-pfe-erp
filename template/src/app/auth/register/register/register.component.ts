import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { routes } from 'src/app/core/helpers/routes';
import { AuthService, SignupRequest } from 'src/app/core/service/auth/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  public routes = routes;
  public password: boolean[] = [false, false];
  public registerForm: FormGroup;
  public loading = false;
  public error = '';
  public success = '';
  public isAdmin = false;
  public adminSecret = ''; // Code secret pour créer un compte admin
  public showAdminFields = false;
  
  constructor(
    private router: Router,
    private formBuilder: FormBuilder,
    private authService: AuthService
  ) {
    // Création du formulaire d'inscription
    this.registerForm = this.formBuilder.group({
      username: ['', [Validators.required, Validators.minLength(4)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      adminKey: [''] // Clé spéciale pour créer un compte administrateur
    }, {
      validator: this.passwordMatchValidator
    });
  }

  // Getter pour accéder facilement aux contrôles du formulaire
  get f() { return this.registerForm.controls; }

  // Validateur personnalisé pour vérifier que les mots de passe correspondent
  passwordMatchValidator(formGroup: FormGroup) {
    const password = formGroup.get('password')?.value;
    const confirmPassword = formGroup.get('confirmPassword')?.value;
    
    if (password !== confirmPassword) {
      formGroup.get('confirmPassword')?.setErrors({ passwordMismatch: true });
    } else {
      formGroup.get('confirmPassword')?.setErrors(null);
    }
  }

  public toggleAdminFields() {
    this.showAdminFields = !this.showAdminFields;
  }

  public togglePassword(index: number) {
    this.password[index] = !this.password[index];
  }
  
  navigation() {
    if (this.registerForm.invalid) {
      this.markFormGroupTouched(this.registerForm);
      return;
    }
    
    this.loading = true;
    this.error = '';
    this.success = '';
    
    const signupRequest: SignupRequest = {
      username: this.f['username'].value,
      email: this.f['email'].value,
      password: this.f['password'].value,
      roles: []
    };
    
    // Si le champ adminKey est rempli et correspond au code secret, ajouter le rôle ADMIN
    const adminKey = this.f['adminKey'].value;
    if (adminKey && adminKey === 'ADMIN_SECRET_KEY_2024') { // Remplacer par une vraie clé secrète
      signupRequest.roles = ['ADMIN'];
    } else {
      signupRequest.roles = ['USER'];
    }
    
    this.authService.register(signupRequest).subscribe(
      () => {
        this.success = 'Inscription réussie! Vous pouvez maintenant vous connecter.';
        this.loading = false;
        
        // Rediriger vers la page de connexion après un délai
        setTimeout(() => {
          this.router.navigate([routes.signIn]);
        }, 2000);
      },
      error => {
        this.error = error?.error || 'Une erreur est survenue lors de l\'inscription. Veuillez réessayer.';
        this.loading = false;
      }
    );
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
