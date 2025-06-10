import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FournisseurService, DashboardStats } from '../../services/fournisseur.service';
import { AuthService } from '../../../auth/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

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
  
  // Date du jour
  today: Date = new Date();

  constructor(
    private router: Router,
    private authService: AuthService,
    private fournisseurService: FournisseurService,
    private snackBar: MatSnackBar
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
        console.error('Erreur dashboard fournisseur:', err);
        
        // Afficher un message d'erreur plus précis
        if (err.status === 401 || err.status === 403) {
          this.error = 'Accès non autorisé. Veuillez vous reconnecter.';
          this.snackBar.open('Session expirée. Veuillez vous reconnecter.', 'OK', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        } else if (err.status === 0 || err.status === 504) {
          this.error = 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.';
        } else {
          this.error = 'Erreur lors du chargement des statistiques. Veuillez réessayer.';
        }
        
        // Utiliser des données simulées en cas d'erreur pour éviter un tableau de bord vide
        this.commandesEnAttente = 0;
        this.commandesEnCours = 0;
        this.commandesLivrees = 0;
        this.totalCommandes = 0;
        this.isLoading = false;
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
   * Navigue vers le module de commandes
   */
  navigateToCommandes(): void {
    this.router.navigate(['/fournisseur/commandes']);
  }

  /**
   * Navigue vers le module de factures
   */
  navigateToFactures(): void {
    this.router.navigate(['/fournisseur/factures']);
  }

  /**
   * Navigue vers le module de produits
   */
  navigateToProduits(): void {
    this.router.navigate(['/fournisseur/produits']);
  }

  /**
   * Navigue vers le module d'expéditions
   */
  navigateToExpeditions(): void {
    // Vérifier s'il y a des commandes en cours
    if (this.commandesEnCours > 0) {
      this.router.navigate(['/fournisseur/commandes']);
    } else {
      this.snackBar.open('Aucune commande en cours à expédier', 'Fermer', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'bottom'
      });
    }
  }

  /**
   * Navigue vers les notifications
   */
  navigateToNotifications(): void {
    this.router.navigate(['/fournisseur/notifications']);
  }

  /**
   * Navigue vers le profil du fournisseur
   */
  voirProfil(): void {
    this.router.navigate(['/fournisseur/profil']);
  }
}
