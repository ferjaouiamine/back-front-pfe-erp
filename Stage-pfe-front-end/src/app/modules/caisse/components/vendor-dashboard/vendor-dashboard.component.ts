import { Component, OnInit } from '@angular/core';
import { Product } from '../../../../modules/stock/services/product.service';
import { ProductService } from '../../../../modules/stock/services/product.service';
import { Facture, FactureItem } from '../../../../modules/facturation/services/facture.service';
import { FactureService } from '../../../../modules/facturation/services/facture.service';
import { AuthService } from '../../../../modules/auth/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-vendor-dashboard',
  templateUrl: './vendor-dashboard.component.html',
  styleUrls: ['./vendor-dashboard.component.scss']
})
export class VendorDashboardComponent implements OnInit {
  // Produits et filtrage
  products: Product[] = [];
  filteredProducts: Product[] = [];
  searchTerm: string = '';
  selectedCategory: string = '';
  categories: string[] = [];
  
  // Panier d'achat
  cartItems: FactureItem[] = [];
  
  // Informations client
  clientName: string = '';
  clientEmail: string = '';
  clientPhone: string = '';
  
  // Informations facture
  taxRate: number = 20; // TVA 20%
  subtotal: number = 0;
  taxAmount: number = 0;
  total: number = 0;
  discount: number = 0;
  
  // Statistiques du tableau de bord
  factures: Facture[] = [];
  totalSalesAmount: number = 0;
  totalProductsSold: number = 0;
  averageOrderValue: number = 0;
  topSellingProducts: {productId: string, productName: string, quantity: number}[] = [];
  recentSales: Facture[] = [];
  
  // États
  isLoading: boolean = false;
  isDashboardLoading: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  
  constructor(
    private productService: ProductService,
    private factureService: FactureService,
    public authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadProducts();
    this.loadFactures();
    
    // Attendre un peu pour s'assurer que les produits sont chargés avant de calculer les statistiques
    setTimeout(() => {
      this.getProductStatistics();
    }, 1000);
  }
  
  // Charger les factures depuis la base de données et calculer les statistiques
  loadFactures(): void {
    console.log('Chargement des factures depuis la base de données...');
    this.isDashboardLoading = true;
    
    this.factureService.getFactures().subscribe({
      next: (factures) => {
        console.log('Factures chargées avec succès depuis la base de données:', factures.length, 'factures');
        
        // Stocker les factures dans le composant
        this.factures = factures;
        
        // Calculer les statistiques du tableau de bord
        this.calculateDashboardStatistics(factures);
        
        if (factures.length === 0) {
          console.warn('Aucune facture disponible dans la base de données.');
        } else {
          console.log(`${factures.length} factures chargées depuis la base de données.`);
        }
        
        this.isDashboardLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des factures depuis la base de données:', error);
        this.isDashboardLoading = false;
      }
    });
  }
  
  // Calculer les statistiques du tableau de bord à partir des données réelles
  calculateDashboardStatistics(factures: Facture[]): void {
    // Réinitialiser les statistiques
    this.totalSalesAmount = 0;
    this.totalProductsSold = 0;
    this.topSellingProducts = [];
    
    // Ne prendre en compte que les factures payées
    const paidFactures = factures.filter(f => f.status === 'PAID');
    
    // Calculer le montant total des ventes
    this.totalSalesAmount = paidFactures.reduce((sum, facture) => sum + facture.total, 0);
    
    // Calculer le nombre total de produits vendus et identifier les produits les plus vendus
    const productSales: {[key: string]: {productId: string, productName: string, quantity: number}} = {};
    
    paidFactures.forEach(facture => {
      if (facture.items && facture.items.length > 0) {
        facture.items.forEach(item => {
          this.totalProductsSold += item.quantity;
          
          // Agréger les ventes par produit
          if (!productSales[item.productId]) {
            productSales[item.productId] = {
              productId: item.productId,
              productName: item.productName,
              quantity: 0
            };
          }
          productSales[item.productId].quantity += item.quantity;
        });
      }
    });
    
    // Convertir l'objet en tableau et trier par quantité vendue (décroissant)
    this.topSellingProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5); // Garder les 5 meilleurs produits
    
    // Calculer la valeur moyenne des commandes
    this.averageOrderValue = paidFactures.length > 0 
      ? this.totalSalesAmount / paidFactures.length 
      : 0;
    
    // Récupérer les ventes récentes (5 dernières factures)
    this.recentSales = [...factures]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }
  
  loadProducts(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    console.log('Chargement des produits depuis la base de données MySQL...');
    
    this.productService.getProducts().subscribe({
      next: (products) => {
        console.log('Produits chargés avec succès depuis la base de données:', products.length, 'produits');
        
        if (products.length > 0) {
          // Traiter les données réelles pour s'assurer qu'elles sont correctement formatées
          const processedProducts = products.map(product => ({
            ...product,
            // S'assurer que le prix est un nombre
            price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
            // S'assurer que la quantité est un nombre
            quantity: typeof product.quantity === 'string' ? parseInt(product.quantity, 10) : product.quantity,
            // S'assurer que la catégorie est une chaîne
            category: product.category?.toString() || ''
          }));
          
          this.products = processedProducts;
          this.filteredProducts = [...processedProducts];
          this.extractCategories();
          
          console.log(`${products.length} produits chargés depuis la base de données MySQL.`);
        } else {
          this.errorMessage = 'Aucun produit disponible dans la base de données.';
          console.warn('Aucun produit trouvé dans la base de données MySQL.');
          
          // Essayer de récupérer les produits depuis l'API de secours
          this.loadProductsFromBackupAPI();
        }
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des produits depuis la base de données MySQL:', error);
        this.errorMessage = 'Erreur lors du chargement des produits. Tentative avec API de secours...';
        
        // Essayer de récupérer les produits depuis l'API de secours
        this.loadProductsFromBackupAPI();
      }
    });
  }
  
  // Charger les produits depuis l'API de secours
  loadProductsFromBackupAPI(): void {
    console.log('Tentative de récupération des produits depuis l\'API de secours...');
    
    const backupUrl = 'http://localhost:8082/api/produits';
    this.productService.getProductsFromUrl(backupUrl).subscribe({
      next: (products: Product[]) => {
        console.log('Produits chargés avec succès depuis l\'API de secours:', products.length, 'produits');
        
        if (products.length > 0) {
          this.products = products;
          this.filteredProducts = [...products];
          this.extractCategories();
          this.errorMessage = null;
          
          console.log(`${products.length} produits chargés depuis l'API de secours.`);
        } else {
          this.errorMessage = 'Aucun produit disponible dans la base de données ni dans l\'API de secours.';
        }
        
        this.isLoading = false;
      },
      error: (secondError: any) => {
        console.error('Erreur lors du chargement des produits depuis l\'API de secours:', secondError);
        this.errorMessage = 'Impossible de charger les produits. Veuillez vérifier votre connexion et réessayer.';
        this.isLoading = false;
      }
    });
  }
  
  extractCategories(): void {
    // Extraire les catégories uniques des produits
    const categoriesSet = new Set<string>();
    this.products.forEach(product => {
      if (product.category) {
        categoriesSet.add(product.category);
      }
    });
    this.categories = Array.from(categoriesSet);
  }
  
  // Méthode pour extraire les statistiques des produits
  getProductStatistics(): void {
    if (!this.products || this.products.length === 0) return;
    
    // Calculer la valeur totale du stock
    const totalStockValue = this.products.reduce((sum, product) => {
      return sum + (product.price * product.quantity);
    }, 0);
    
    console.log('Valeur totale du stock:', totalStockValue.toFixed(2));
    
    // Identifier les produits à faible stock (moins de 5 unités)
    const lowStockProducts = this.products
      .filter(product => product.quantity < 5)
      .map(product => ({
        id: product.id,
        name: product.name,
        quantity: product.quantity
      }));
    
    console.log('Produits à faible stock:', lowStockProducts);
    
    // Produits les plus chers
    const mostExpensiveProducts = [...this.products]
      .sort((a, b) => b.price - a.price)
      .slice(0, 3);
    
    console.log('Produits les plus chers:', mostExpensiveProducts);
  }
  
  // Méthode pour réinitialiser les filtres
  resetFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = '';
    this.filteredProducts = [...this.products];
  }
  
  searchProducts(): void {
    if (!this.searchTerm && !this.selectedCategory) {
      this.filteredProducts = [...this.products];
      return;
    }
    
    this.filteredProducts = this.products.filter(product => {
      const matchesSearch = !this.searchTerm || 
        product.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(this.searchTerm.toLowerCase());
        
      const matchesCategory = !this.selectedCategory || 
        product.category === this.selectedCategory;
        
      return matchesSearch && matchesCategory;
    });
  }
  
  filterByCategory(category: string): void {
    this.selectedCategory = category;
    this.searchProducts();
  }
  
  addToCart(product: Product): void {
    // Vérifier si le produit est déjà dans le panier
    const existingItem = this.cartItems.find(item => item.productId === product.id);
    
    if (existingItem) {
      // Incrémenter la quantité
      existingItem.quantity += 1;
      // La propriété totalPrice a été supprimée de l'interface FactureItem
    } else {
      // Ajouter un nouvel élément au panier
      const newItem: FactureItem = {
        id: `item_${Date.now()}`,
        factureId: '',
        productId: product.id,
        productName: product.name,
        description: product.description,
        quantity: 1,
        unitPrice: product.price,
        total: product.price // Calculer le total comme prix unitaire * quantité
      };
      this.cartItems.push(newItem);
    }
    
    // Mettre à jour les totaux
    this.updateTotals();
  }
  
  removeFromCart(index: number): void {
    this.cartItems.splice(index, 1);
    this.updateTotals();
  }
  
  updateItemQuantity(index: number, quantity: number): void {
    if (quantity <= 0) {
      this.removeFromCart(index);
      return;
    }
    
    const item = this.cartItems[index];
    item.quantity = quantity;
    // La propriété totalPrice a été supprimée de l'interface FactureItem
    
    this.updateTotals();
  }
  
  updateTotals(): void {
    // Calculer le sous-total
    this.subtotal = this.factureService.calculateSubtotal(this.cartItems);
    
    // Calculer la TVA
    this.taxAmount = this.factureService.calculateTaxAmount(this.subtotal, this.taxRate);
    
    // Calculer le total
    this.total = this.factureService.calculateTotal(this.subtotal, this.taxAmount, this.discount);
  }
  
  applyDiscount(discountAmount: number): void {
    this.discount = discountAmount;
    this.updateTotals();
  }
  
  createFacture(): void {
    if (this.cartItems.length === 0) {
      this.errorMessage = 'Le panier est vide. Veuillez ajouter des produits.';
      return;
    }
    
    if (!this.clientName) {
      this.errorMessage = 'Veuillez saisir le nom du client.';
      return;
    }
    
    this.isLoading = true;
    this.errorMessage = null;
    
    // Créer l'objet facture
    const currentUser = this.authService.getCurrentUser();
    const vendorId = currentUser?.id || 'vendor_123';
    const vendorName = currentUser?.username || 'Vendeur Test';
    const vendorEmail = 'vendeur@example.com';
    
    // Créer l'objet facture avec les propriétés requises par la nouvelle interface
    const facture: Facture = {
      id: `fact_${Date.now()}`,
      number: `F-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
      date: new Date(),
      dueDate: new Date(new Date().setDate(new Date().getDate() + 15)), // Échéance à 15 jours
      clientName: this.clientName,
      clientEmail: this.clientEmail,
      items: this.cartItems,
      discount: this.discount,
      total: this.total,
      status: 'PENDING',
      vendorId: vendorId,
      vendorName: vendorName,
      vendorEmail: vendorEmail,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Envoyer la facture au serveur
    this.factureService.createFacture(facture).subscribe({
      next: (response) => {
        this.successMessage = `Facture ${response.number} créée avec succès.`;
        this.isLoading = false;
        
        // Réinitialiser le formulaire
        this.resetForm();
        
        // Rediriger vers la page de détail de la facture après 2 secondes
        setTimeout(() => {
          this.router.navigate(['/facturation', response.id]);
        }, 2000);
      },
      error: (error) => {
        console.error('Erreur lors de la création de la facture:', error);
        this.errorMessage = 'Erreur lors de la création de la facture. Veuillez réessayer.';
        this.isLoading = false;
      }
    });
  }
  
  resetForm(): void {
    this.cartItems = [];
    this.clientName = '';
    this.clientEmail = '';

    this.discount = 0;
    this.updateTotals();
  }
  
  viewSales(): void {
    this.router.navigate(['/facturation']);
  }
}
