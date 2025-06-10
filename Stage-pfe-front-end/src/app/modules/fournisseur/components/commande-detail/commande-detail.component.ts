import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FournisseurService, CommandeFournisseur, LigneCommandeFournisseur, StatutCommande, StatutLigne } from '../../services/fournisseur.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-commande-detail',
  templateUrl: './commande-detail.component.html',
  styleUrls: ['./commande-detail.component.scss']
})
export class CommandeDetailComponent implements OnInit {
  // ID de la commande
  commandeId: string = '';
  
  // Données de la commande
  commande: CommandeFournisseur | null = null;
  
  // État de chargement
  isLoading: boolean = true;
  isSaving: boolean = false;
  error: string | null = null;
  
  // Colonnes du tableau des lignes
  displayedColumns: string[] = ['produit', 'quantite', 'prixUnitaire', 'montantTotal', 'statut', 'actions'];
  
  // Enum pour les statuts
  StatutCommande = StatutCommande;
  StatutLigne = StatutLigne;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fournisseurService: FournisseurService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    // Récupérer l'ID de la commande depuis l'URL
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.commandeId = id;
        this.chargerCommande();
      } else {
        this.error = 'ID de commande non trouvé';
        this.isLoading = false;
      }
    });
  }

  /**
   * Charge les détails de la commande
   */
  chargerCommande(): void {
    this.isLoading = true;
    this.error = null;
    
    this.fournisseurService.getCommandeById(this.commandeId)
      .subscribe({
        next: (commande) => {
          this.commande = commande;
          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Erreur lors du chargement de la commande';
          this.isLoading = false;
          console.error('Erreur détail commande:', err);
        }
      });
  }

  /**
   * Met à jour le statut de la commande
   */
  updateStatutCommande(statut: StatutCommande): void {
    if (!this.commande) return;
    
    this.isSaving = true;
    
    this.fournisseurService.updateCommandeStatut(this.commandeId, statut)
      .subscribe({
        next: (commande) => {
          this.commande = commande;
          this.isSaving = false;
          this.snackBar.open(`Statut de la commande mis à jour: ${statut}`, 'Fermer', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
          });
        },
        error: (err) => {
          this.isSaving = false;
          this.snackBar.open('Erreur lors de la mise à jour du statut', 'Fermer', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['error-snackbar']
          });
          console.error('Erreur mise à jour statut:', err);
        }
      });
  }

  /**
   * Met à jour le statut d'une ligne de commande
   */
  updateStatutLigne(ligne: LigneCommandeFournisseur, statut: StatutLigne): void {
    if (!this.commande) return;
    
    this.isSaving = true;
    
    this.fournisseurService.updateLigneStatut(this.commandeId, ligne.id, statut)
      .subscribe({
        next: (ligneUpdated) => {
          // Mettre à jour la ligne dans le tableau
          if (this.commande && this.commande.lignes) {
            const index = this.commande.lignes.findIndex(l => l.id === ligne.id);
            if (index !== -1) {
              this.commande.lignes[index] = { ...this.commande.lignes[index], ...ligneUpdated };
            }
          }
          
          this.isSaving = false;
          this.snackBar.open(`Statut de la ligne mis à jour: ${statut}`, 'Fermer', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom'
          });
        },
        error: (err) => {
          this.isSaving = false;
          this.snackBar.open('Erreur lors de la mise à jour du statut de la ligne', 'Fermer', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
            panelClass: ['error-snackbar']
          });
          console.error('Erreur mise à jour statut ligne:', err);
        }
      });
  }

  /**
   * Vérifie si la commande peut être mise en cours
   */
  peutMettreEnCours(): boolean {
    return this.commande?.statut === StatutCommande.CONFIRMEE;
  }

  /**
   * Vérifie si la commande peut être livrée
   */
  peutLivrer(): boolean {
    return this.commande?.statut === StatutCommande.EN_COURS;
  }

  /**
   * Vérifie si une ligne peut être marquée comme disponible
   */
  peutMarquerDisponible(ligne: LigneCommandeFournisseur): boolean {
    return ligne.statut === StatutLigne.EN_ATTENTE;
  }

  /**
   * Vérifie si une ligne peut être marquée comme indisponible
   */
  peutMarquerIndisponible(ligne: LigneCommandeFournisseur): boolean {
    return ligne.statut === StatutLigne.EN_ATTENTE;
  }

  /**
   * Vérifie si un avis d'expédition peut être créé pour cette commande
   * Un avis d'expédition peut être créé si la commande est en cours ou livrée
   */
  peutCreerAvisExpedition(): boolean {
    return this.commande?.statut === StatutCommande.EN_COURS || 
           this.commande?.statut === StatutCommande.LIVREE;
  }

  /**
   * Retourne au tableau des commandes
   */
  retourListe(): void {
    this.router.navigate(['/fournisseur/commandes']);
  }

  /**
   * Retourne la classe CSS correspondant au statut de la commande
   */
  getStatutCommandeClass(statut: StatutCommande): string {
    switch (statut) {
      case StatutCommande.BROUILLON:
        return 'statut-brouillon';
      case StatutCommande.EN_ATTENTE:
        return 'statut-en-attente';
      case StatutCommande.CONFIRMEE:
        return 'statut-confirmee';
      case StatutCommande.EN_COURS:
        return 'statut-en-cours';
      case StatutCommande.LIVREE:
        return 'statut-livree';
      case StatutCommande.ANNULEE:
        return 'statut-annulee';
      default:
        return '';
    }
  }

  /**
   * Retourne la classe CSS correspondant au statut d'une ligne
   */
  getStatutLigneClass(statut: StatutLigne): string {
    switch (statut) {
      case StatutLigne.EN_ATTENTE:
        return 'statut-en-attente';
      case StatutLigne.DISPONIBLE:
        return 'statut-disponible';
      case StatutLigne.INDISPONIBLE:
        return 'statut-indisponible';
      case StatutLigne.LIVREE:
        return 'statut-livree';
      default:
        return '';
    }
  }
}
