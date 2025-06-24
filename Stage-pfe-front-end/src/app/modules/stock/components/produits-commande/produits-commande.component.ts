import { Component, OnInit, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, finalize, catchError } from 'rxjs/operators';
import { StockCommandeService, ProductStock } from '../../services/stock-commande.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { QuantiteDialogComponent } from './quantite-dialog/quantite-dialog.component';
import { Subject, of, Subscription } from 'rxjs';

@Component({
  selector: 'app-produits-commande',
  templateUrl: './produits-commande.component.html',
  styleUrls: ['./produits-commande.component.scss']
})
export class ProduitsCommandeComponent implements OnInit, OnDestroy {
  @Input() commandeId!: number; // Ajout du ! pour indiquer que la propriété sera initialisée
  @Input() readOnly: boolean = false;
  @Output() produitAjoute = new EventEmitter<any>();

  produits: ProductStock[] = [];
  categories: string[] = [];
  recherche = new FormControl('');
  categorieSelectionnee = new FormControl('');
  
  page = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;
  
  loading = false;
  error: string | null = null;
  retryCount = 0;
  maxRetries = 2;
  private destroy$ = new Subject<void>();
  private subscriptions: Subscription[] = [];
  
  // Articles fixes pour ajout rapide
  articlesFixesVisible = false;
  articlesFixesPredefinis: ProductStock[] = [
    { id: 1, nom: 'Papier A4', description: 'Ramette de papier A4 standard', prix: 5.99, stock: 100, disponible: true, categorie: 'Fournitures', reference: 'PAP-A4-001' },
    { id: 2, nom: 'Stylos bleus', description: 'Lot de 10 stylos à bille bleus', prix: 3.49, stock: 50, disponible: true, categorie: 'Fournitures', reference: 'STY-BL-010' },
    { id: 3, nom: 'Classeurs', description: 'Classeurs à levier format A4', prix: 2.99, stock: 30, disponible: true, categorie: 'Rangement', reference: 'CLA-A4-001' },
    { id: 4, nom: 'Cartouches d\'encre', description: 'Cartouches compatibles HP', prix: 24.99, stock: 15, disponible: true, categorie: 'Informatique', reference: 'ENC-HP-001' },
    { id: 5, nom: 'Post-it', description: 'Bloc de notes adhésives', prix: 1.99, stock: 80, disponible: true, categorie: 'Fournitures', reference: 'PST-001' }
  ];

  constructor(
    private stockService: StockCommandeService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.chargerCategories();
    this.chargerProduits();

    // Configurer la recherche avec debounce
    const rechercheSubscription = this.recherche.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.page = 0;
        this.chargerProduits();
      });
    this.subscriptions.push(rechercheSubscription);

    // Réagir au changement de catégorie
    const categorieSubscription = this.categorieSelectionnee.valueChanges.subscribe(() => {
      this.page = 0;
      this.chargerProduits();
    });
    this.subscriptions.push(categorieSubscription);
  }
  
  ngOnDestroy(): void {
    // Nettoyer les abonnements pour éviter les fuites de mémoire
    this.destroy$.next();
    this.destroy$.complete();
    
    this.subscriptions.forEach(subscription => {
      if (subscription && !subscription.closed) {
        subscription.unsubscribe();
      }
    });
  }

  chargerCategories(): void {
    this.stockService.getCategories()
      .pipe(
        catchError(err => {
          console.error('Erreur lors du chargement des catégories', err);
          this.error = 'Impossible de charger les catégories. Veuillez réessayer.';
          return of([]);
        })
      )
      .subscribe(categories => {
        if (categories && categories.length > 0) {
          this.categories = categories;
          this.error = null; // Effacer l'erreur si la requête a réussi
        } else if (!this.error) {
          // Ne pas écraser un message d'erreur plus spécifique
          this.error = 'Aucune catégorie disponible';
        }
      });
  }

  chargerProduits(): void {
    this.loading = true;
    this.error = null;

    this.stockService.getProduits(
      this.page,
      this.pageSize,
      this.categorieSelectionnee.value || undefined,
      this.recherche.value || undefined
    )
    .pipe(
      finalize(() => {
        this.loading = false;
      }),
      catchError(err => {
        console.error('Erreur lors du chargement des produits', err);
        
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          this.error = `Tentative de reconnexion (${this.retryCount}/${this.maxRetries})...`;
          
          // Attendre 1 seconde avant de réessayer
          setTimeout(() => this.chargerProduits(), 1000);
          return of(null);
        } else {
          this.error = 'Impossible de charger les produits. Veuillez réessayer plus tard.';
          return of({
            produits: [],
            totalElements: 0,
            totalPages: 0
          });
        }
      })
    )
    .subscribe(result => {
      if (result) {
        this.produits = result.produits;
        this.totalElements = result.totalElements;
        this.totalPages = result.totalPages;
        
        if (this.produits.length > 0) {
          this.error = null;
          this.retryCount = 0; // Réinitialiser le compteur d'essais
        } else if (!this.error) {
          this.error = 'Aucun produit trouvé';
        }
      }
    });
  }

  changePage(event: any): void {
    this.page = event.pageIndex;
    this.pageSize = event.pageSize;
    this.chargerProduits();
  }

  ajouterProduit(produit: ProductStock): void {
    if (this.readOnly) return;
    
    // Utiliser le dialogue Angular Material au lieu du prompt
    const dialogRef = this.dialog.open(QuantiteDialogComponent, {
      width: '400px',
      data: { produit }
    });

    dialogRef.afterClosed().subscribe(quantite => {
      if (!quantite) return; // L'utilisateur a annulé
      
      const quantiteNum = parseInt(quantite, 10);
      if (isNaN(quantiteNum) || quantiteNum <= 0 || (produit.stock && quantiteNum > produit.stock)) {
        this.snackBar.open('Quantité invalide', 'Fermer', { duration: 3000 });
        return;
      }

      this.loading = true;
      this.stockService.ajouterProduitACommande(this.commandeId, produit.id, quantiteNum)
        .pipe(
          finalize(() => {
            this.loading = false;
          }),
          catchError(err => {
            console.error('Erreur lors de l\'ajout du produit', err);
            this.snackBar.open(
              'Erreur lors de l\'ajout du produit. Le serveur est peut-être indisponible.', 
              'Fermer', 
              { duration: 5000 }
            );
            return of(null);
          })
        )
        .subscribe(ligneAjoutee => {
          if (ligneAjoutee) {
            this.snackBar.open(
              `${produit.nom} ajouté à la commande (${quantiteNum} unité${quantiteNum > 1 ? 's' : ''})`, 
              'OK', 
              { duration: 3000 }
            );
            this.produitAjoute.emit(ligneAjoutee);
            
            // Recharger les produits pour mettre à jour les stocks
            this.chargerProduits();
          }
        });
    });
  }

  getStockStatus(produit: ProductStock): string {
    if (!produit.disponible) return 'indisponible';
    if (produit.stock <= 0) return 'rupture';
    if (produit.stock < 5) return 'faible';
    return 'normal';
  }

  getStockIcon(produit: ProductStock): string {
    const status = this.getStockStatus(produit);
    switch (status) {
      case 'indisponible': return 'block';
      case 'rupture': return 'error';
      case 'faible': return 'warning';
      default: return 'check_circle';
    }
  }
  
  /**
   * Affiche ou masque la section des articles fixes
   */
  toggleArticlesFixes(): void {
    this.articlesFixesVisible = !this.articlesFixesVisible;
  }
  
  /**
   * Ajoute un article fixe à la commande
   */
  ajouterArticleFixe(article: ProductStock): void {
    // Utiliser la même méthode que pour les produits normaux
    this.ajouterProduit(article);
  }
  
  /**
   * Réessayer de charger les données après une erreur
   */
  retry(): void {
    this.retryCount = 0;
    this.error = null;
    this.chargerCategories();
    this.chargerProduits();
  }
}
