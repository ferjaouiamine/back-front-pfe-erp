import { Component, OnInit } from '@angular/core';
import { ProductService, Product } from '../../services/product.service';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-low-stock',
  templateUrl: './low-stock.component.html',
  styleUrls: ['./low-stock.component.scss']
})
export class LowStockComponent implements OnInit {
  // Liste des produits à faible stock
  lowStockProducts: Product[] = [];
  filteredProducts: Product[] = [];
  categories: string[] = [];
  searchTerm: string = '';
  selectedCategory: string = 'all';
  selectedStockLevel: string = 'all';
  loading: boolean = true;
  error: string | null = null;

  constructor(
    private productService: ProductService,
    private router: Router,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    // Charger les catégories indépendamment des produits
    this.extractCategories();
    // Charger les produits à faible stock
    this.loadLowStockProducts();
  }
  
  // Méthode pour extraire les catégories depuis le service de produits
  extractCategories(): void {
    // D'abord, récupérer toutes les catégories depuis le backend
    this.productService.getCategories().subscribe({
      next: (categories) => {
        console.log('Catégories récupérées:', categories);
        // Extraire les noms des catégories et les trier par ordre alphabétique
        this.categories = categories.map(cat => cat.name).sort();
      },
      error: (err) => {
        console.error('Erreur lors de la récupération des catégories:', err);
        // En cas d'erreur, utiliser l'ancienne méthode d'extraction à partir des produits
        this.extractCategoriesFromProducts();
      }
    });
  }
  
  // Méthode de secours pour extraire les catégories à partir des produits à faible stock
  extractCategoriesFromProducts(): void {
    // Créer un ensemble pour éviter les doublons
    const uniqueCategories = new Set<string>();
    
    // Parcourir tous les produits et ajouter les noms de catégories à l'ensemble
    this.lowStockProducts.forEach(product => {
      if (product.category && product.category.name) {
        uniqueCategories.add(product.category.name);
      }
    });
    
    // Convertir l'ensemble en tableau et trier par ordre alphabétique
    this.categories = Array.from(uniqueCategories).sort();
  }
  
  // Méthode pour filtrer les produits selon tous les critères
  applyFilter(): void {
    // Commencer avec tous les produits
    let filtered = [...this.lowStockProducts];
    
    // Filtrer par terme de recherche
    if (this.searchTerm && this.searchTerm.trim() !== '') {
      const searchTermLower = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(product => 
        product.name?.toLowerCase().includes(searchTermLower) ||
        product.reference?.toLowerCase().includes(searchTermLower) ||
        product.category?.name?.toLowerCase().includes(searchTermLower)
      );
    }
    
    // Filtrer par catégorie
    if (this.selectedCategory && this.selectedCategory !== 'all') {
      filtered = filtered.filter(product => 
        product.category?.name === this.selectedCategory
      );
    }
    
    // Filtrer par niveau de stock
    if (this.selectedStockLevel !== 'all') {
      filtered = filtered.filter(product => {
        if (!product.quantity || !product.alertThreshold) return false;
        
        switch (this.selectedStockLevel) {
          case 'critical':
            return product.quantity <= product.alertThreshold / 2;
          case 'warning':
            return product.quantity > product.alertThreshold / 2 && product.quantity <= product.alertThreshold;
          case 'normal':
            return product.quantity > product.alertThreshold;
          default:
            return true;
        }
      });
    }
    
    // Maintenir le tri par quantité croissante (du plus bas au plus élevé)
    this.filteredProducts = this.sortProductsByQuantityAsc(filtered);
  }
  
  // Méthode pour gérer le changement dans le champ de recherche
  onSearchChange(): void {
    this.applyFilter();
  }
  
  /**
   * Détermine la classe CSS à appliquer selon le niveau de stock
   * @param product Le produit à évaluer
   * @returns La classe CSS correspondant au niveau de stock
   */
  getStockStatusClass(product: Product): string {
    if (!product || product.quantity === undefined || product.alertThreshold === undefined) {
      return '';
    }
    
    // Stock critique (moins de 50% du seuil d'alerte)
    if (product.quantity <= product.alertThreshold / 2) {
      return 'critical-stock';
    }
    
    // Stock faible (entre 50% et 100% du seuil d'alerte)
    if (product.quantity <= product.alertThreshold) {
      return 'low-stock';
    }
    
    // Stock normal
    return 'normal-stock';
  }

  /**
   * Charge les produits à faible stock
   */
  /**
   * Trie les produits par quantité croissante (du plus bas au plus élevé)
   * @param products Liste des produits à trier
   * @returns Liste triée des produits
   */
  sortProductsByQuantityAsc(products: Product[]): Product[] {
    return [...products].sort((a, b) => {
      // Gérer les cas où quantity pourrait être undefined
      const quantityA = a.quantity !== undefined ? a.quantity : Number.MAX_SAFE_INTEGER;
      const quantityB = b.quantity !== undefined ? b.quantity : Number.MAX_SAFE_INTEGER;
      
      return quantityA - quantityB;
    });
  }
  
  loadLowStockProducts(): void {
    this.loading = true;
    this.error = null;

    // Utiliser la méthode getLowStockProducts sans paramètre car le backend utilise le seuil d'alerte défini pour chaque produit
    this.productService.getLowStockProducts().subscribe({
      next: (products) => {
        // Trier les produits par quantité croissante (du plus bas au plus élevé)
        this.lowStockProducts = this.sortProductsByQuantityAsc(products);
        // Ne plus appeler extractCategories() ici car c'est déjà fait dans ngOnInit()
        this.applyFilter(); // Appliquer le filtre initial
        this.loading = false;
      },
      error: (err) => {
        this.error = `Erreur lors du chargement des produits à faible stock: ${err.message}`;
        this.loading = false;
      }
    });
  }

  /**
   * Rafraîchit les données
   */
  refreshData(): void {
    this.loadLowStockProducts();
  }

  /**
   * Navigue vers la page de détail d'un produit
   */
  viewProductDetails(productId: number): void {
    this.router.navigate(['/stock/detail', productId]);
  }

  /**
   * Navigue vers la page de mouvement de stock pour ajouter du stock
   */
  addStock(productId: number): void {
    this.router.navigate(['/stock/movements'], { 
      queryParams: { 
        productId: productId,
        type: 'ENTRY'
      } 
    });
  }

  /**
   * Navigue vers la page de création de commande d'achat avec le produit pré-sélectionné
   */
  orderProduct(product: Product): void {
    console.log('orderProduct appelé avec le produit:', product);
    
    // Stockage temporaire du produit à commander dans le sessionStorage
    if (product && product.id) {
      // Créer un tableau de produits à commander ou récupérer celui existant
      const existingData = sessionStorage.getItem('productsToOrder');
      console.log('Données existantes dans sessionStorage:', existingData);
      
      const productsToOrder = JSON.parse(existingData || '[]');
      console.log('Produits à commander après parsing:', productsToOrder);
      
      // Vérifier si le produit est déjà dans la liste
      const existingProductIndex = productsToOrder.findIndex((p: any) => p.id === product.id);
      console.log('Index du produit existant:', existingProductIndex);
      
      if (existingProductIndex >= 0) {
        // Si le produit existe déjà, augmenter sa quantité
        productsToOrder[existingProductIndex].quantity = (productsToOrder[existingProductIndex].quantity || 1) + 1;
        console.log('Quantité du produit existant augmentée à:', productsToOrder[existingProductIndex].quantity);
      } else {
        // Sinon, ajouter le produit avec une quantité de 1
        const productToAdd = {
          id: product.id,
          name: product.name,
          reference: product.reference,
          quantity: 1,
          price: product.price || 0
        };
        console.log('Nouveau produit à ajouter:', productToAdd);
        productsToOrder.push(productToAdd);
      }
      
      // Sauvegarder la liste mise à jour
      const dataToStore = JSON.stringify(productsToOrder);
      console.log('Données à stocker dans sessionStorage:', dataToStore);
      sessionStorage.setItem('productsToOrder', dataToStore);
      
      // Vérifier que les données ont bien été enregistrées
      const verificationData = sessionStorage.getItem('productsToOrder');
      console.log('Vérification des données dans sessionStorage après enregistrement:', verificationData);
      
      // Afficher un message de confirmation
      this.snackBar.open(`${product.name} ajouté à la commande d'achat`, 'Fermer', { duration: 3000 });
    } else {
      console.error('Tentative d\'ajout d\'un produit invalide:', product);
    }
    
    // Rediriger vers la page de création de commande d'achat
    console.log('Redirection vers la page de création de commande d\'achat');
    this.router.navigate(['/stock/purchase-orders/new']);
  }

  /**
   * Obtient la classe CSS en fonction du niveau de stock
   */
  getStockLevelClass(quantity: number): string {
    if (quantity <= 5) return 'danger';
    if (quantity <= 20) return 'warning';
    return 'success';
  }

  /**
   * Obtient le texte du niveau de stock
   */
  getStockLevelText(quantity: number): string {
    if (quantity <= 5) return 'Critique';
    if (quantity <= 20) return 'Faible';
    return 'Normal';
  }
}
