import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../auth/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-acheteur-profile',
  templateUrl: './acheteur-profile.component.html',
  styleUrls: ['./acheteur-profile.component.scss']
})
export class AcheteurProfileComponent implements OnInit {
  username: string | null = null;
  email: string | null = null;
  role: string | null = null;

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.username = this.authService.getUsername();
    this.email = this.authService.getEmail();
    this.role = this.authService.hasRole('ACHETEUR') ? 'Acheteur' : '';
  }
  
  logout(): void {
    this.authService.logout();
    // La redirection vers la page de connexion est déjà gérée dans le service d'authentification
  }
}
