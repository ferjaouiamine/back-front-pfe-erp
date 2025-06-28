import { Component, OnInit } from '@angular/core';
import * as AOS from 'aos';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-inactive-account',
  templateUrl: './inactive-account.component.html',
  styleUrls: ['./inactive-account.component.scss']
})
export class InactiveAccountComponent implements OnInit {
  username: string | null = null;
  email: string | null = null;
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Initialiser l'animation AOS
    AOS.init();
    
    // Vérifier si l'utilisateur est connecté
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/auth/login']);
      return;
    }
    
    // Récupérer les informations de l'utilisateur
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.username = currentUser.username;
      this.email = currentUser.email;
      
      // Si l'utilisateur est actif, le rediriger vers la page d'accueil appropriée
      if (currentUser.active === true) {
        this.router.navigate([this.authService.getDefaultRedirectUrl()]);
      }
    }
  }
}
