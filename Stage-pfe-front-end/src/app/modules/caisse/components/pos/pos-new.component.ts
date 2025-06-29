import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { CaisseService } from '../../services/caisse.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ProductService } from '../../../stock/services/product.service';
import { 
  CartItem, 
  SaleTransaction, 
  PaymentMethod, 
  TransactionStatus,
  CashRegisterSession,
  SessionStatus,
  ProductCategory
} from '../../models/pos.models';
import { PaymentDialogComponent } from '../payment-dialog/payment-dialog.component';
import { OpenRegisterDialogComponent } from '../open-register-dialog/open-register-dialog.component';
import { CloseRegisterDialogComponent } from '../close-register-dialog/close-register-dialog.component';
import { ProductDetailsDialogComponent } from '../product-details-dialog/product-details-dialog.component';

// Interface ProductCategory importée depuis pos.models.ts

@Component({
  selector: 'app-pos-new',
  templateUrl: './pos-new.component.html',
  styleUrls: ['./pos-new.component.scss', './pos-enhanced-design.css', './pos-cart-enhanced.css', './pos-scroll-fix.css', './pos-main-scroll-fix.css', './pos-responsive.css', './pos-fullscreen.css', './pos-new-improvements.scss']
})
export class PosNewComponent implements OnInit, OnDestroy {
  // Propriétés de la session de caisse
  activeSession: CashRegisterSession | null = null;
  isRegisterOpen = false;
  backendAvailable = true;
  currentTime = new Date();
  currentUser: any = null;
  
  // Propriétés de recherche et produits
  searchQuery = '';
  isSearching = false;
  products: any[] = [];
  selectedCategory: string = 'all';
  
  // Propriétés du panier
  cartItems: CartItem[] = [];
  subtotal = 0;
  taxTotal = 0;
  total = 0;
  discount = 0;

  // Catégories de produits
  categories: ProductCategory[] = [];
  
  // Mapping des icônes par catégorie (à adapter selon vos catégories réelles)
  categoryIcons: {[key: string]: string} = {
    'Mobiles': 'smartphone',
    'Ordinateurs': 'laptop',
    'Montres': 'watch',
    'Écouteurs': 'headphones',
    'Composants': 'memory',
    'Accessoires': 'devices_other',
    'Défaut': 'category'
  };
  
  // Pour la gestion de l'abonnement
  private destroy$ = new Subject<void>();

  constructor(
    private caisseService: CaisseService,
    private productService: ProductService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // Vérifier si une session de caisse est active
    this.checkActiveSession();
    
    // Initialiser l'horloge en temps réel
    interval(1000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.currentTime = new Date();
      });
    
    // Récupérer l'utilisateur courant
    this.currentUser = this.authService.getCurrentUser();
    
    // Charger les catégories puis les produits
    this.loadCategories();
    this.loadProducts('all');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Vérifie si une session de caisse est active
   */
  checkActiveSession(): void {
    this.caisseService.getActiveSession('REG-001').subscribe({
      next: (session) => {
        this.activeSession = session;
        this.isRegisterOpen = !!session;
        this.backendAvailable = this.caisseService.isBackendAvailable();
        
        if (session) {
          console.log('Session active trouvée:', session);
        } else {
          console.log('Aucune session active trouvée');
        }
      },
      error: (error) => {
        console.error('Erreur lors de la vérification de la session active:', error);
        this.backendAvailable = false;
      }
    });
  }

  /**
   * Charge les produits pour une catégorie donnée ou tous les produits
   */
  loadProducts(categoryId: string = 'all'): void {
    this.isSearching = true;
    this.selectedCategory = categoryId;
    
    // Utiliser le service approprié selon la catégorie
    if (categoryId === 'all') {
      this.productService.getProducts().subscribe({
        next: (results) => {
          console.log('Produits reçus dans le composant:', results);
          this.products = results || [];
          this.isSearching = false;
          this.backendAvailable = this.caisseService.isBackendAvailable();
          
          // Si aucun produit n'est retourné, afficher un message
          if (this.products.length === 0) {
            console.warn('Aucun produit retourné par le service');
          }
        },
        error: (error) => {
          console.error('Erreur lors du chargement des produits:', error);
          this.isSearching = false;
          this.showNotification('Erreur lors du chargement des produits', 'error');
          this.backendAvailable = this.caisseService.isBackendAvailable();
          this.products = [];
        }
      });
    } else {
      this.caisseService.getProductsByCategory(categoryId).subscribe({
        next: (results) => {
          console.log('Produits par catégorie reçus dans le composant:', results);
          this.products = results || [];
          this.isSearching = false;
          this.backendAvailable = this.caisseService.isBackendAvailable();
          
          // Si aucun produit n'est retourné, afficher un message
          if (this.products.length === 0) {
            console.warn('Aucun produit retourné pour cette catégorie');
          }
        },
        error: (error) => {
          console.error('Erreur lors du chargement des produits par catégorie:', error);
          this.isSearching = false;
          this.showNotification('Erreur lors du chargement des produits', 'error');
          this.backendAvailable = this.caisseService.isBackendAvailable();
          this.products = [];
        }
      });
    }
  }

  /**
   * Charge les catégories de produits
   */
  loadCategories(): void {
    this.caisseService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des catégories:', error);
      }
    });
  }

  /**
   * Gestion du changement de la recherche
   */
  onSearchChange(): void {
    if (this.searchQuery && this.searchQuery.length > 2) {
      this.isSearching = true;
      
      // Appel au service pour rechercher les produits
      this.caisseService.searchProduct(this.searchQuery).subscribe({
        next: (results) => {
          this.products = results;
          this.isSearching = false;
        },
        error: (error) => {
          console.error('Erreur lors de la recherche de produits:', error);
          this.isSearching = false;
          this.showNotification('Erreur lors de la recherche', 'error');
          this.backendAvailable = this.caisseService.isBackendAvailable();
        }
      });
    } else if (!this.searchQuery) {
      // Si la recherche est vide, charger tous les produits
      this.loadProducts(this.selectedCategory);
    }
  }

  /**
   * Réinitialise la recherche
   */
  clearSearch(): void {
    this.searchQuery = '';
    this.loadProducts(this.selectedCategory);
  }

  /**
   * Retourne l'icône correspondant au statut de stock
   */
  getStockIcon(product: any): string {
    if (!product.quantityInStock || product.quantityInStock <= 0) {
      return 'remove_shopping_cart';
    } else if (product.quantityInStock < 5) {
      return 'warning';
    } else {
      return 'check_circle';
    }
  }
  
  /**
   * Retourne la classe CSS pour le statut de stock
   */
  getStockStatus(product: any): string {
    if (!product.quantityInStock || product.quantityInStock <= 0) {
      return 'out-of-stock';
    } else if (product.quantityInStock < 5) {
      return 'low-stock';
    } else {
      return 'in-stock';
    }
  }

  /**
   * Ajoute un produit au panier
   */
  addToCart(product: any, quantity: number = 1): void {
    if (!product || !product.quantityInStock || product.quantityInStock <= 0) {
      this.showNotification('Produit en rupture de stock', 'error');
      return;
    }
    
    // Vérifier si le produit est déjà dans le panier
    const existingItemIndex = this.cartItems.findIndex(item => item.productId === product.id);
    
    if (existingItemIndex !== -1) {
      // Mettre à jour la quantité si le produit est déjà dans le panier
      this.updateQuantity(existingItemIndex, this.cartItems[existingItemIndex].quantity + quantity);
      return;
    }
    
    // Ajouter le nouveau produit au panier
    const taxRate = product.taxRate || 20; // 20% par défaut
    const taxAmount = (product.price * taxRate / 100) * quantity;
    
    const newItem: CartItem = {
      productId: product.id,
      productName: product.name,
      barcode: product.barcode,
      quantity: quantity,
      unitPrice: product.price,
      totalPrice: product.price * quantity,
      taxRate: taxRate,
      taxAmount: taxAmount,
      discount: 0,
      product: product
    };
    
    this.cartItems = [...this.cartItems, newItem];
    this.calculateTotals();
    
    this.showNotification(`${quantity} × ${product.name} ajouté au panier`, 'success');
  }

  /**
   * Met à jour la quantité d'un produit dans le panier
   */
  updateQuantity(index: number, newQuantity: number): void {
    if (newQuantity <= 0) {
      this.removeFromCart(index);
      return;
    }
    
    const currentItem = this.cartItems[index];
    const product = currentItem.product;
    
    // Vérifier si la quantité demandée est disponible en stock
    if (product && newQuantity > product.quantityInStock) {
      this.showNotification(`Quantité limitée à ${product.quantityInStock} en stock`, 'warning');
      newQuantity = product.quantityInStock;
    }
    
    const updatedItems = [...this.cartItems];
    updatedItems[index] = {
      ...currentItem,
      quantity: newQuantity,
      totalPrice: currentItem.unitPrice * newQuantity,
      taxAmount: (currentItem.unitPrice * (currentItem.taxRate || 20) / 100) * newQuantity
    };
    
    this.cartItems = updatedItems;
    this.calculateTotals();
  }

  /**
   * Supprime un article du panier
   */
  removeFromCart(index: number): void {
    this.cartItems = this.cartItems.filter((_, i) => i !== index);
    this.calculateTotals();
  }

  /**
   * Calcule les totaux du panier
   */
  calculateTotals(): void {
    this.subtotal = this.cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
    this.taxTotal = this.cartItems.reduce((sum, item) => sum + item.taxAmount, 0);
    this.total = this.subtotal + this.taxTotal - this.discount;
  }

  /**
   * Met en attente la commande actuelle
   */
  holdOrder(): void {
    if (this.cartItems.length === 0) {
      this.showNotification('Panier vide, rien à mettre en attente', 'warning');
      return;
    }
    
    // Implémentation à adapter selon les besoins
    this.showNotification('Commande mise en attente', 'success');
    // Ici, vous pourriez sauvegarder la commande en cours dans un état temporaire
  }

  /**
   * Ouvre la boîte de dialogue de paiement
   */
  openPaymentModal(): void {
    if (this.cartItems.length === 0) {
      this.showNotification('Veuillez ajouter des produits au panier', 'warning');
      return;
    }
    
    const dialogRef = this.dialog.open(PaymentDialogComponent, {
      width: '500px',
      data: {
        cartItems: this.cartItems,
        subtotal: this.subtotal,
        tax: this.taxTotal,
        discount: this.discount,
        total: this.total
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Traitement du paiement
        this.processPayment(result);
      }
    });
  }
  
  /**
   * Traite le paiement de la commande
   */
  processPayment(paymentDetails: any): void {
    if (this.cartItems.length === 0) {
      this.showNotification('Panier vide, impossible de finaliser', 'error');
      return;
    }
    
    if (!this.activeSession) {
      this.showNotification('Aucune session de caisse active', 'error');
      return;
    }
    
    const transaction: SaleTransaction = {
      transactionNumber: `TX-${Date.now()}`,
      date: new Date(),
      items: [...this.cartItems],
      subtotal: this.subtotal,
      taxTotal: this.taxTotal,
      total: this.total,
      paymentMethod: paymentDetails?.method || PaymentMethod.CASH,
      amountTendered: paymentDetails?.amountTendered || this.total,
      change: paymentDetails?.change || 0,
      cashierId: this.currentUser?.id || 'unknown',
      cashierName: this.currentUser?.username || 'Utilisateur',
      registerNumber: this.activeSession?.registerNumber || 'REG-001',
      sessionId: this.activeSession?.id || 'SESSION-TEMP',
      status: TransactionStatus.COMPLETED
    };
    
    this.caisseService.createSaleTransaction(transaction).subscribe({
      next: (result) => {
        this.showNotification('Paiement traité avec succès', 'success');
        // Vider le panier après le paiement
        this.cartItems = [];
        this.calculateTotals();
        
        // Option pour imprimer un reçu
        if (paymentDetails?.printReceipt) {
          this.printOrder();
        }
      },
      error: (error) => {
        console.error('Erreur lors du traitement du paiement:', error);
        this.showNotification('Erreur lors du traitement du paiement', 'error');
      }
    });
  }
  
  /**
   * Annule la commande en cours
   */
  voidOrder(): void {
    if (this.cartItems.length === 0) {
      this.showNotification('Aucun article à annuler', 'warning');
      return;
    }
    
    // Vider le panier
    this.cartItems = [];
    this.calculateTotals();
    this.showNotification('Commande annulée', 'success');
  }
  
  
  /**
   * Imprime la commande actuelle
   */
  printOrder(): void {
    if (this.cartItems.length === 0) {
      this.showNotification('Veuillez ajouter des produits au panier', 'warning');
      return;
    }
    
    // Préparer les données pour l'impression
    const orderData = {
      orderNumber: this.activeSession ? this.activeSession.id : 'TEMP-' + new Date().getTime(),
      date: new Date(),
      items: this.cartItems,
      subtotal: this.subtotal,
      tax: this.taxTotal,
      discount: this.discount,
      total: this.total,
      cashier: this.currentUser?.username || 'Utilisateur'
    };
    
    // Créer une fenêtre d'impression
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.showNotification('Impossible d\'ouvrir la fenêtre d\'impression. Vérifiez les paramètres de votre navigateur.', 'error');
      return;
    }
    
    // Générer le contenu HTML pour l'impression
    printWindow.document.write(`
      <html>
        <head>
          <title>Bon de commande - ${orderData.orderNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .header { text-align: center; margin-bottom: 20px; }
            .company-name { font-size: 24px; font-weight: bold; }
            .order-info { margin-bottom: 20px; }
            .order-number { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f2f2f2; }
            .totals { margin-top: 20px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .grand-total { font-weight: bold; font-size: 18px; margin-top: 10px; }
            .footer { text-align: center; margin-top: 30px; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">DreamsPOS</div>
            <div>Système de point de vente</div>
          </div>
          
          <div class="order-info">
            <div class="order-number">Commande N° ${orderData.orderNumber}</div>
            <div>Date: ${orderData.date.toLocaleString()}</div>
            <div>Caissier: ${orderData.cashier}</div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Qté</th>
                <th>Prix unitaire</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${orderData.items.map(item => `
                <tr>
                  <td>${item.productName}</td>
                  <td>${item.quantity}</td>
                  <td>${item.unitPrice.toFixed(2)} €</td>
                  <td>${item.totalPrice.toFixed(2)} €</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals">
            <div class="total-row">
              <span>Sous-total:</span>
              <span>${orderData.subtotal.toFixed(2)} €</span>
            </div>
            <div class="total-row">
              <span>TVA (20%):</span>
              <span>${orderData.tax.toFixed(2)} €</span>
            </div>
            <div class="total-row">
              <span>Remise:</span>
              <span>${orderData.discount.toFixed(2)} €</span>
            </div>
            <div class="total-row grand-total">
              <span>Total:</span>
              <span>${orderData.total.toFixed(2)} €</span>
            </div>
          </div>
          
          <div class="footer">
            <p>Merci pour votre achat!</p>
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
      // Fermer la fenêtre après l'impression (optionnel)
      // printWindow.close();
    }, 500);
    
    this.showNotification('Bon de commande envoyé à l\'impression', 'success');
  }

  /**
   * Ouvre la boîte de dialogue pour ouvrir la caisse
   */
  openRegisterDialog(): void {
    const dialogRef = this.dialog.open(OpenRegisterDialogComponent, {
      width: '500px',
      disableClose: true,
      data: { registerNumber: 'REG-001' }
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const { registerNumber, startingAmount, notes } = result;
        this.openRegister(registerNumber, startingAmount, notes);
      }
    });
  }

  /**
   * Ouvre la caisse
   */
  openRegister(registerNumber: string, startingAmount: number, notes?: string): void {
    this.caisseService.openCashRegisterSession(registerNumber, startingAmount, notes).subscribe({
      next: (session) => {
        this.activeSession = session;
        this.isRegisterOpen = true;
        this.showNotification('Caisse ouverte avec succès', 'success');
        this.loadProducts();
      },
      error: (error) => {
        console.error('Erreur lors de l\'ouverture de la caisse:', error);
        this.showNotification('Erreur lors de l\'ouverture de la caisse', 'error');
      }
    });
  }

  /**
   * Ferme la caisse
   */
  closeRegisterDialog(): void {
    if (!this.activeSession) {
      return;
    }
    
    const dialogRef = this.dialog.open(CloseRegisterDialogComponent, {
      width: '500px',
      disableClose: true,
      data: {
        sessionId: this.activeSession.id,
        startingAmount: this.activeSession.startingAmount,
        expectedAmount: this.activeSession.startingAmount + this.total // Simplification, devrait être calculé plus précisément
      }
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const { countedAmount, notes, difference } = result;
        this.closeRegister(countedAmount, notes, difference);
      }
    });
  }

  /**
   * Ferme la caisse
   */
  closeRegister(countedAmount: number, notes: string = '', difference: number = 0): void {
    if (!this.activeSession || !this.activeSession.id) {
      this.showNotification('Aucune session de caisse active', 'error');
      return;
    }
    
    this.caisseService.closeCashRegisterSession(this.activeSession.id, countedAmount, notes, difference).subscribe({
      next: (closedSession) => {
        this.activeSession = null;
        this.isRegisterOpen = false;
        this.showNotification('Caisse fermée avec succès', 'success');
        this.cartItems = [];
        this.calculateTotals();
      },
      error: (error) => {
        console.error('Erreur lors de la fermeture de la caisse:', error);
        this.showNotification('Erreur lors de la fermeture de la caisse', 'error');
      }
    });
  }

  /**
   * Affiche un produit en détail avec possibilité d'ajouter au panier
   */
  showProductDetails(product: any): void {
    const dialogRef = this.dialog.open(ProductDetailsDialogComponent, {
      width: '600px',
      data: { product }
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result && result.quantity) {
        this.addToCart(product, result.quantity);
      }
    });
  }

  /**
   * Affiche une notification
   */
  showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning', duration: number = 3000): void {
    const classes = {
      success: 'snackbar-success',
      error: 'snackbar-error',
      info: 'snackbar-info',
      warning: 'snackbar-warning'
    };
    
    this.snackBar.open(message, 'Fermer', {
      duration: duration,
      panelClass: [classes[type]]
    });
  }
  
  /**
   * Génère une image pour un produit
   * @param product Le produit pour lequel générer une image
   * @returns URL de l'image (SVG en base64)
   */
  getProductImage(product: any): string {
    // Si le produit a déjà une URL d'image, l'utiliser
    if (product.imageUrl && product.imageUrl.length > 0) {
      // Si c'est une URL relative, ajouter le chemin de base
      if (!product.imageUrl.startsWith('http') && !product.imageUrl.startsWith('data:') && !product.imageUrl.startsWith('/assets/')) {
        return '/assets/images/products/' + product.imageUrl;
      }
      return product.imageUrl;
    }
    
    // Générer une image SVG avec le nom du produit
    return this.generateSVGPlaceholder(product.name || 'Produit');
  }
  
  /**
   * Génère une image SVG en base64 avec le texte spécifié
   * @param text Texte à afficher dans l'image
   * @param bgColor Couleur de fond (par défaut: #eee)
   * @returns URL de données de l'image SVG en base64
   */
  private generateSVGPlaceholder(text: string, bgColor: string = '#eee'): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="${bgColor}"/><text x="50%" y="50%" font-size="18" text-anchor="middle" alignment-baseline="middle" font-family="monospace, sans-serif" fill="#333">${text}</text></svg>`;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
  }
}
