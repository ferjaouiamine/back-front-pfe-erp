import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { CaisseService } from '../../services/caisse.service';
import { 
  CartItem, 
  SaleTransaction, 
  PaymentMethod, 
  TransactionStatus,
  CashRegisterSession
} from '../../models/pos.models';
import { ProductDetailsDialogComponent } from '../product-details-dialog/product-details-dialog.component';

@Component({
  selector: 'app-pos',
  templateUrl: './pos.component.html',
  styleUrls: ['./pos.component.scss']
})
export class PosComponent implements OnInit, OnDestroy {
  // État de la caisse
  activeSession: CashRegisterSession | null = null;
  isRegisterOpen = false;
  
  // Panier
  cartItems: CartItem[] = [];
  subtotal = 0;
  taxTotal = 0;
  total = 0;
  
  // Recherche de produits
  searchForm: FormGroup;
  searchResults: any[] = [];
  isSearching = false;
  
  // Paiement
  paymentForm: FormGroup;
  paymentMethods = Object.values(PaymentMethod);
  changeAmount = 0;
  
  // État de l'interface
  isProcessingPayment = false;
  backendAvailable = true;
  
  // Gestion des souscriptions
  private destroy$ = new Subject<void>();
  
  constructor(
    private caisseService: CaisseService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    // Initialisation des formulaires
    this.searchForm = this.fb.group({
      query: ['', Validators.required]
    });
    
    this.paymentForm = this.fb.group({
      paymentMethod: [PaymentMethod.CASH, Validators.required],
      amountTendered: [0, [Validators.required, Validators.min(0)]],
      customerInfo: this.fb.group({
        name: [''],
        email: [''],
        phone: ['']
      }),
      notes: ['']
    });
  }
  
  ngOnInit(): void {
    // Vérifier s'il y a une session active
    this.checkActiveSession();
    
    // Observer les changements dans le champ de recherche
    this.searchForm.get('query')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      if (query && query.length > 2) {
        this.searchProducts(query);
      } else {
        this.searchResults = [];
      }
    });
    
    // Observer les changements dans le montant payé
    this.paymentForm.get('amountTendered')?.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(amount => {
      this.calculateChange(amount);
    });
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  /**
   * Vérifie s'il y a une session de caisse active
   */
  checkActiveSession(): void {
    this.caisseService.getActiveSession('REG-001').pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (session) => {
        this.activeSession = session;
        this.isRegisterOpen = !!session;
        this.backendAvailable = this.caisseService.isBackendAvailable();
        
        if (!this.backendAvailable) {
          this.showNotification('Mode hors ligne activé. Les données sont simulées.', 'info');
        }
      },
      error: (error) => {
        console.error('Erreur lors de la vérification de la session active:', error);
        this.showNotification('Impossible de vérifier la session de caisse.', 'error');
      }
    });
  }
  
  /**
   * Ouvre une nouvelle session de caisse
   */
  openRegister(startingAmount: number): void {
    this.caisseService.openCashRegisterSession('REG-001', startingAmount).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (session) => {
        this.activeSession = session;
        this.isRegisterOpen = true;
        this.backendAvailable = this.caisseService.isBackendAvailable();
        this.showNotification('Session de caisse ouverte avec succès', 'success');
      },
      error: (error) => {
        console.error('Erreur lors de l\'ouverture de la session:', error);
        this.showNotification('Impossible d\'ouvrir la session de caisse.', 'error');
      }
    });
  }
  
  /**
   * Ferme la session de caisse active
   */
  closeRegister(endingAmount: number): void {
    if (!this.activeSession) {
      this.showNotification('Aucune session active à fermer.', 'warning');
      return;
    }
    
    this.caisseService.closeCashRegisterSession(this.activeSession.id!, endingAmount).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (session) => {
        this.activeSession = null;
        this.isRegisterOpen = false;
        this.showNotification('Session de caisse fermée avec succès', 'success');
        
        // Rediriger vers le rapport de clôture ou l'afficher dans un dialogue
        this.generateSessionReport(session.id!);
      },
      error: (error) => {
        console.error('Erreur lors de la fermeture de la session:', error);
        this.showNotification('Impossible de fermer la session de caisse.', 'error');
      }
    });
  }
  
  /**
   * Génère un rapport pour la session fermée
   */
  generateSessionReport(sessionId: string): void {
    this.caisseService.generateSessionReport(sessionId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (report) => {
        // Afficher le rapport dans un dialogue ou rediriger vers une page de rapport
        console.log('Rapport de session généré:', report);
      },
      error: (error) => {
        console.error('Erreur lors de la génération du rapport:', error);
        this.showNotification('Impossible de générer le rapport de session.', 'error');
      }
    });
  }
  
  /**
   * Recherche des produits par code-barres ou nom
   */
  searchProducts(query: string): void {
    this.isSearching = true;
    
    this.caisseService.searchProduct(query).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (results: any[]) => {
        this.searchResults = results;
        this.isSearching = false;
        this.backendAvailable = this.caisseService.isBackendAvailable();
        
        if (results.length === 0) {
          this.showNotification('Aucun produit trouvé', 'info');
        }
      },
      error: (error: any) => {
        console.error('Erreur lors de la recherche de produits:', error);
        this.isSearching = false;
        this.searchResults = [];
        this.showNotification('Impossible de rechercher des produits.', 'error');
      }
    });
  }
  
  /**
   * Affiche les détails d'un produit dans une boîte de dialogue
   */
  showProductDetails(product: any): void {
    const dialogRef = this.dialog.open(ProductDetailsDialogComponent, {
      width: '500px',
      data: { product: product }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Si l'utilisateur a cliqué sur "Ajouter au panier" dans la boîte de dialogue
        this.addToCart(product, result.quantity || 1);
      }
    });
  }
  
  /**
   * Ajoute un produit au panier
   */
  addToCart(product: any, quantity: number = 1): void {
    // Vérifier si le produit est déjà dans le panier
    const existingItem = this.cartItems.find(item => item.productId === product.id);
    
    if (existingItem) {
      // Mettre à jour la quantité
      existingItem.quantity += quantity;
      existingItem.totalPrice = existingItem.quantity * existingItem.unitPrice;
    } else {
      // Ajouter un nouvel élément
      const newItem: CartItem = {
        productId: product.id,
        productName: product.name,
        barcode: product.barcode,
        quantity: quantity,
        unitPrice: product.price,
        totalPrice: product.price * quantity,
        taxRate: 0.2 // TVA à 20%
      };
      
      this.cartItems.push(newItem);
    }
    
    // Recalculer les totaux
    this.calculateTotals();
    
    // Effacer les résultats de recherche
    this.searchForm.get('query')?.setValue('');
    this.searchResults = [];
    
    this.showNotification(`${product.name} ajouté au panier`, 'success');
  }
  
  /**
   * Supprime un produit du panier
   */
  removeFromCart(index: number): void {
    if (index >= 0 && index < this.cartItems.length) {
      const item = this.cartItems[index];
      this.cartItems.splice(index, 1);
      this.calculateTotals();
      this.showNotification(`${item.productName} retiré du panier`, 'info');
    }
  }
  
  /**
   * Met à jour la quantité d'un produit dans le panier
   */
  updateQuantity(index: number, quantity: number): void {
    if (index >= 0 && index < this.cartItems.length) {
      if (quantity <= 0) {
        this.removeFromCart(index);
        return;
      }
      
      const item = this.cartItems[index];
      item.quantity = quantity;
      item.totalPrice = item.quantity * item.unitPrice;
      this.calculateTotals();
    }
  }
  
  /**
   * Calcule les totaux du panier
   */
  calculateTotals(): void {
    this.subtotal = this.cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
    this.taxTotal = this.cartItems.reduce((sum, item) => {
      const taxRate = item.taxRate || 0.2; // TVA par défaut à 20%
      return sum + (item.totalPrice * taxRate);
    }, 0);
    this.total = this.subtotal + this.taxTotal;
    
    // Mettre à jour le montant minimum requis pour le paiement
    this.paymentForm.get('amountTendered')?.setValidators([
      Validators.required,
      Validators.min(this.total)
    ]);
    this.paymentForm.get('amountTendered')?.updateValueAndValidity();
  }
  
  /**
   * Calcule la monnaie à rendre
   */
  calculateChange(amountTendered: number): void {
    this.changeAmount = amountTendered - this.total;
  }
  
  /**
   * Vide le panier
   */
  clearCart(): void {
    this.cartItems = [];
    this.calculateTotals();
    this.showNotification('Panier vidé', 'info');
  }
  
  /**
   * Finalise la transaction
   */
  processPayment(): void {
    if (!this.activeSession) {
      this.showNotification('Aucune session de caisse active.', 'error');
      return;
    }
    
    if (this.cartItems.length === 0) {
      this.showNotification('Le panier est vide.', 'warning');
      return;
    }
    
    if (this.paymentForm.invalid) {
      this.showNotification('Veuillez compléter correctement les informations de paiement.', 'warning');
      return;
    }
    
    this.isProcessingPayment = true;
    
    const formValue = this.paymentForm.value;
    
    // Récupérer les informations du caissier connecté directement via l'injection de dépendance
    // au lieu d'utiliser caisseService.authService qui est privé
    const authService = this.caisseService.getAuthService();
    const currentUser = authService.getCurrentUser();
    
    const transaction: SaleTransaction = {
      id: '', // Sera généré par le backend
      transactionNumber: `TX-${Date.now()}`, // Génération d'un numéro de transaction temporaire
      registerNumber: this.activeSession.registerNumber || '',
      items: [...this.cartItems],
      subtotal: this.subtotal,
      taxTotal: this.taxTotal,
      total: this.total,
      paymentMethod: formValue.paymentMethod,
      paymentAmount: formValue.amountTendered,
      changeAmount: this.changeAmount,
      status: TransactionStatus.COMPLETED,
      date: new Date(),
      cashierId: currentUser?.id || 'unknown',
      cashierName: currentUser?.username || 'Caissier',
      customerInfo: formValue.customerInfo,
      notes: formValue.notes || ''
    };
    
    this.caisseService.createTransaction(transaction).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result) => {
        this.isProcessingPayment = false;
        this.backendAvailable = this.caisseService.isBackendAvailable();
        this.showNotification('Transaction complétée avec succès', 'success');
        
        // Réinitialiser le panier et le formulaire de paiement
        this.cartItems = [];
        this.calculateTotals();
        this.paymentForm.reset({
          paymentMethod: PaymentMethod.CASH,
          amountTendered: 0,
          customerInfo: {
            name: '',
            email: '',
            phone: ''
          },
          notes: ''
        });
        
        // Imprimer le ticket
        this.printReceipt(result);
      },
      error: (error) => {
        console.error('Erreur lors du traitement du paiement:', error);
        this.isProcessingPayment = false;
        this.showNotification('Impossible de finaliser la transaction.', 'error');
      }
    });
  }
  
  /**
   * Imprime le ticket de caisse
   */
  printReceipt(transaction: SaleTransaction): void {
    // Logique d'impression du ticket
    console.log('Impression du ticket pour la transaction:', transaction);
    
    // Ouvrir une fenêtre d'impression
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Ticket de caisse</title>
            <style>
              body { font-family: 'Courier New', monospace; font-size: 12px; }
              .header { text-align: center; margin-bottom: 10px; }
              .items { width: 100%; border-top: 1px dashed #000; border-bottom: 1px dashed #000; }
              .item { display: flex; justify-content: space-between; margin: 5px 0; }
              .totals { margin-top: 10px; }
              .total-line { display: flex; justify-content: space-between; }
              .payment { margin-top: 10px; }
              .footer { text-align: center; margin-top: 20px; font-size: 10px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>VOTRE ENTREPRISE</h2>
              <p>123 Rue du Commerce, 75000 Paris</p>
              <p>Tel: 01 23 45 67 89</p>
              <p>Transaction #${transaction.transactionNumber}</p>
              <p>Date: ${transaction.date.toLocaleString()}</p>
              <p>Caissier: ${transaction.cashierName}</p>
            </div>
            
            <div class="items">
              ${transaction.items.map(item => `
                <div class="item">
                  <span>${item.quantity} x ${item.productName}</span>
                  <span>${item.totalPrice.toFixed(2)} €</span>
                </div>
              `).join('')}
            </div>
            
            <div class="totals">
              <div class="total-line">
                <span>Sous-total:</span>
                <span>${transaction.subtotal.toFixed(2)} €</span>
              </div>
              <div class="total-line">
                <span>TVA:</span>
                <span>${transaction.taxTotal.toFixed(2)} €</span>
              </div>
              <div class="total-line" style="font-weight: bold;">
                <span>TOTAL:</span>
                <span>${transaction.total.toFixed(2)} €</span>
              </div>
            </div>
            
            <div class="payment">
              <div class="total-line">
                <span>Paiement (${transaction.paymentMethod}):</span>
                <span>${transaction.paymentAmount.toFixed(2)} €</span>
              </div>
              <div class="total-line">
                <span>Monnaie rendue:</span>
                <span>${transaction.changeAmount.toFixed(2)} €</span>
              </div>
            </div>
            
            <div class="footer">
              <p>Merci de votre visite!</p>
              <p>TVA: FR 12 345 678 901</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  }
  
  /**
   * Affiche une notification
   */
  showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning'): void {
    const classes = {
      success: 'snackbar-success',
      error: 'snackbar-error',
      info: 'snackbar-info',
      warning: 'snackbar-warning'
    };
    
    this.snackBar.open(message, 'Fermer', {
      duration: 5000,
      panelClass: classes[type]
    });
  }

  /**
   * Imprime le dernier ticket de caisse
   */
  printLastReceipt(): void {
    if (!this.activeSession) {
      this.showNotification('Aucune session de caisse active.', 'error');
      return;
    }

    // Utiliser l'ID de la session active pour récupérer les transactions
    const sessionId = this.activeSession.id || '';
    this.caisseService.getTransactionsBySession(sessionId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (transactions) => {
        if (transactions && transactions.length > 0) {
          // Trier par date décroissante et prendre la première
          const lastTransaction = transactions.sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          this.printReceipt(lastTransaction);
        } else {
          this.showNotification('Aucune transaction trouvée pour cette session.', 'warning');
        }
      },
      error: (error) => {
        console.error('Erreur lors de la récupération des transactions:', error);
        this.showNotification('Impossible de récupérer le dernier ticket.', 'error');
      }
    });
  }

  /**
   * Affiche l'historique des transactions
   */
  viewTransactions(): void {
    if (!this.activeSession) {
      this.showNotification('Aucune session de caisse active.', 'error');
      return;
    }

    // Cette méthode pourrait ouvrir une boîte de dialogue avec l'historique des transactions
    // Pour l'instant, nous affichons simplement une notification
    this.showNotification('Fonctionnalité d\'historique des transactions à implémenter.', 'info');
    
    // Exemple de code pour récupérer les transactions
    /*
    this.caisseService.getTransactionsBySession(this.activeSession.id || '').pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (transactions) => {
        // Ouvrir une boîte de dialogue avec les transactions
      },
      error: (error) => {
        console.error('Erreur lors de la récupération des transactions:', error);
        this.showNotification('Impossible de récupérer l\'historique des transactions.', 'error');
      }
    });
    */
  }

  /**
   * Ouvre le tiroir-caisse
   */
  openCashDrawer(): void {
    if (!this.activeSession) {
      this.showNotification('Aucune session de caisse active.', 'error');
      return;
    }

    // Cette méthode pourrait envoyer une commande à l'imprimante pour ouvrir le tiroir-caisse
    // Pour l'instant, nous affichons simplement une notification
    this.showNotification('Commande d\'ouverture du tiroir-caisse envoyée.', 'success');
  }

  /**
   * Annule la dernière transaction
   */
  voidLastTransaction(): void {
    if (!this.activeSession) {
      this.showNotification('Aucune session de caisse active.', 'error');
      return;
    }

    // Utiliser l'ID de la session active pour récupérer les transactions
    const sessionId = this.activeSession.id || '';
    this.caisseService.getTransactionsBySession(sessionId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (transactions) => {
        if (transactions && transactions.length > 0) {
          // Trier par date décroissante et prendre la première
          const lastTransaction = transactions.sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          
          // Marquer la transaction comme annulée
          lastTransaction.status = TransactionStatus.VOIDED;
          
          this.caisseService.updateTransaction(lastTransaction).pipe(
            takeUntil(this.destroy$)
          ).subscribe({
            next: () => {
              this.showNotification('La dernière transaction a été annulée avec succès.', 'success');
            },
            error: (error) => {
              console.error('Erreur lors de l\'annulation de la transaction:', error);
              this.showNotification('Impossible d\'annuler la transaction.', 'error');
            }
          });
        } else {
          this.showNotification('Aucune transaction trouvée pour cette session.', 'warning');
        }
      },
      error: (error) => {
        console.error('Erreur lors de la récupération des transactions:', error);
        this.showNotification('Impossible de récupérer les transactions.', 'error');
      }
    });
  }

  /**
   * Ouvre le dialogue de fermeture de caisse
   */
  openCloseRegisterDialog(templateRef: any): void {
    this.dialog.open(templateRef, {
      width: '400px',
      disableClose: true
    });
  }

  /**
   * Ferme le dialogue actif
   */
  closeDialog(): void {
    this.dialog.closeAll();
  }
}
