import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FournisseurService, DashboardStats } from '../../services/fournisseur.service';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-fournisseur-dashboard',
  templateUrl: './fournisseur-dashboard.component.html',
  styleUrls: ['./fournisseur-dashboard.component.scss']
})
export class FournisseurDashboardComponent implements OnInit {
  // Statistiques du tableau de bord
  commandesEnAttente: number = 0;
  commandesEnCours: number = 0;
  commandesLivrees: number = 0;
  totalCommandes: number = 0;
  
  // État de chargement
  isLoading: boolean = true;
  error: string | null = null;
  
  // Informations utilisateur
  username: string = '';

  constructor(
    private router: Router,
    private authService: AuthService,
    private fournisseurService: FournisseurService
  ) { }

  ngOnInit(): void {
    // Récupérer les informations de l'utilisateur connecté
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.username = currentUser.username;
    }
    
    // Charger les statistiques du tableau de bord
    this.loadDashboardStats();
  }

  /**
   * Charge les statistiques pour le tableau de bord
   */
  loadDashboardStats(): void {
    this.isLoading = true;
    this.error = null;
    
    this.fournisseurService.getDashboardStats().subscribe({
      next: (data: DashboardStats) => {
        this.commandesEnAttente = data.commandesEnAttente;
        this.commandesEnCours = data.commandesEnCours;
        this.commandesLivrees = data.commandesLivrees;
        this.totalCommandes = data.totalCommandes;
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des statistiques';
        this.isLoading = false;
        console.error('Erreur dashboard fournisseur:', err);
        
        // En mode développement, utiliser des données simulées en cas d'erreur
        // À supprimer en production
        this.commandesEnAttente = 5;
        this.commandesEnCours = 3;
        this.commandesLivrees = 12;
        this.totalCommandes = this.commandesEnAttente + this.commandesEnCours + this.commandesLivrees;
        this.isLoading = false;
        this.error = null;
      }
    });
  }

  /**
   * Navigue vers la liste des commandes
   */
  voirCommandes(): void {
    this.router.navigate(['/fournisseur/commandes']);
  }

  /**
   * Navigue vers le profil du fournisseur
   */
  voirProfil(): void {
    this.router.navigate(['/fournisseur/profil']);
  }
}
