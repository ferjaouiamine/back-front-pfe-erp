import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ProductService, Product } from '../../services/product.service';
import { StockService, StockMovement } from '../../services/stock.service';

@Component({
  selector: 'app-stock-movement',
  templateUrl: './stock-movement.component.html',
  styleUrls: ['./stock-movement.component.scss']
})
export class StockMovementComponent implements OnInit {
  movementForm: FormGroup;
  products: Product[] = [];
  recentMovements: StockMovement[] = [];
  isLoading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  backendUnavailableMessage: string | null = null;
  
  // Raisons prédéfinies pour les mouvements de stock
  entryReasons = [
    'Réception commande',
    'Retour client',
    'Ajustement inventaire',
    'Transfert entrepôt',
    'Autre'
  ];
  
  exitReasons = [
    'Vente',
    'Retour fournisseur',
    'Ajustement inventaire',
    'Transfert entrepôt',
    'Perte/Casse',
    'Autre'
  ];
  
  constructor(
    private fb: FormBuilder,
    private productService: ProductService,
    private stockService: StockService
  ) {
    this.movementForm = this.fb.group({
      productId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      type: ['ENTRY', Validators.required], // ENTRY ou EXIT
      reason: ['', Validators.required],
      reference: [''],
      customReason: ['']
    });
  }
  
  ngOnInit(): void {
    // Définir immédiatement le message d'avertissement puisque le backend n'est pas disponible
    this.backendUnavailableMessage = this.stockService.getBackendUnavailableMessage();
    
    // Charger les données (les méthodes utiliseront des données fictives)
    this.loadProducts();
    this.loadRecentMovements();
    
    // Surveiller les changements du type de mouvement pour réinitialiser la raison
    this.movementForm.get('type')?.valueChanges.subscribe(type => {
      this.movementForm.get('reason')?.setValue('');
      this.movementForm.get('customReason')?.setValue('');
    });
    
    // Surveiller les changements de la raison pour gérer la raison personnalisée
    this.movementForm.get('reason')?.valueChanges.subscribe(reason => {
      if (reason === 'Autre') {
        this.movementForm.get('customReason')?.setValidators([Validators.required]);
      } else {
        this.movementForm.get('customReason')?.clearValidators();
      }
      this.movementForm.get('customReason')?.updateValueAndValidity();
    });
  }
  
  loadProducts(): void {
    this.isLoading = true;
    this.productService.getProducts().subscribe({
      next: (data) => {
        this.products = data;
        this.isLoading = false;
        
        // Vérifier si les données sont réelles ou fictives
        if (data.length > 0 && data[0].id === 1 && data[0].name === 'Ordinateur portable') {
          // Les données semblent être fictives, afficher un message d'avertissement
          this.backendUnavailableMessage = 'Le serveur de gestion de produits n\'est pas disponible. Les données affichées sont fictives à des fins de démonstration.';
        } else {
          // Les données semblent être réelles, ne pas afficher de message d'avertissement
          this.backendUnavailableMessage = null;
        }
      },
      error: (error) => {
        // Ne pas afficher de message d'erreur puisque nous utilisons des données fictives
        this.products = this.generateMockProducts();
        this.backendUnavailableMessage = 'Le serveur de gestion de produits n\'est pas disponible. Les données affichées sont fictives à des fins de démonstration.';
        this.isLoading = false;
      },
      complete: () => {
        // Si aucun produit n'a été chargé, utiliser des données fictives
        if (this.products.length === 0) {
          this.products = this.generateMockProducts();
          this.backendUnavailableMessage = 'Le serveur de gestion de produits n\'est pas disponible. Les données affichées sont fictives à des fins de démonstration.';
        }
        this.isLoading = false;
      }
    });
  }
  
  /**
   * Génère des produits fictifs pour la démonstration
   */
  private generateMockProducts(): Product[] {
    return [
      { id: 1, name: 'Ordinateur portable', description: 'Ordinateur portable 15.6" Core i5', price: 899.99, quantity: 25, category: { id: 1, name: 'Informatique' } },
      { id: 2, name: 'Écran 24 pouces', description: 'Écran Full HD 24"', price: 199.99, quantity: 15, category: { id: 2, name: 'Périphériques' } },
      { id: 3, name: 'Clavier mécanique', description: 'Clavier mécanique rétroéclairé', price: 89.99, quantity: 30, category: { id: 2, name: 'Périphériques' } },
      { id: 4, name: 'Souris sans fil', description: 'Souris ergonomique sans fil', price: 49.99, quantity: 40, category: { id: 2, name: 'Périphériques' } },
      { id: 5, name: 'Disque SSD 1TB', description: 'Disque SSD 1TB haute performance', price: 129.99, quantity: 20, category: { id: 3, name: 'Stockage' } },
      { id: 6, name: 'Imprimante laser', description: 'Imprimante laser monochrome', price: 199.99, quantity: 10, category: { id: 4, name: 'Impression' } },
      { id: 7, name: 'Routeur WiFi', description: 'Routeur WiFi 6 haut débit', price: 149.99, quantity: 15, category: { id: 5, name: 'Réseau' } },
      { id: 8, name: 'Casque audio', description: 'Casque audio sans fil avec réduction de bruit', price: 249.99, quantity: 18, category: { id: 6, name: 'Audio' } }
    ];
  }
  
  loadRecentMovements(): void {
    this.stockService.getRecentMovements(10).subscribe({
      next: (data) => {
        this.recentMovements = data;
        console.log('Mouvements récents chargés:', data.length);
      },
      error: (error) => {
        console.error('Erreur lors du chargement des mouvements récents:', error);
        // En cas d'erreur, utiliser des données fictives directement
        this.recentMovements = this.generateMockMovements(10);
      },
      complete: () => {
        // Si aucun mouvement n'a été chargé, utiliser des données fictives
        if (this.recentMovements.length === 0) {
          this.recentMovements = this.generateMockMovements(10);
        }
      }
    });
  }
  
  /**
   * Génère des mouvements de stock fictifs pour la démonstration
   */
  private generateMockMovements(count: number): StockMovement[] {
    const types: ('ENTRY' | 'EXIT')[] = ['ENTRY', 'EXIT'];
    const products = [
      { id: '1', name: 'Ordinateur portable' },
      { id: '2', name: 'Écran 24 pouces' },
      { id: '3', name: 'Clavier mécanique' },
      { id: '4', name: 'Souris sans fil' },
      { id: '5', name: 'Disque SSD 1TB' }
    ];
    
    const reasons = [
      'Réception commande',
      'Retour client',
      'Ajustement inventaire',
      'Vente',
      'Transfert entrepôt'
    ];
    
    const movements: StockMovement[] = [];
    
    for (let i = 0; i < count; i++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      const reason = reasons[Math.floor(Math.random() * reasons.length)];
      
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 30));
      
      movements.push({
        id: `mock-${i + 1}`,
        date: date.toISOString(),
        productId: product.id,
        productName: product.name,
        type: type,
        quantity: Math.floor(Math.random() * 20) + 1,
        reference: `REF-${Math.floor(Math.random() * 1000)}`,
        reason: reason,
        userId: 'user-1',
        userName: 'Utilisateur de démonstration'
      });
    }
    
    // Trier par date décroissante
    return movements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  
  onSubmit(): void {
    if (this.movementForm.invalid) {
      // Marquer tous les champs comme touchés pour afficher les erreurs
      Object.keys(this.movementForm.controls).forEach(key => {
        this.movementForm.get(key)?.markAsTouched();
      });
      return;
    }
    
    this.isLoading = true;
    this.errorMessage = null;
    this.successMessage = null;
    
    const { productId, quantity, type, reason, reference, customReason } = this.movementForm.value;
    
    // Déterminer la raison finale (prédéfinie ou personnalisée)
    const finalReason = reason === 'Autre' ? customReason : reason;
    
    if (type === 'ENTRY') {
      // Entrée de stock
      this.stockService.addStockEntry(productId, quantity, finalReason, reference).subscribe({
        next: (response) => {
          this.handleSuccess('Entrée de stock enregistrée avec succès');
        },
        error: (error) => {
          this.handleError('Erreur lors de l\'enregistrement de l\'entrée de stock', error);
        }
      });
    } else {
      // Sortie de stock
      this.stockService.removeStockEntry(productId, quantity, finalReason, reference).subscribe({
        next: (response) => {
          this.handleSuccess('Sortie de stock enregistrée avec succès');
        },
        error: (error) => {
          this.handleError('Erreur lors de l\'enregistrement de la sortie de stock', error);
        }
      });
    }
  }
  
  private handleSuccess(message: string): void {
    this.isLoading = false;
    this.successMessage = message;
    // Recharger les mouvements récents
    this.loadRecentMovements();
    // Réinitialiser le formulaire
    this.movementForm.reset({
      productId: '',
      quantity: 1,
      type: 'ENTRY',
      reason: '',
      reference: '',
      customReason: ''
    });
  }
  
  private handleError(message: string, error: any): void {
    console.error(message, error);
    this.isLoading = false;
    this.errorMessage = `${message}: ${error.message || 'Veuillez réessayer.'}`;
  }
  
  // Formater la date pour l'affichage
  formatDate(date: string): string {
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  // Obtenir la classe CSS pour le type de mouvement
  getMovementTypeClass(type: string): string {
    return type === 'ENTRY' ? 'text-success' : 'text-danger';
  }
  
  // Obtenir l'icône pour le type de mouvement
  getMovementTypeIcon(type: string): string {
    return type === 'ENTRY' ? 'fa-arrow-down' : 'fa-arrow-up';
  }
  
  // Obtenir le texte pour le type de mouvement
  getMovementTypeText(type: string): string {
    return type === 'ENTRY' ? 'Entrée' : 'Sortie';
  }
}
