import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-acheteur-dashboard',
  templateUrl: './acheteur-dashboard.component.html',
  styleUrls: ['./acheteur-dashboard.component.scss']
})
export class AcheteurDashboardComponent implements OnInit {
  username: string | null = null;
  facturesEnAttente = 0;
  paiementsRecents = 0;
  montantTotal = 0;
  pointsFidelite = 0;

  dashboardCards: any[] = [];

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.username = this.authService.getUsername();

    this.facturesEnAttente = 3;
    this.paiementsRecents = 2;
    this.montantTotal = 1250.75;
    this.pointsFidelite = 125;

    this.dashboardCards = [
      {
        icon: 'fas fa-file-invoice',
        title: 'Factures en attente',
        value: this.facturesEnAttente,
        link: '/acheteur/factures',
        buttonText: 'Voir mes factures',
        buttonClass: 'btn-primary'
      },
      {
        icon: 'fas fa-credit-card',
        title: 'Paiements récents',
        value: this.paiementsRecents,
        link: '/acheteur/paiements',
        buttonText: 'Voir mes paiements',
        buttonClass: 'btn-primary'
      },
      {
        icon: 'fas fa-euro-sign',
        title: 'Montant total dû',
        value: `${this.montantTotal} €`,
        link: '/acheteur/paiements/new',
        buttonText: 'Effectuer un paiement',
        buttonClass: 'btn-success'
      },
      {
        icon: 'fas fa-star',
        title: 'Points fidélité gagnés',
        value: this.pointsFidelite,
        link: '/acheteur/points',
        buttonText: 'Voir mes points',
        buttonClass: 'btn-warning'
      }
    ];
  }
}
