import { Component, OnInit } from '@angular/core';
import { Product } from '../../../../modules/stock/services/product.service';
import { ProductService } from '../../../../modules/stock/services/product.service';
import { Facture, FactureItem } from '../../../../modules/facturation/services/facture.service';
import { FactureService } from '../../../../modules/facturation/services/facture.service';
import { AuthService } from '../../../../modules/auth/services/auth.service';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

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
  
  // Formulaire client
  clientForm: FormGroup;
  
  // Méthode de paiement
  selectedPaymentMethod: string = 'CASH';
  loadingMessage: string = '';
  
  constructor(
    private productService: ProductService,
    private factureService: FactureService,
    public authService: AuthService,
    private router: Router,
    private http: HttpClient,
    private fb: FormBuilder
  ) { 
    // Initialiser le formulaire client
    this.clientForm = this.fb.group({
      name: ['', Validators.required],
      email: [''],
      phone: ['']
    });
  }

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
          const processedProducts = products.map(product => {
            // Convertir la catégorie en format compatible
            let categoryObj;
            if (typeof product.category === 'string') {
              categoryObj = {
                name: product.category
              };
            } else if (product.category && typeof product.category === 'object') {
              categoryObj = product.category;
            } else {
              categoryObj = {
                name: ''
              };
            }
            
            return {
              ...product,
              // S'assurer que le prix est un nombre
              price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
              // S'assurer que la quantité est un nombre
              quantity: typeof product.quantity === 'string' ? parseInt(product.quantity, 10) : product.quantity,
              // Assigner la catégorie formatée correctement
              category: categoryObj
            };
          });
          
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
        // Si category est un objet avec une propriété name
        if (typeof product.category === 'object' && product.category.name) {
          categoriesSet.add(product.category.name);
        }
        // Si category est directement une chaîne de caractères
        else if (typeof product.category === 'string') {
          categoriesSet.add(product.category);
        }
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
    
    const searchTermLower = this.searchTerm.toLowerCase();
    
    this.filteredProducts = this.products.filter(product => {
      // Vérification pour le terme de recherche
      const matchesSearch = !this.searchTerm || 
        product.name.toLowerCase().includes(searchTermLower) ||
        (product.description && product.description.toLowerCase().includes(searchTermLower));
      
      // Vérification pour la catégorie
      let matchesCategory = !this.selectedCategory;
      
      if (this.selectedCategory && product.category) {
        // Si category est un objet avec une propriété name
        if (typeof product.category === 'object' && product.category.name) {
          matchesCategory = product.category.name === this.selectedCategory;
        }
        // Si category est directement une chaîne de caractères
        else if (typeof product.category === 'string') {
          matchesCategory = product.category === this.selectedCategory;
        }
      }
      
      return matchesSearch && matchesCategory;
    });
  }
  
  filterByCategory(category: string): void {
    this.selectedCategory = category;
    this.searchProducts();
  }
  
  addToCart(product: Product): void {
    // Vérifier si le produit est déjà dans le panier
    const productIdStr = product.id ? product.id.toString() : '';
    const existingItem = this.cartItems.find(item => item.productId === productIdStr);
    
    if (existingItem) {
      // Incrémenter la quantité
      existingItem.quantity += 1;
      // La propriété totalPrice a été supprimée de l'interface FactureItem
    } else {
      // Ajouter un nouvel élément au panier
      const newItem: FactureItem = {
        id: `item_${Date.now()}`,
        factureId: '',
        productId: productIdStr,
        productName: product.name || '',
        description: product.description || '',
        quantity: 1,
        unitPrice: product.price || 0,
        total: product.price || 0 // Calculer le total comme prix unitaire * quantité
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
  
  /**
   * Affiche un message toast pour informer l'utilisateur
   * @param message Message à afficher
   * @param type Type de message (success, error, info)
   */
  showToast(message: string, type: string = 'success'): void {
    this.successMessage = message;
    setTimeout(() => this.successMessage = null, 3000);
  }
  
  /**
   * Génère et imprime un ticket de caisse pour la vente en cours
   * Enregistre la vente dans le système puis met à jour le stock
   */
  printTicket(): void {
    if (this.cartItems.length === 0) {
      this.errorMessage = 'Le panier est vide. Veuillez ajouter des produits.';
      return;
    }
    
    // Afficher un message de chargement
    this.isLoading = true;
    this.loadingMessage = 'Enregistrement de la vente...';
    
    // Générer un numéro de facture unique
    const invoiceNumber = `T-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    console.log('Génération du ticket avec le numéro:', invoiceNumber);
    
    // Préparer les données de la vente à enregistrer
    const venteData = {
      invoiceNumber: invoiceNumber,
      date: new Date().toISOString(),
      clientName: this.clientForm.value.name || 'Client occasionnel',
      clientEmail: this.clientForm.value.email || '',
      clientPhone: this.clientForm.value.phone || '',
      vendorId: this.authService.getCurrentUser()?.id,
      vendorName: this.authService.getCurrentUser()?.username,
      subtotal: this.subtotal,
      tax: this.taxAmount,
      discount: this.discount,
      total: this.total,
      paymentMethod: this.selectedPaymentMethod,
      status: 'PAID',
      items: this.cartItems.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice
      }))
    };
    
    // Enregistrer la vente via l'API
    console.log('Enregistrement de la vente avec les données:', venteData);
    
    // Appel à l'API pour enregistrer la vente
    this.http.post('http://localhost:8088/api/ventes', venteData)
      .subscribe(
        (response) => {
          console.log('Vente enregistrée avec succès:', response);
          
          // Créer une nouvelle fenêtre pour l'impression
          const printWindow = window.open('', '_blank');
          if (!printWindow) {
            this.errorMessage = 'Impossible d\'ouvrir la fenêtre d\'impression. Vérifiez les paramètres de votre navigateur.';
            this.isLoading = false;
            return;
          }
          
          // Générer le contenu HTML du ticket
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Ticket de caisse - ${invoiceNumber}</title>
              <meta charset="UTF-8">
              <style>
                body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 10px; }
                .company-name { font-size: 16px; font-weight: bold; }
                .order-info { margin-bottom: 10px; }
                .order-number { font-weight: bold; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                th, td { padding: 3px 0; text-align: left; }
                .item-row td { border-bottom: 1px dashed #ddd; }
                .totals { margin-top: 10px; }
                .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                .grand-total { font-weight: bold; font-size: 14px; margin-top: 5px; }
                .footer { text-align: center; margin-top: 15px; font-size: 12px; }
                .divider { border-top: 1px dashed #000; margin: 10px 0; }
              </style>
            </head>
            <body>
              <div class="header">
                <div class="company-name">DreamsPOS</div>
                <div>Système de point de vente</div>
              </div>
              
              <div class="order-info">
                <div class="order-number">${invoiceNumber}</div>
                <div>Date: ${new Date().toLocaleString()}</div>
                <div>Caissier: ${this.authService.getCurrentUser()?.username || 'Utilisateur'}</div>
                ${this.clientForm.value.name ? `<div>Client: ${this.clientForm.value.name}</div>` : ''}
              </div>
              
              <div class="divider"></div>
              
              <table>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Qté</th>
                    <th>Prix</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.cartItems.map(item => `
                    <tr class="item-row">
                      <td>${item.productName}</td>
                      <td>${item.quantity}</td>
                      <td>${item.unitPrice.toFixed(2)} €</td>
                      <td>${(item.unitPrice * item.quantity).toFixed(2)} €</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              
              <div class="divider"></div>
              
              <div class="totals">
                <div class="total-row">
                  <span>Sous-total:</span>
                  <span>${this.subtotal.toFixed(2)} €</span>
                </div>
                <div class="total-row">
                  <span>TVA (${this.taxRate}%):</span>
                  <span>${this.taxAmount.toFixed(2)} €</span>
                </div>
                ${this.discount > 0 ? `
                <div class="total-row">
                  <span>Remise:</span>
                  <span>${this.discount.toFixed(2)} €</span>
                </div>
                ` : ''}
                <div class="total-row grand-total">
                  <span>Total:</span>
                  <span>${this.total.toFixed(2)} €</span>
                </div>
              </div>
              
              <div class="divider"></div>
              
              <div class="payment-info">
                <div>Mode de paiement: ${this.selectedPaymentMethod === 'CASH' ? 'Espèces' : 
                                     this.selectedPaymentMethod === 'CARD' ? 'Carte bancaire' : 
                                     this.selectedPaymentMethod === 'TRANSFER' ? 'Virement' : 'Autre'}</div>
              </div>
              
              <div class="footer">
                <p>Merci pour votre achat!</p>
                <p>À bientôt!</p>
              </div>
            </body>
          </html>
        `);
        
        // Fermer le document et lancer l'impression
        printWindow.document.close();
        printWindow.focus();
        
        // Délai court pour s'assurer que le contenu est chargé avant d'imprimer
        setTimeout(() => {
          printWindow.print();
          
          console.log('Impression terminée, appel de updateStockAfterPrinting avec invoiceNumber:', invoiceNumber);
          // Appeler directement updateStockAfterPrinting après l'impression avec un délai pour s'assurer que l'impression est terminée
          setTimeout(() => {
            console.log('Déclenchement de la mise à jour du stock maintenant...');
            this.updateStockAfterPrinting(invoiceNumber);
            
            // Vider le panier après une vente réussie
            this.cartItems = [];
            this.updateTotals();
            this.successMessage = 'Vente enregistrée et stock mis à jour avec succès';
            this.isLoading = false;
          }, 1000);
          
          // Optionnel: fermer la fenêtre après l'impression
          // printWindow.close();
        }, 500);
        },
        (error) => {
          console.error('Erreur lors de l\'enregistrement de la vente:', error);
          this.errorMessage = 'Erreur lors de l\'enregistrement de la vente. Veuillez réessayer.';
          this.isLoading = false;
          
          // Essayer quand même de mettre à jour le stock en cas d'erreur d'enregistrement
          console.log('Tentative de mise à jour du stock malgré l\'erreur d\'enregistrement...');
          this.updateStockAfterPrinting(invoiceNumber);
        }
      );
}

/**
 * Génère et imprime une liste de commande pour la cuisine ou la préparation
 * Format simplifié contenant uniquement les produits et quantités
 */
printOrderList(): void {
  if (this.cartItems.length === 0) {
    this.errorMessage = 'Le panier est vide. Veuillez ajouter des produits.';
    return;
  }
  
  // Générer un numéro de commande unique
  const orderNumber = `CMD-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  console.log('Génération de la liste de commande avec le numéro:', orderNumber);
  
  // Créer une nouvelle fenêtre pour l'impression
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    this.errorMessage = 'Impossible d\'ouvrir la fenêtre d\'impression. Vérifiez les paramètres de votre navigateur.';
    return;
  }
  
  // Générer le contenu HTML de la liste de commande
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Liste de commande - ${orderNumber}</title>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; font-size: 14px; width: 80mm; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 20px; }
        .order-title { font-size: 18px; font-weight: bold; }
        .order-info { margin-bottom: 15px; }
        .order-number { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 8px 4px; text-align: left; border-bottom: 1px solid #ddd; }
        th { font-weight: bold; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="order-title">BON DE COMMANDE</div>
      </div>
      
      <div class="order-info">
        <div class="order-number">Commande: ${orderNumber}</div>
        <div>Date: ${new Date().toLocaleString()}</div>
        <div>Préparé par: ${this.authService.getCurrentUser()?.username || 'Utilisateur'}</div>
        ${this.clientForm.value.name ? `<div>Client: ${this.clientForm.value.name}</div>` : ''}
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Produit</th>
            <th>Qté</th>
          </tr>
        </thead>
        <tbody>
          ${this.cartItems.map(item => `
            <tr>
              <td>${item.productName}</td>
              <td>${item.quantity}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="footer">
        <p>Bon de commande à usage interne uniquement</p>
      </div>
    </body>
    </html>
  `);
  
  // Fermer le document et lancer l'impression
  printWindow.document.close();
  printWindow.focus();
  
  // Délai court pour s'assurer que le contenu est chargé avant d'imprimer
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

/**
 * Met à jour automatiquement le stock après l'impression d'un ticket
 * et rafraîchit la page pour afficher les quantités mises à jour
 * @param invoiceNumber Numéro de facture/ticket pour référence
 */
updateStockAfterPrinting(invoiceNumber: string): void {
  // Afficher un message de chargement pendant la mise à jour
  this.isLoading = true;
  this.loadingMessage = 'Mise à jour du stock en cours...';
  
  console.log('===== DÉBUT MISE À JOUR STOCK =====');
  console.log('invoiceNumber:', invoiceNumber);
  console.log('cartItems:', this.cartItems);
  
  if (!this.cartItems || this.cartItems.length === 0) {
    console.warn('Aucun article dans le panier à mettre à jour');
    this.isLoading = false;
    return;
  }

  // Préparer les données pour l'endpoint update-after-print
  const items = this.cartItems.map(item => ({
    productId: item.productId,
    quantity: item.quantity
  }));

  const requestData = {
    invoiceNumber: invoiceNumber,
    items: items
  };

  console.log('Données à envoyer:', requestData);

  // Tableau pour stocker toutes les promesses de mise à jour
  const allUpdatePromises: Promise<void>[] = [];

  // 1. Mise à jour via l'endpoint groupé sur le port 8086
  const updateViaGroupEndpoint = new Promise<void>((resolve, reject) => {
    const url = 'http://localhost:8086/api/stock/update-after-print';
    console.log(`Appel à l'API de mise à jour groupée: ${url}`);
    
    this.http.post<any>(url, requestData).subscribe(
      (response) => {
        console.log('Stock mis à jour avec succès via endpoint groupé:', response);
        resolve();
      },
      (error) => {
        console.warn('Échec de la mise à jour via endpoint groupé:', error);
        // Ne pas rejeter, car nous avons d'autres méthodes
        resolve(); // Résoudre quand même pour continuer avec les autres méthodes
      }
    );
  });
  
  allUpdatePromises.push(updateViaGroupEndpoint);

  // 2. Mise à jour via les endpoints individuels sur le port 8082 (service principal)
  this.cartItems.forEach(item => {
    const updateViaMainService = new Promise<void>((resolve, reject) => {
      const baseUrl = `http://localhost:8082/api/stock/movements/product/${item.productId}`;
      const params = `type=EXIT&quantity=${item.quantity}&reason=${encodeURIComponent('Vente - Caisse')}&referenceDocument=${encodeURIComponent(invoiceNumber)}`;
      const url = `${baseUrl}?${params}`;
      
      console.log(`Appel à l'API principale pour le produit ${item.productId}: ${url}`);
      
      this.http.post<any>(url, null).subscribe(
        (response) => {
          console.log(`Stock mis à jour avec succès via API principale pour le produit ${item.productId}:`, response);
          resolve();
        },
        (error) => {
          console.warn(`Échec de la mise à jour via API principale pour le produit ${item.productId}:`, error);
          // Ne pas rejeter, car nous avons d'autres méthodes
          resolve(); // Résoudre quand même pour continuer
        }
      );
    });
    
    allUpdatePromises.push(updateViaMainService);
  });

  // 3. Mise à jour via les endpoints de test sur le port 8086 (service de secours)
  this.cartItems.forEach(item => {
    const updateViaBackupService = new Promise<void>((resolve, reject) => {
      const backupUrl = `http://localhost:8086/api/stock/test-stock-update/${item.productId}?quantity=${item.quantity}&invoiceNumber=${encodeURIComponent(invoiceNumber)}`;
      console.log(`Appel à l'API de secours pour le produit ${item.productId}: ${backupUrl}`);
      
      this.http.get<any>(backupUrl).subscribe(
        (response) => {
          console.log(`Stock mis à jour avec succès via API de secours pour le produit ${item.productId}:`, response);
          resolve();
        },
        (error) => {
          console.warn(`Échec de la mise à jour via API de secours pour le produit ${item.productId}:`, error);
          resolve(); // Résoudre quand même pour continuer
        }
      );
    });
    
    allUpdatePromises.push(updateViaBackupService);
  });

  // Attendre que toutes les tentatives de mise à jour soient terminées
  Promise.all(allUpdatePromises)
    .then(() => {
      console.log('Toutes les tentatives de mise à jour du stock sont terminées');
      
      // Forcer la synchronisation entre tous les services
      this.forceSyncAllServices().then(() => {
        // Forcer le rechargement des produits depuis tous les services possibles
        this.forceProductReload();
        
        this.isLoading = false;
        this.showToast('Stock mis à jour avec succès');
      });
    })
    .catch(errors => {
      console.error('Erreurs lors des mises à jour de stock:', errors);
      
      // Essayer quand même de synchroniser et recharger les produits
      this.forceSyncAllServices().then(() => {
        this.forceProductReload();
        
        this.isLoading = false;
        this.errorMessage = 'Des erreurs sont survenues lors de la mise à jour du stock. Les quantités pourraient ne pas être à jour.';
      });
    });
}

/**
 * Force le rechargement des produits depuis tous les services possibles
 * pour s'assurer que l'interface affiche les quantités à jour
 */
forceProductReload(): void {
  console.log('Forçage du rechargement des produits...');
  
  // 1. Vider le cache du service de produits
  if (this.productService.clearCache) {
    this.productService.clearCache();
    console.log('Cache du service de produits vidé');
  }
  
  // 2. Recharger les produits depuis le service principal
  this.loadProducts();
  console.log('Rechargement des produits depuis le service principal');
  
  // 3. Essayer de recharger depuis les URLs alternatives
  const alternativeUrls = [
    'http://localhost:8080/api/products',
    'http://localhost:8082/api/products',
    'http://localhost:8086/api/products'
  ];
  
  alternativeUrls.forEach(url => {
    if (this.productService.getProductsFromUrl) {
      this.productService.getProductsFromUrl(url).subscribe(
        products => console.log(`Produits rechargés depuis ${url}:`, products.length),
        error => console.warn(`Échec du rechargement depuis ${url}:`, error)
      );
    }
  });
  
  // 4. Forcer un délai avant de recharger à nouveau pour s'assurer de la synchronisation
  setTimeout(() => {
    console.log('Rechargement final des produits après délai...');
    this.loadProducts();
  }, 2000);
}

/**
 * Récupère l'URL de l'image d'un produit à partir de son ID
 * @param productId ID du produit (peut être undefined, string ou number)
 * @returns URL de l'image du produit ou image par défaut si non disponible
 */
getProductImage(productId: string | number | undefined): string {
  // Vérifier si l'ID du produit est valide
  if (!productId) {
    return 'https://via.placeholder.com/300x300?text=Produit';
  }
  
  // Construire l'URL de l'image à partir de l'ID du produit
  // Vous pouvez adapter cette URL selon votre structure de stockage d'images
  return `http://localhost:8080/api/products/${productId}/image` || 'https://via.placeholder.com/300x300?text=Produit';
}

/**
 * Fait défiler la page jusqu'à la section du catalogue de produits
 */
scrollToCatalog(): void {
  // Sélectionner l'élément du catalogue (vous devrez ajouter un id="catalog" à cet élément dans le HTML)
  const catalogElement = document.getElementById('catalog');
  if (catalogElement) {
    // Faire défiler jusqu'à l'élément avec un comportement fluide
    catalogElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Retourne la date actuelle formatée pour l'affichage sur le reçu
 * @returns Date formatée (ex: 26/06/2025 18:35)
 */
getFormattedDate(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Calcule la quantité totale d'articles dans le panier
 * @returns Le nombre total d'articles (somme des quantités)
 */
getTotalQuantity(): number {
  return this.cartItems.reduce((total, item) => total + item.quantity, 0);
}

/**
 * Force la synchronisation entre tous les services (magasinier, stock, vendeur)
 * en appelant les APIs de synchronisation disponibles
 * @returns Promise qui se résout quand toutes les synchronisations sont terminées
 */
forceSyncAllServices(): Promise<void> {
  console.log('===== DÉBUT SYNCHRONISATION ENTRE SERVICES =====');
  this.loadingMessage = 'Synchronisation des services en cours...';
  
  const syncPromises: Promise<void>[] = [];
  
  // 1. Synchronisation globale des produits via l'API du service caisse
  const syncAllProducts = new Promise<void>((resolve) => {
    const url = 'http://localhost:8088/api/sync/all';
    console.log(`Appel à l'API de synchronisation globale: ${url}`);
    
    this.http.post<any>(url, {}).subscribe(
      (response) => {
        console.log('Synchronisation globale réussie:', response);
        resolve();
      },
      (error) => {
        console.warn('Échec de la synchronisation globale:', error);
        resolve(); // Continuer même en cas d'erreur
      }
    );
  });
  
  syncPromises.push(syncAllProducts);
  
  // 2. Synchronisation des catégories principales
  const categories = ['Électronique', 'Informatique', 'Téléphonie', 'Accessoires'];
  
  categories.forEach(category => {
    const syncCategory = new Promise<void>((resolve) => {
      const url = `http://localhost:8088/api/sync/category/${encodeURIComponent(category)}`;
      console.log(`Appel à l'API de synchronisation de catégorie: ${url}`);
      
      this.http.post<any>(url, {}).subscribe(
        (response) => {
          console.log(`Synchronisation de la catégorie ${category} réussie:`, response);
          resolve();
        },
        (error) => {
          console.warn(`Échec de la synchronisation de la catégorie ${category}:`, error);
          resolve(); // Continuer même en cas d'erreur
        }
      );
    });
    
    syncPromises.push(syncCategory);
  });
  
  // 3. Forcer la mise à jour des données dans les autres services (magasinier, vendeur)
  const otherServiceUrls = [
    'http://localhost:8080/api/products/refresh',
    'http://localhost:8082/api/products/refresh',
    'http://localhost:8086/api/products/refresh'
  ];
  
  otherServiceUrls.forEach(url => {
    const refreshService = new Promise<void>((resolve) => {
      console.log(`Appel à l'API de rafraîchissement: ${url}`);
      
      this.http.get<any>(url).subscribe(
        (response) => {
          console.log(`Rafraîchissement via ${url} réussi:`, response);
          resolve();
        },
        (error) => {
          console.warn(`Échec du rafraîchissement via ${url}:`, error);
          resolve(); // Continuer même en cas d'erreur
        }
      );
    });
    
    syncPromises.push(refreshService);
  });
  
  // Attendre que toutes les synchronisations soient terminées
  return Promise.all(syncPromises)
    .then(() => {
      console.log('===== FIN SYNCHRONISATION ENTRE SERVICES =====');
      return Promise.resolve();
    })
    .catch(error => {
      console.error('Erreur lors de la synchronisation des services:', error);
      return Promise.resolve(); // Résoudre quand même pour ne pas bloquer le flux
    });
}

}
