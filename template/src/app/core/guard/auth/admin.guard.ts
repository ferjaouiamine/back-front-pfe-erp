import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../../service/auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    // Vérifie si l'utilisateur est connecté et a le rôle ADMIN
    if (this.authService.isLoggedIn() && this.authService.isAdmin()) {
      return true;
    }

    // Redirection vers la page de connexion si non autorisé
    this.router.navigate(['/auth/signin'], { queryParams: { returnUrl: state.url } });
    return false;
  }
}
