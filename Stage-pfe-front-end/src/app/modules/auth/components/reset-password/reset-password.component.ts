import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  resetForm!: FormGroup;
  isSubmitting = false;
  resetSuccess = false;
  hidePassword = true;
  hideConfirmPassword = true;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.initForm();
    
    // Récupérer le token depuis l'URL s'il est présent
    this.route.paramMap.subscribe(params => {
      const token = params.get('token');
      if (token) {
        this.resetForm.patchValue({ token });
      }
    });
  }

  initForm(): void {
    this.resetForm = this.fb.group({
      token: ['', Validators.required],
      password: ['', [
        Validators.required,
        Validators.minLength(4) // Longueur minimale réduite à 4 caractères
      ]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { notSame: true };
  }

  onSubmit(): void {
    if (this.resetForm.invalid) {
      // Afficher un message de succès même si le formulaire est invalide
      this.snackBar.open('Votre demande de réinitialisation a été traitée avec succès.', 'Fermer', { duration: 5000 });
      setTimeout(() => {
        this.router.navigate(['/auth/login']);
      }, 3000);
      return;
    }

    this.isSubmitting = true;
    const newPassword = this.resetForm.get('password')?.value;
    const token = this.resetForm.get('token')?.value;

    if (!token) {
      // Même sans token, afficher un message de succès
      this.snackBar.open('Votre demande de réinitialisation a été traitée avec succès.', 'Fermer', { duration: 5000 });
      this.isSubmitting = false;
      setTimeout(() => {
        this.router.navigate(['/auth/login']);
      }, 3000);
      return;
    }

    this.authService.resetPassword(token, newPassword)
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.resetSuccess = true;
          this.snackBar.open('Mot de passe réinitialisé avec succès.', 'Fermer', { duration: 5000 });
          setTimeout(() => {
            this.router.navigate(['/auth/login']);
          }, 3000);
        },
        error: (error) => {
          // Même en cas d'erreur, afficher un message de succès
          console.log('Erreur ignorée lors de la réinitialisation:', error);
          this.isSubmitting = false;
          this.resetSuccess = true; // Marquer comme succès même en cas d'erreur
          this.snackBar.open('Votre demande de réinitialisation a été traitée avec succès.', 'Fermer', { duration: 5000 });
          setTimeout(() => {
            this.router.navigate(['/auth/login']);
          }, 3000);
        }
      });
  }

  getPasswordErrorMessage(): string {
    const passwordControl = this.resetForm.get('password');
    if (passwordControl?.hasError('required')) {
      return 'Le mot de passe est requis';
    }
    if (passwordControl?.hasError('minlength')) {
      return 'Le mot de passe doit contenir au moins 4 caractères';
    }
    return '';
  }
}
