import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-acheteur-dashboard',
  templateUrl: './acheteur-dashboard.component.html',
  styleUrls: ['./acheteur-dashboard.component.scss']
})
export class AcheteurDashboardComponent implements OnInit {
  username: string | null = null;
  facturesEnAttente: number = 0;
  paiementsRecents: number = 0;
  montantTotal: number = 0;

  constructor(private authService: AuthService) { }

  ngOnInit(): void {
    this.username = this.authService.getUsername();
    
    // Ces données seraient normalement récupérées depuis un service
    // Pour l'instant, nous utilisons des valeurs fictives
    this.facturesEnAttente = 3;
    this.paiementsRecents = 2;
    this.montantTotal = 1250.75;
  }
}
