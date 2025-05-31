import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../modules/auth/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleRedirectService {

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  /**
   * Redirige l'utilisateur vers la page appropriée en fonction de son rôle
   */
  redirectBasedOnRole(): void {
    const roles = this.authService.getUserRoles(true);
    
    if (roles.includes('ADMIN')) {
      this.router.navigate(['/admin/dashboard']);
    } else if (roles.includes('VENDEUR')) {
      this.router.navigate(['/caisse/pos']);
    } else if (roles.includes('FOURNISSEUR')) {
      this.router.navigate(['/fournisseur/dashboard']);
    } else {
      // Redirection par défaut pour les autres rôles (CLIENT, etc.)
      this.router.navigate(['/landing']);
    }
  }
}
