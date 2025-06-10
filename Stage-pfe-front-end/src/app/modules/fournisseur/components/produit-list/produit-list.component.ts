import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatPaginator, PageEvent } from '@angular/material/paginator';

import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FournisseurService, ProduitFournisseur } from '../../services/fournisseur.service';
import { finalize, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-produit-list',
  templateUrl: './produit-list.component.html',
  styleUrls: ['./produit-list.component.scss']
})
export class ProduitListComponent implements OnInit, AfterViewInit {
  // Colonnes à afficher dans le tableau
  displayedColumns: string[] = ['reference', 'nom', 'prix', 'categorie', 'stock', 'disponible', 'actions'];

  // Source de données pour le tableau
  dataSource = new MatTableDataSource<ProduitFournisseur>([]);

  // Pagination
  pageSize = 10;
  pageSizeOptions: number[] = [5, 10, 25, 50];
  pageIndex = 0;
  totalItems = 0;

  // Filtres
  filtreTexte = '';
  filtreCategorie = '';
  filtreDisponibilite = '';

  // Liste des catégories disponibles
  categories: string[] = [];

  // État de chargement
  isLoading = false;

  // Message d'erreur
  error: string | null = null;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private fournisseurService: FournisseurService,
    private router: Router,
    private dialog: MatDialog,
    private fb: FormBuilder,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.chargerCategories();
    this.chargerProduits();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;

    if (this.sort) {
      this.sort.sortChange.subscribe(() => {
        // Réinitialiser la pagination lorsque le tri change
        if (this.paginator) {
          this.paginator.pageIndex = 0;
        }
        this.chargerProduits();
      });
    }

    if (this.paginator) {
      this.paginator.page.subscribe((event: PageEvent) => {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.chargerProduits();
      });
    }
  }

  /**
   * Charge les produits depuis le backend avec gestion avancée des erreurs
   */
  chargerProduits(): void {
    this.isLoading = true;
    this.error = null;

    // Préparer les filtres
    const filters: any = {};

    if (this.filtreCategorie) {
      filters.categorie = this.filtreCategorie;
    }

    if (this.filtreDisponibilite === 'disponible') {
      filters.disponible = true;
    } else if (this.filtreDisponibilite === 'indisponible') {
      filters.disponible = false;
    }

    if (this.filtreTexte) {
      filters.searchText = this.filtreTexte;
    }

    // Ajouter les options de tri
    if (this.sort && this.sort.active) {
      filters.sortBy = this.sort.active;
      filters.sortDir = this.sort.direction;
    }

    this.fournisseurService.getProduits(this.pageIndex, this.pageSize, filters)
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          if (response && response.content) {
            this.dataSource.data = response.content;
            this.totalItems = response.totalElements || 0;
          } else {
            // Si la réponse n'a pas la structure attendue
            console.error('Format de réponse inattendu:', response);
            this.dataSource.data = [];
            this.totalItems = 0;
            this.snackBar.open('Format de réponse inattendu', 'Fermer', {
              duration: 5000,
              panelClass: ['warning-snackbar']
            });
          }
        },
        error: (err: any) => {
          this.isLoading = false;
          console.error('Erreur lors du chargement des produits:', err);
          
          // Gestion détaillée des erreurs
          if (err.status === 401 || err.status === 403) {
            this.error = 'Vous n\'avez pas les autorisations nécessaires pour accéder à ces produits.';
            this.snackBar.open('Accès non autorisé', 'Fermer', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
          } else if (err.status === 404) {
            this.error = 'Aucun produit trouvé.';
            this.snackBar.open('Aucun produit trouvé', 'Fermer', {
              duration: 5000,
              panelClass: ['warning-snackbar']
            });
          } else if (err.status === 0) {
            this.error = 'Impossible de se connecter au serveur. Veuillez vérifier votre connexion internet.';
            this.snackBar.open('Erreur de connexion au serveur', 'Fermer', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
          } else {
            this.error = 'Une erreur est survenue lors du chargement des produits. Veuillez réessayer plus tard.';
            this.snackBar.open('Erreur de chargement', 'Fermer', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
          }

          // Données de test en cas d'erreur (à supprimer en production)
          const donneesDeMock = [
            {
              id: '1',
              reference: 'REF001',
              nom: 'Ordinateur portable',
              description: 'Ordinateur portable haut de gamme',
              prix: 1200,
              categorie: 'Informatique',
              disponible: true,
              stock: 10,
              dateCreation: new Date(),
              dateModification: new Date()
            },
            {
              id: '2',
              reference: 'REF002',
              nom: 'Écran 27 pouces',
              description: 'Écran 4K 27 pouces',
              prix: 350,
              categorie: 'Informatique',
              disponible: true,
              stock: 15,
              dateCreation: new Date(),
              dateModification: new Date()
            },
            {
              id: '3',
              reference: 'REF003',
              nom: 'Clavier mécanique',
              description: 'Clavier mécanique RGB',
              prix: 120,
              categorie: 'Accessoires',
              disponible: false,
              stock: 0,
              dateCreation: new Date(),
              dateModification: new Date()
            }
          ];
          this.dataSource.data = donneesDeMock;
          this.totalItems = this.dataSource.data.length;
        }
      });
  }

  /**
   * Charge les catégories depuis le backend
   */
  chargerCategories(): void {
    this.fournisseurService.getCategories()
      .subscribe({
        next: (categories) => {
          this.categories = categories;
        },
        error: (err: any) => {
          console.error('Erreur lors du chargement des catégories:', err);
          // Utiliser des catégories par défaut en cas d'erreur
          this.categories = ['Informatique', 'Électronique', 'Accessoires', 'Mobilier', 'Fournitures'];
        }
      });
  }

  /**
   * Applique le filtre de texte
   */
  appliquerFiltreTexte(): void {
    this.pageIndex = 0;
    this.chargerProduits();
  }

  /**
   * Applique le filtre de catégorie
   */
  appliquerFiltreCategorie(): void {
    this.pageIndex = 0;
    this.chargerProduits();
  }

  /**
   * Applique le filtre de disponibilité
   */
  appliquerFiltreDisponibilite(): void {
    this.pageIndex = 0;
    this.chargerProduits();
  }

  /**
   * Réinitialise tous les filtres
   */
  reinitialiserFiltres(): void {
    this.filtreTexte = '';
    this.filtreCategorie = '';
    this.filtreDisponibilite = '';
    this.pageIndex = 0;
    this.chargerProduits();
  }

  /**
   * Change la disponibilité d'un produit avec notification et gestion d'erreur améliorée
   */
  toggleDisponibilite(produit: ProduitFournisseur): void {
    this.isLoading = true;
    this.error = null;
    
    // Sauvegarder l'état actuel pour pouvoir revenir en arrière en cas d'erreur
    const previousState = produit.disponible;
    const newState = !previousState;
    
    // Message pour l'utilisateur
    const statusMessage = newState ? 'disponible' : 'indisponible';

    this.fournisseurService.updateProduitDisponibilite(produit.id, newState)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (updatedProduit) => {
          // Mettre à jour le produit dans la liste
          const index = this.dataSource.data.findIndex(p => p.id === produit.id);
          if (index !== -1) {
            this.dataSource.data[index].disponible = updatedProduit.disponible;
            // Créer une nouvelle référence pour déclencher la mise à jour de la vue
            this.dataSource.data = [...this.dataSource.data];
            
            // Notification de succès
            this.snackBar.open(`Le produit "${produit.nom}" est maintenant ${statusMessage}`, 'Fermer', {
              duration: 3000,
              panelClass: ['success-snackbar']
            });
          }
        },
        error: (err: any) => {
          // Gestion détaillée des erreurs
          console.error(`Erreur lors de la mise à jour de la disponibilité du produit ${produit.id}:`, err);
          
          // Message d'erreur approprié
          if (err.status === 401 || err.status === 403) {
            this.error = 'Vous n\'avez pas les autorisations nécessaires pour modifier ce produit.';
          } else if (err.status === 404) {
            this.error = 'Produit introuvable. Il a peut-être été supprimé.';
          } else if (err.status === 0) {
            this.error = 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.';
          } else {
            this.error = 'Impossible de mettre à jour la disponibilité du produit. Veuillez réessayer plus tard.';
          }
          
          // Notification d'erreur
          this.snackBar.open(this.error, 'Fermer', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
          
          // Annuler le changement d'état du toggle
          produit.disponible = previousState;
        }
      });
  }

  /**
   * Ouvre la boîte de dialogue pour ajouter un nouveau produit avec notification et gestion d'erreur améliorée
   */
  ajouterProduit(): void {
    // TODO: Implémenter la boîte de dialogue pour ajouter un produit
    console.log('Ajouter un nouveau produit');
    this.error = null;

    // Exemple de structure pour un nouveau produit
    const nouveauProduit: Partial<ProduitFournisseur> = {
      reference: 'REF' + Math.floor(Math.random() * 10000).toString().padStart(4, '0'),
      nom: 'Nouveau produit',
      description: 'Description du nouveau produit',
      prix: 99.99,
      categorie: this.categories.length > 0 ? this.categories[0] : 'Informatique',
      disponible: true,
      stock: 10
    };

    this.isLoading = true;

    this.fournisseurService.createProduit(nouveauProduit)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (produitCree) => {
          // Notification de succès
          this.snackBar.open(`Le produit "${nouveauProduit.nom}" a été ajouté avec succès`, 'Fermer', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          
          // Recharger la liste des produits
          this.chargerProduits();
        },
        error: (err: any) => {
          console.error('Erreur lors de la création du produit:', err);
          
          // Gestion détaillée des erreurs
          if (err.status === 401 || err.status === 403) {
            this.error = 'Vous n\'avez pas les autorisations nécessaires pour ajouter un produit.';
          } else if (err.status === 400) {
            this.error = 'Données invalides. Veuillez vérifier les informations du produit.';
          } else if (err.status === 409) {
            this.error = 'Un produit avec cette référence existe déjà.';
          } else if (err.status === 0) {
            this.error = 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.';
          } else {
            this.error = 'Impossible de créer le produit. Veuillez réessayer plus tard.';
          }
          
          // Notification d'erreur
          this.snackBar.open(this.error, 'Fermer', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      });
  }

  /**
   * Ouvre la boîte de dialogue pour modifier un produit avec notification et gestion d'erreur améliorée
   */
  modifierProduit(produit: ProduitFournisseur): void {
    // TODO: Implémenter la boîte de dialogue pour modifier un produit
    console.log('Modifier le produit:', produit);
    this.error = null;

    // Stocker les informations du produit pour les messages
    const produitId = produit.id;
    const produitNomOriginal = produit.nom;
    
    // Exemple de mise à jour (sans boîte de dialogue)
    const produitModifie: Partial<ProduitFournisseur> = {
      ...produit,
      nom: produit.nom + ' (modifié)',
      prix: produit.prix * 1.1 // Augmenter le prix de 10%
    };

    this.isLoading = true;

    this.fournisseurService.updateProduit(produitId, produitModifie)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (produitMisAJour) => {
          // Notification de succès
          this.snackBar.open(`Le produit "${produitNomOriginal}" a été mis à jour avec succès`, 'Fermer', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          
          // Recharger la liste des produits
          this.chargerProduits();
        },
        error: (err: any) => {
          console.error(`Erreur lors de la mise à jour du produit ${produitId}:`, err);
          
          // Gestion détaillée des erreurs
          if (err.status === 401 || err.status === 403) {
            this.error = 'Vous n\'avez pas les autorisations nécessaires pour modifier ce produit.';
          } else if (err.status === 400) {
            this.error = 'Données invalides. Veuillez vérifier les informations du produit.';
          } else if (err.status === 404) {
            this.error = 'Produit introuvable. Il a peut-être été supprimé.';
          } else if (err.status === 409) {
            this.error = 'Un conflit est survenu lors de la mise à jour du produit.';
          } else if (err.status === 0) {
            this.error = 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.';
          } else {
            this.error = 'Impossible de mettre à jour le produit. Veuillez réessayer plus tard.';
          }
          
          // Notification d'erreur
          this.snackBar.open(this.error, 'Fermer', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
        }
      });
  }

  /**
   * Supprime un produit avec notification et gestion d'erreur améliorée
   */
  supprimerProduit(produit: ProduitFournisseur): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le produit "${produit.nom}" ?`)) {
      this.isLoading = true;
      this.error = null;
      
      // Stocker les informations du produit pour les messages
      const produitNom = produit.nom;
      const produitId = produit.id;

      this.fournisseurService.deleteProduit(produitId)
        .pipe(finalize(() => this.isLoading = false))
        .subscribe({
          next: () => {
            // Notification de succès
            this.snackBar.open(`Le produit "${produitNom}" a été supprimé avec succès`, 'Fermer', {
              duration: 3000,
              panelClass: ['success-snackbar']
            });
            
            // Recharger la liste des produits
            this.chargerProduits();
          },
          error: (err: any) => {
            console.error(`Erreur lors de la suppression du produit ${produitId}:`, err);
            
            // Gestion détaillée des erreurs
            if (err.status === 401 || err.status === 403) {
              this.error = 'Vous n\'avez pas les autorisations nécessaires pour supprimer ce produit.';
            } else if (err.status === 404) {
              this.error = 'Produit introuvable. Il a peut-être déjà été supprimé.';
              // Dans ce cas, on recharge quand même la liste pour s'assurer qu'elle est à jour
              this.chargerProduits();
            } else if (err.status === 409) {
              this.error = 'Impossible de supprimer ce produit car il est utilisé dans des commandes.';
            } else if (err.status === 0) {
              this.error = 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.';
            } else {
              this.error = 'Impossible de supprimer le produit. Veuillez réessayer plus tard.';
            }
            
            // Notification d'erreur
            this.snackBar.open(this.error, 'Fermer', {
              duration: 5000,
              panelClass: ['error-snackbar']
            });
          }
        });
    }
  }

  /**
   * Gère le changement de page
   */
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.chargerProduits();
  }
}
