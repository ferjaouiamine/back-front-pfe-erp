import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import * as AOS from 'aos';

// Custom Validator for password match
function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');

  if (password && confirmPassword && password.value !== confirmPassword.value) {
    return { passwordMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  errorMessage: string | null = null;
  isLoading: boolean = false;
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  passwordStrength: number = 0;
  registerForm: FormGroup;
  
  // Liste des rôles disponibles pour l'inscription
  availableRoles: {id: string, name: string}[] = [
    { id: 'ADMIN', name: 'Administrateur' },
    { id: 'VENDEUR', name: 'Vendeur' },
    { id: 'CLIENT', name: 'Client' }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      address: ['', Validators.required], // Ajout du champ adresse
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      role: ['VENDEUR', Validators.required], // Ajout du champ rôle avec VENDEUR par défaut
      acceptTerms: [false, Validators.requiredTrue]
    }, { validators: passwordMatchValidator }); // Add custom validator to the group
  }

  ngOnInit(): void {
    AOS.init();
    
    // Observer les changements de mot de passe pour calculer la force
    this.registerForm.get('password')?.valueChanges.subscribe(password => {
      if (password) {
        this.calculatePasswordStrength(password);
      } else {
        this.passwordStrength = 0;
      }
    });
  }
  
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }
  
  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }
  
  calculatePasswordStrength(password: string): void {
    // Initialiser le score
    let score = 0;
    
    // Longueur minimale
    if (password.length >= 8) score += 20;
    else if (password.length >= 6) score += 10;
    
    // Lettres majuscules et minuscules
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) score += 20;
    else if (password.match(/[a-z]/) || password.match(/[A-Z]/)) score += 10;
    
    // Chiffres
    if (password.match(/[0-9]/)) score += 20;
    
    // Caractères spéciaux
    if (password.match(/[^a-zA-Z0-9]/)) score += 20;
    
    // Variété de caractères
    const uniqueChars = new Set(password.split('')).size;
    score += Math.min(20, uniqueChars * 2);
    
    // Limiter le score à 100
    this.passwordStrength = Math.min(100, score);
  }
  
  getPasswordStrengthClass(): string {
    if (this.passwordStrength < 40) return 'strength-weak';
    if (this.passwordStrength < 70) return 'strength-medium';
    return 'strength-strong';
  }
  
  getPasswordStrengthText(): string {
    if (this.passwordStrength < 40) return 'Faible';
    if (this.passwordStrength < 70) return 'Moyen';
    return 'Fort';
  }

  onRegister(): void {
    if (this.registerForm.invalid) {
      // Marquer tous les champs comme touchés pour afficher les erreurs
      Object.keys(this.registerForm.controls).forEach(key => {
        const control = this.registerForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    // Exclude confirmPassword from the data sent to the backend
    const { confirmPassword, ...registrationData } = this.registerForm.value;
    
    console.log('Données d\'inscription:', registrationData);
    
    // Convertir le rôle unique en tableau de rôles pour correspondre au format attendu par le backend
    const selectedRole = registrationData.role;
    console.log('Rôle sélectionné:', selectedRole);
    
    // Créer l'objet de requête avec le tableau de rôles
    const registerRequest = {
      username: registrationData.username,
      email: registrationData.email,
      password: registrationData.password,
      address: registrationData.address,
      roles: [selectedRole] // Envoyer un tableau avec le rôle sélectionné
    };
    
    console.log('Requête d\'inscription avec rôles:', registerRequest);
    
    this.authService.register(registerRequest).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        console.log('Réponse d\'inscription:', response);
        
        // Rediriger en fonction du rôle
        setTimeout(() => {
          const role = this.registerForm.value.role;
          if (role === 'ADMIN') {
            this.router.navigate(['/admin/dashboard']);
          } else if (role === 'VENDEUR') {
            this.router.navigate(['/facturation/dashboard']);
          } else {
            this.router.navigate(['/facturation']);
          }
        }, 1000); // Court délai pour s'assurer que le token est bien chargé
      },
      error: (error: any) => {
        this.isLoading = false;
        
        console.error('Erreur d\'inscription détaillée:', {
          status: error.status,
          statusText: error.statusText,
          error: error.error,
          message: error.message,
          url: error.url
        });
        
        // L'erreur est déjà formatée par le service d'authentification
        this.errorMessage = error.message;
      }
    });
  }
}
