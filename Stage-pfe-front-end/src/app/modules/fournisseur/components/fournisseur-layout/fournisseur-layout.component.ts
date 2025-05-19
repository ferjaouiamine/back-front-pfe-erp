import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-fournisseur-layout',
  templateUrl: './fournisseur-layout.component.html',
  styleUrls: ['./fournisseur-layout.component.scss']
})
export class FournisseurLayoutComponent implements OnInit {
  username: string = '';
  isMenuOpen: boolean = false;
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    // Récupérer les informations de l'utilisateur connecté
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.username = currentUser.username;
    }
  }

  /**
   * Ouvre/ferme le menu latéral sur mobile
   */
  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  /**
   * Déconnecte l'utilisateur
   */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
