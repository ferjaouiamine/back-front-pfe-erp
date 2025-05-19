import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FournisseurService, ProduitFournisseur } from '../../services/fournisseur.service';
import { finalize } from 'rxjs/operators';

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
    private fb: FormBuilder
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
   * Charge les produits depuis le backend
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
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response) => {
          if (response && response.content) {
            this.dataSource.data = response.content;
            this.totalItems = response.totalElements || 0;
          } else {
            // Si la réponse n'a pas la structure attendue
            console.error('Format de réponse inattendu:', response);
            this.dataSource.data = [];
            this.totalItems = 0;
          }
        },
        error: (err: any) => {
          console.error('Erreur lors du chargement des produits:', err);
          this.error = 'Impossible de charger les produits. Veuillez réessayer plus tard.';

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
   * Change la disponibilité d'un produit
   */
  toggleDisponibilite(produit: ProduitFournisseur): void {
    this.isLoading = true;

    this.fournisseurService.updateProduitDisponibilite(produit.id, !produit.disponible)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (updatedProduit) => {
          // Mettre à jour le produit dans la liste
          const index = this.dataSource.data.findIndex(p => p.id === produit.id);
          if (index !== -1) {
            this.dataSource.data[index].disponible = updatedProduit.disponible;
            // Créer une nouvelle référence pour déclencher la mise à jour de la vue
            this.dataSource.data = [...this.dataSource.data];
          }
        },
        error: (err: any) => {
          console.error(`Erreur lors de la mise à jour de la disponibilité du produit ${produit.id}:`, err);
          this.error = 'Impossible de mettre à jour la disponibilité du produit. Veuillez réessayer plus tard.';
          // Annuler le changement d'état du toggle
          produit.disponible = !produit.disponible;
        }
      });
  }

  /**
   * Ouvre la boîte de dialogue pour ajouter un nouveau produit
   */
  ajouterProduit(): void {
    // TODO: Implémenter la boîte de dialogue pour ajouter un produit
    console.log('Ajouter un nouveau produit');

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
        next: () => {
          // Recharger la liste des produits
          this.chargerProduits();
        },
        error: (err: any) => {
          console.error('Erreur lors de la création du produit:', err);
          this.error = 'Impossible de créer le produit. Veuillez réessayer plus tard.';
        }
      });
  }

  /**
   * Ouvre la boîte de dialogue pour modifier un produit
   */
  modifierProduit(produit: ProduitFournisseur): void {
    // TODO: Implémenter la boîte de dialogue pour modifier un produit
    console.log('Modifier le produit:', produit);

    // Exemple de mise à jour (sans boîte de dialogue)
    const produitModifie: Partial<ProduitFournisseur> = {
      ...produit,
      nom: produit.nom + ' (modifié)',
      prix: produit.prix * 1.1 // Augmenter le prix de 10%
    };

    this.isLoading = true;

    this.fournisseurService.updateProduit(produit.id, produitModifie)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: () => {
          // Recharger la liste des produits
          this.chargerProduits();
        },
        error: (err: any) => {
          console.error(`Erreur lors de la mise à jour du produit ${produit.id}:`, err);
          this.error = 'Impossible de mettre à jour le produit. Veuillez réessayer plus tard.';
        }
      });
  }

  /**
   * Supprime un produit
   */
  supprimerProduit(produit: ProduitFournisseur): void {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le produit "${produit.nom}" ?`)) {
      this.isLoading = true;

      this.fournisseurService.deleteProduit(produit.id)
        .pipe(finalize(() => this.isLoading = false))
        .subscribe({
          next: () => {
            // Recharger la liste des produits
            this.chargerProduits();
          },
          error: (err: any) => {
            console.error(`Erreur lors de la suppression du produit ${produit.id}:`, err);
            this.error = 'Impossible de supprimer le produit. Veuillez réessayer plus tard.';
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
