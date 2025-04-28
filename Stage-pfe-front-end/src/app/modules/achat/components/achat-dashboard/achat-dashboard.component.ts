import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-achat-dashboard',
  templateUrl: './achat-dashboard.component.html',
  styleUrls: ['./achat-dashboard.component.scss']
})
export class AchatDashboardComponent {

  constructor(private router: Router) {}

  createNewOrder() {
    // Rediriger vers la page de création d'une nouvelle commande
    // Pour l'instant, nous redirigeons simplement vers la liste des commandes
    this.router.navigate(['/achat/commandes']);
  }
}
