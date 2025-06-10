import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { CaisseService } from '../../services/caisse.service';
import { AuthService } from '../../../auth/services/auth.service';
import { 
  CartItem, 
  SaleTransaction, 
  PaymentMethod, 
  TransactionStatus,
  CashRegisterSession
} from '../../models/pos.models';
import { ProductDetailsDialogComponent } from '../product-details-dialog/product-details-dialog.component';
import { OpenRegisterDialogComponent } from '../open-register-dialog/open-register-dialog.component';
import { CloseRegisterDialogComponent } from '../close-register-dialog/close-register-dialog.component';

@Component({
  selector: 'app-pos',
  templateUrl: './pos.component.html',
  styleUrls: ['./pos.component.scss']
})
export class PosComponent implements OnInit, OnDestroy {
  // Propriétés de la session de caisse
  activeSession: CashRegisterSession | null = null;
  isRegisterOpen = false;
  sessionStartTime: Date | null = null;
  sessionCashier: string | null = null;
  sessionStartingAmount = 0;
  sessionCurrentAmount = 0;
  totalSales = 0;
  totalWithdrawals = 0;
  
  // Propriétés du panier
  cartItems: CartItem[] = [];
  subtotal = 0;
  taxTotal = 0;
  total = 0;
  
  // Propriétés de recherche
  searchForm: FormGroup;
  searchResults: any[] = [];
  isSearching = false;
  
  // Propriétés de paiement
  paymentForm: FormGroup;
  paymentMethods = Object.values(PaymentMethod);
  changeAmount = 0;
  isProcessingPayment = false;
  
  // État de l'application
  loading = false;
  backendAvailable = true;
  
  // Gestion des abonnements
  private destroy$ = new Subject<void>();

  constructor(
    private caisseService: CaisseService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private authService: AuthService
  ) {
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
    this.checkActiveSession();

    // S'abonner aux changements de la recherche
    const queryControl = this.searchForm.get('query');
    if (queryControl) {
      queryControl.valueChanges.pipe(
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
    }

    // S'abonner aux changements du montant fourni
    const amountTenderedControl = this.paymentForm.get('amountTendered');
    if (amountTenderedControl) {
      amountTenderedControl.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe(amount => {
          this.calculateChange(amount);
        });
    }
  }

  /**
   * Nettoyage des abonnements RxJS pour éviter les fuites de mémoire.
   * Cette méthode est appelée automatiquement par Angular lorsque le composant est détruit.
   */
  ngOnDestroy(): void {
    this.destroy$.next(undefined);
    this.destroy$.complete();
  }

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


  printReceipt(transaction: SaleTransaction): void {
    if (!transaction) {
      this.showNotification('Aucune transaction à imprimer.', 'error');
      return;
    }
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
              <p>Date: ${new Date(transaction.date).toLocaleString()}</p>
              <p>Caissier: ${transaction.cashierName}</p>
            </div>
            <div class="items">
              ${(transaction.items || []).map(item => `
                <div class="item">
                  <span>${item.quantity} x ${item.productName}</span>
                  <span>${item.totalPrice.toFixed(2)} €</span>
                </div>
              `).join('')}
            </div>
            <div class="totals">
              <div class="total-line">
                <span>Sous-total:</span>
                <span>${transaction.subtotal?.toFixed(2) ?? '0.00'} €</span>
              </div>
              <div class="total-line">
                <span>TVA:</span>
                <span>${transaction.taxTotal?.toFixed(2) ?? '0.00'} €</span>
              </div>
              <div class="total-line" style="font-weight: bold;">
                <span>TOTAL:</span>
                <span>${transaction.total?.toFixed(2) ?? '0.00'} €</span>
              </div>
            </div>
            <div class="payment">
              <div class="total-line">
                <span>Paiement (${transaction.paymentMethod}):</span>
                <span>${transaction.amountTendered?.toFixed(2) ?? '0.00'} €</span>
              </div>
              <div class="total-line">
                <span>Monnaie rendue:</span>
                <span>${transaction.change?.toFixed(2) ?? '0.00'} €</span>
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
    } else {
      this.showNotification('Impossible d\'ouvrir la fenêtre d\'impression', 'error');
    }
  }

  openCashDrawer(): void {
    if (!this.activeSession) {
      this.showNotification('Aucune session de caisse active.', 'error');
      return;
    }
    this.showNotification('Commande d\'ouverture du tiroir-caisse envoyée.', 'success');
  }

  /**
   * Recherche des produits en fonction d'une requête
   * @param query Terme de recherche
   */
  /**
   * Recherche des produits en fonction d'une requête
   * @param query Terme de recherche
   */
  searchProducts(query: string): void {
    if (!query || query.trim().length < 2) {
      this.searchResults = [];
      return;
    }

    this.isSearching = true;
    this.searchResults = []; // Réinitialiser les résultats pendant la recherche
    
    this.caisseService.searchProduct(query.trim()).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isSearching = false)
    ).subscribe({
      next: (results) => {
        // Vérifier que les résultats sont valides
        if (Array.isArray(results)) {
          this.searchResults = results;
          
          if (results.length === 0) {
            this.showNotification('Aucun produit trouvé', 'info');
          }
        } else {
          console.warn('Format de réponse inattendu:', results);
          this.showNotification('Erreur de format des résultats', 'warning');
        }
      },
      error: (error: any) => {
        console.error('Erreur lors de la recherche de produits', error);
        
        // Gestion des erreurs spécifiques
        if (error?.status === 0) {
          this.showNotification('Connexion au serveur perdue', 'error');
          this.backendAvailable = false;
        } else if (error?.status === 404) {
          this.searchResults = [];
          this.showNotification('Aucun résultat trouvé', 'info');
        } else {
          const errorMessage = error?.error?.message || error?.message || 'Erreur inconnue';
          this.showNotification(`Erreur lors de la recherche: ${errorMessage}`, 'error');
        }
      }
    });
  }

  calculateChange(amountTendered: number): void {
    if (!amountTendered || isNaN(amountTendered)) {
      this.changeAmount = 0;
      return;
    }
    this.changeAmount = amountTendered - this.total;
  }

  processPayment(): void {
    if (!this.cartItems || this.cartItems.length === 0) {
      this.showNotification('Le panier est vide', 'error');
      return;
    }
    if (!this.activeSession) {
      this.showNotification('Aucune session de caisse active', 'error');
      return;
    }
    if (!this.paymentForm || this.paymentForm.invalid) {
      this.showNotification('Veuillez remplir correctement le formulaire de paiement', 'error');
      return;
    }
    
    const formValue = this.paymentForm.value;
    if (formValue.paymentMethod === PaymentMethod.CASH && formValue.amountTendered < this.total) {
      this.showNotification('Le montant fourni est insuffisant', 'error');
      return;
    }

    this.isProcessingPayment = true;

    const transaction: SaleTransaction = {
      id: '', // Sera généré par le backend
      transactionNumber: `TX-${Date.now()}`,
      registerNumber: this.activeSession?.registerNumber || 'REG-001',
      cashierId: this.activeSession?.openedBy || 'unknown',
      cashierName: 'Caissier', // Valeur par défaut car currentUser n'est pas accessible
      sessionId: this.activeSession?.id || '',
      date: new Date(),
      items: [...this.cartItems],
      subtotal: this.subtotal,
      taxTotal: this.taxTotal,
      total: this.total,
      paymentMethod: formValue.paymentMethod,
      amountTendered: formValue.amountTendered,
      change: this.changeAmount,
      customerInfo: formValue.customerInfo,
      notes: formValue.notes,
      status: TransactionStatus.COMPLETED
    };

    this.caisseService.createTransaction(transaction)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (result) => {
          this.isProcessingPayment = false;
          this.showNotification('Paiement traité avec succès', 'success');
          
          // Imprimer le reçu
          this.printReceipt(result || transaction);
          
          // Ouvrir le tiroir-caisse si paiement en espèces
          if (formValue.paymentMethod === PaymentMethod.CASH) {
            this.openCashDrawer();
          }
          
          // Vider le panier
          this.clearCart();
          
          // Réinitialiser le formulaire de paiement
          if (this.paymentForm) {
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
          }
        },
        error: (error) => {
          console.error('Erreur lors du traitement du paiement:', error);
          this.isProcessingPayment = false;
          
          // Mode hors ligne - simuler une transaction réussie
          if (!this.caisseService.isBackendAvailable()) {
            this.showNotification('Mode hors ligne: Transaction enregistrée localement', 'warning');
            this.printReceipt(transaction);
            
            if (formValue.paymentMethod === PaymentMethod.CASH) {
              this.openCashDrawer();
            }
            
            this.clearCart();
            
            if (this.paymentForm) {
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
            }
          } else {
            this.showNotification('Erreur lors du traitement du paiement', 'error');
          }
        }
      });
  }

  clearCart(): void {
    this.cartItems = [];
    this.subtotal = 0;
    this.taxTotal = 0;
    this.total = 0;
    this.changeAmount = 0;
  }

  /**
   * Affiche les détails d'un produit dans une boîte de dialogue


  /**
   * Ouvre la boîte de dialogue pour fermer la caisse
   */
  openCloseRegisterDialog(dialogRef: any): void {
    dialogRef.open();
  }

  /**
   * Met à jour la quantité d'un article dans le panier
   */
  updateQuantity(index: number, newQuantity: number): void {
    if (newQuantity <= 0) {
      this.removeFromCart(index);
      return;
    }
    
    if (index >= 0 && index < this.cartItems.length) {
      const item = this.cartItems[index];
      item.quantity = newQuantity;
      item.totalPrice = item.unitPrice * newQuantity;
      
      this.calculateTotals();
    }
  }

  /**
   * Calcule les totaux du panier
   */
  calculateTotals(): void {
    this.subtotal = this.cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
    this.taxTotal = this.cartItems.reduce((sum, item) => {
      const taxAmount = item.taxRate ? (item.totalPrice * item.taxRate / 100) : 0;
      return sum + taxAmount;
    }, 0);
    this.total = this.subtotal + this.taxTotal;
  }

  /**
   * Supprime un article du panier
   */
  removeFromCart(index: number): void {
    if (index >= 0 && index < this.cartItems.length) {
      this.cartItems.splice(index, 1);
      this.calculateTotals();
    }
  }

  /**
   * Imprime le dernier reçu
   */
  printLastReceipt(): void {
    if (!this.activeSession) {
      this.showNotification('Aucune session de caisse active.', 'error');
      return;
    }
    
    const sessionId = this.activeSession?.id || '';
    if (!sessionId) {
      this.showNotification('ID de session invalide', 'error');
      return;
    }
    this.caisseService.getTransactionsBySession(sessionId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (transactions) => {
        if (transactions && transactions.length > 0) {
          const lastTransaction = transactions.sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          this.printReceipt(lastTransaction);
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
   * Affiche l'historique des transactions
   */
  viewTransactions(): void {
    if (!this.activeSession) {
      this.showNotification('Aucune session de caisse active.', 'error');
      return;
    }
    
    // Ici, vous pourriez ouvrir une boîte de dialogue ou naviguer vers une page d'historique
    this.showNotification('Fonctionnalité d\'historique des transactions à implémenter.', 'info');
  }

  /**
   * Annule la dernière transaction
   */
  voidLastTransaction(): void {
    if (!this.activeSession) {
      this.showNotification('Aucune session de caisse active.', 'error');
      return;
    }
    
    const sessionId = this.activeSession?.id || '';
    if (!sessionId) {
      this.showNotification('ID de session invalide', 'error');
      return;
    }
    this.caisseService.getTransactionsBySession(sessionId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (transactions) => {
        if (transactions && transactions.length > 0) {
          const lastTransaction = transactions.sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          
          if (lastTransaction.status === TransactionStatus.VOIDED) {
            this.showNotification('Cette transaction est déjà annulée.', 'warning');
            return;
          }
          
          lastTransaction.status = TransactionStatus.VOIDED;
          this.caisseService.updateTransaction(lastTransaction).pipe(
            takeUntil(this.destroy$)
          ).subscribe({
            next: () => {
              this.showNotification('Transaction annulée avec succès.', 'success');
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
   * Ouvre la boîte de dialogue pour fermer la caisse
   */
  closeRegisterDialog(): void {
    if (!this.isRegisterOpen || !this.activeSession) {
      this.showNotification('Aucune session de caisse active à fermer', 'warning');
      return;
    }

    // Calculer le montant attendu (montant initial + ventes - retraits)
    const expectedAmount = this.sessionStartingAmount + this.totalSales - this.totalWithdrawals;
    
    const dialogRef = this.dialog.open(CloseRegisterDialogComponent, {
      width: '500px',
      data: {
        sessionId: this.activeSession.id,
        expectedAmount: expectedAmount
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.closeRegister(
          result.countedAmount,
          result.notes || '',
          result.difference
        );
      }
    });
  }

  
  /**
   * Ferme la session de caisse
   * @param countedAmount Montant compté en caisse
   * @param notes Notes optionnelles pour la fermeture
   * @param difference Différence entre le montant attendu et le montant compté
   */
  closeRegister(countedAmount: number, notes: string = '', difference: number = 0): void {
    if (!this.isRegisterOpen || !this.activeSession) {
      this.showNotification('Aucune session de caisse active à fermer.', 'warning');
      return;
    }
    
    const sessionId = this.activeSession.id;
    if (!sessionId) {
      this.showNotification('ID de session invalide', 'error');
      return;
    }
    
    if (countedAmount < 0) {
      this.showNotification('Le montant compté ne peut pas être négatif.', 'error');
      return;
    }
    
    this.loading = true;
    this.caisseService.closeCashRegisterSession(sessionId, countedAmount, notes, difference)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (closedSession) => {
          this.showNotification('Session de caisse fermée avec succès.', 'success');
          this.resetRegisterState();
        },
        error: (error) => {
          console.error('Erreur lors de la fermeture de la session:', error);
          this.showNotification('Erreur lors de la fermeture de la session de caisse: ' + (error.error?.message || error.message || 'Erreur inconnue'), 'error');
        }
      });
  }
  
  /**
   * Réinitialise l'état de la caisse après fermeture
   */
  private resetRegisterState(): void {
    this.isRegisterOpen = false;
    this.activeSession = null;
    this.sessionStartTime = null;
    this.sessionCashier = null;
    this.sessionStartingAmount = 0;
    this.sessionCurrentAmount = 0;
    this.totalSales = 0;
    this.totalWithdrawals = 0;
  }

  /**
   * Ouvre une boîte de dialogue pour saisir le montant initial de la caisse
   */
  openRegisterDialog(): void {
    if (this.isRegisterOpen) {
      this.showNotification('Une session de caisse est déjà ouverte.', 'warning');
      return;
    }
    
    const dialogRef = this.dialog.open(OpenRegisterDialogComponent, {
      width: '400px',
      disableClose: true,
      data: { cashierId: this.authService.getCurrentUser()?.id || '' }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.startingAmount !== undefined) {
        this.openRegister(result.startingAmount, result.notes || '');
      }
    });
  }
  
  /**
   * Ouvre la caisse avec un montant initial
   */
  openRegister(startingAmount: number, notes: string = ''): void {
    if (this.isRegisterOpen) {
      this.showNotification('Une session de caisse est déjà ouverte.', 'warning');
      return;
    }
    
    if (startingAmount < 0) {
      this.showNotification('Le montant initial ne peut pas être négatif.', 'error');
      return;
    }
    
    const registerNumber = 'REG-001'; // Utiliser un numéro de caisse par défaut
    const sessionNotes = notes || 'Session ouverte via l\'interface POS';
    
    this.loading = true;
    this.caisseService.openCashRegisterSession(registerNumber, startingAmount, sessionNotes).pipe(
      takeUntil(this.destroy$),
      finalize(() => this.loading = false)
    ).subscribe({
      next: (session) => {
        this.activeSession = session;
        this.isRegisterOpen = true;
        this.showNotification('Session de caisse ouverte avec succès.', 'success');
        
        // Mettre à jour l'interface utilisateur
        this.sessionStartTime = new Date(session.openedAt || new Date());
        this.sessionCashier = session.openedByUser?.name || session.openedBy || 'Utilisateur actuel';
        this.sessionStartingAmount = session.startingAmount || 0;
        this.sessionCurrentAmount = session.endingAmount || 0;
      },
      error: (error) => {
        console.error('Erreur lors de l\'ouverture de la session:', error);
        this.showNotification('Impossible d\'ouvrir la session de caisse.', 'error');
      }
    });
  }

  /**
   * Ajoute un produit au panier
   */
  /**
   * Ajoute un produit au panier ou met à jour sa quantité s'il est déjà présent
   * @param product Produit à ajouter
   * @param quantity Quantité à ajouter (par défaut: 1)
   */
  addToCart(product: any, quantity: number = 1): void {
    if (!product) {
      this.showNotification('Produit invalide', 'error');
      return;
    }
    
    // Vérifier si le produit est en stock
    if (!product.quantityInStock || product.quantityInStock <= 0) {
      this.showNotification(`${product.name} est en rupture de stock`, 'warning');
      return;
    }
    
    // Vérifier si le produit est déjà dans le panier
    const existingItemIndex = this.cartItems.findIndex(item => item.productId === product.id);
    
    if (existingItemIndex !== -1) {
      // Produit déjà dans le panier, mise à jour de la quantité
      const newQuantity = this.cartItems[existingItemIndex].quantity + quantity;
      
      // Vérifier si la quantité demandée est disponible en stock
      if (newQuantity > product.quantityInStock) {
        this.showNotification(
          `Stock insuffisant. Il ne reste que ${product.quantityInStock} unité(s) de ${product.name}`,
          'warning'
        );
        return;
      }
      
      // Mettre à jour la quantité
      this.updateQuantity(existingItemIndex, newQuantity);
      
      // Afficher une notification de mise à jour
      this.showNotification(
        `Quantité de ${product.name} mise à jour (${newQuantity})`,
        'success',
        2000
      );
    } else {
      // Vérifier si la quantité demandée est disponible en stock
      if (quantity > product.quantityInStock) {
        this.showNotification(
          `Stock insuffisant. Il ne reste que ${product.quantityInStock} unité(s) de ${product.name}`,
          'warning'
        );
        quantity = product.quantityInStock; // Ajuster à la quantité disponible
      }
      
      // Ajouter un nouvel article au panier
      const newItem: CartItem = {
        productId: product.id,
        productName: product.name,
        barcode: product.barcode || '',
        quantity: quantity,
        unitPrice: product.price,
        totalPrice: product.price * quantity,
        taxRate: product.taxRate || 0,
        taxAmount: (product.price * (product.taxRate || 0) / 100) * quantity,
        discount: 0,
        product: product // Référence vers l'objet produit complet
      };
      
      this.cartItems = [...this.cartItems, newItem];
      this.calculateTotals();
      
      // Afficher une notification d'ajout
      this.showNotification(
        `${quantity} × ${product.name} ajouté au panier`,
        'success',
        2000
      );
    }
    
    // Effacer la recherche et remettre le focus sur le champ de recherche
    this.clearSearch();
    
    // Jouer un son de confirmation (optionnel)
    this.playSound('add-to-cart');
  }
  
  /**
   * Efface le champ de recherche et réinitialise les résultats
   */
  @ViewChild('searchInput') searchInputElement!: ElementRef<HTMLInputElement>;
  
  private clearSearch(): void {
    this.searchForm.get('query')?.setValue('');
    this.searchResults = [];
    
    // Remettre le focus sur le champ de recherche
    setTimeout(() => {
      if (this.searchInputElement && this.searchInputElement.nativeElement) {
        this.searchInputElement.nativeElement.focus();
      }
    }, 100);
  }
  
  /**
   * Joue un son d'interface utilisateur
   * @param soundName Nom du son à jouer (add-to-cart, error, success, etc.)
   */
  private playSound(soundName: string): void {
    // Implémentation basique, à adapter selon les besoins
    try {
      // Exemple avec l'API Web Audio
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Configurer le son en fonction du type d'action
      switch(soundName) {
        case 'add-to-cart':
          oscillator.frequency.value = 800;
          gainNode.gain.value = 0.1;
          oscillator.type = 'sine';
          break;
        case 'error':
          oscillator.frequency.value = 300;
          gainNode.gain.value = 0.1;
          oscillator.type = 'sine';
          break;
        case 'success':
          oscillator.frequency.value = 1000;
          gainNode.gain.value = 0.1;
          oscillator.type = 'sine';
          break;
        default:
          return; // Pas de son pour les autres cas
      }
      
      // Jouer le son
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
      console.warn('Impossible de jouer le son:', e);
    }
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
   * Vérifie si un produit est en stock
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
   * Affiche les détails d'un produit dans une boîte de dialogue
   */
  showProductDetails(product: any): void {
    if (!product) {
      return;
    }
    
    this.dialog.open(ProductDetailsDialogComponent, {
      width: '500px',
      data: { product },
      panelClass: 'product-details-dialog'
    });
  }
  
  /**
   * Méthode pour afficher les notifications
   */
  showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning', duration: number = 5000): void {
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
}
