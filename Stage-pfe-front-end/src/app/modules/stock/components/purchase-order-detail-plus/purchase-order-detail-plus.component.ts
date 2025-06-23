import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Observable, of, Subscription } from 'rxjs';
import { catchError, finalize, map, switchMap, delay } from 'rxjs/operators';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, Product as OrderProduct, Supplier } from '../../models/purchase-order.model';
import { PurchaseOrderService } from '../../services/purchase-order.service';
import { ProductService, Product as CatalogProduct } from '../../services/product.service';

@Component({
  selector: 'app-purchase-order-detail-plus',
  templateUrl: './purchase-order-detail-plus.component.html',
  styleUrls: ['./purchase-order-detail-plus.component.scss']
})
export class PurchaseOrderDetailPlusComponent implements OnInit, OnDestroy {
  // Formulaire principal
  orderForm!: FormGroup;
  
  // État de l'ordre d'achat
  orderId: string | null = null;
  isNewOrder: boolean = true;
  isReadOnly: boolean = false;
  isLoading: boolean = false;
  
  // Messages utilisateur
  successMessage: string | null = null;
  errorMessage: string | null = null;
  warningMessage: string | null = null;
  mockDataWarningMessage: string | null = null;
  
  // Timers pour effacer les messages automatiquement
  private successMessageTimeout: any;
  private errorMessageTimeout: any;
  private warningMessageTimeout: any;

  // Indicateur de données fictives
  usingMockData: boolean = false;
  
  // Option pour forcer l'utilisation de données fictives
  public useMockData: boolean = false;
  
  // Produits disponibles pour le formulaire
  products: CatalogProduct[] = [];
  
  // Variables pour la recherche de produits
  productSearchTerm: string = '';
  filteredProducts: CatalogProduct[] = [];
  suppliers: Supplier[] = [];
  
  // Liste des commandes générée
  ordersList: {
    productId: string | number,
    productName: string,
    quantity: number,
    unitPrice: number,
    total: number
  }[] = [];
  
  // Souscriptions
  private subscriptions: Subscription[] = [];
  
  // Constantes pour les statuts
  readonly STATUS_DRAFT: PurchaseOrderStatus = 'DRAFT';
  readonly STATUS_SENT: PurchaseOrderStatus = 'SENT';
  readonly STATUS_CONFIRMED: PurchaseOrderStatus = 'CONFIRMED';
  readonly STATUS_DELIVERED: PurchaseOrderStatus = 'DELIVERED';
  readonly STATUS_CANCELLED: PurchaseOrderStatus = 'CANCELLED';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private purchaseOrderService: PurchaseOrderService,
    private productService: ProductService
  ) { }

  ngOnInit(): void {
    this.initForm();
    this.loadReferenceData();
    
    // Récupérer l'ID de la commande depuis les paramètres de route
    const id = this.route.snapshot.paramMap.get('id');
    
    // Déterminer s'il s'agit d'une nouvelle commande
    if (id === 'new') {
      this.isNewOrder = true;
      this.isReadOnly = false;
    } else if (id) {
      this.orderId = id;
      this.isNewOrder = false;
      this.loadOrderById(id);
      
      // Vérifier si on est en mode lecture seule depuis les paramètres de requête
      this.route.queryParams.subscribe(params => {
        this.isReadOnly = params['readonly'] === 'true';
        if (this.isReadOnly) {
          this.orderForm.disable();
        }
      });
    }
  }

  ngOnDestroy(): void {
    // Annuler tous les timeouts
    if (this.successMessageTimeout) {
      clearTimeout(this.successMessageTimeout);
    }
    if (this.errorMessageTimeout) {
      clearTimeout(this.errorMessageTimeout);
    }
    if (this.warningMessageTimeout) {
      clearTimeout(this.warningMessageTimeout);
    }
    
    // Désabonner de toutes les souscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Initialise le formulaire de saisie
   */
  initForm(): void {
    this.orderForm = this.fb.group({
      id: [null],
      orderNumber: [''],
      supplierId: ['', Validators.required],
      supplierEmail: ['', [Validators.email]],
      status: [this.STATUS_DRAFT, Validators.required],
      orderDate: [new Date().toISOString().split('T')[0], Validators.required],
      expectedDeliveryDate: [''],
      deliveryDate: [''],
      notes: [''],
      items: this.fb.array([])
    });
  }

  /**
   * Obtient une référence au FormArray des articles
   */
  get items(): FormArray {
    return this.orderForm.get('items') as FormArray;
  }

  /**
   * Charge les données de référence (fournisseurs, etc.)
   */
  loadReferenceData(): void {
    this.isLoading = true;
    
    // Charger les fournisseurs
    this.purchaseOrderService.getSuppliers().subscribe({
      next: (suppliers) => {
        this.suppliers = suppliers;
        console.log('Fournisseurs chargés:', suppliers);
        // Si nous avons déjà sélectionné un fournisseur, charger ses produits
        const selectedSupplierId = this.orderForm.get('supplierId')?.value;
        if (selectedSupplierId) {
          this.loadSupplierProducts(selectedSupplierId);
        }
      },
      error: (error) => {
        this.showErrorMessage('Erreur lors du chargement des fournisseurs: ' + error.message);
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }
  
  /**
   * Charge les produits associés à un fournisseur
   */
  loadSupplierProducts(supplierId: string): void {
    this.isLoading = true;
    this.products = [];
    this.filteredProducts = [];
    this.productSearchTerm = '';
    
    // Désactiver les données fictives pour utiliser exclusivement les données réelles
    // Le paramètre false force l'utilisation des données réelles uniquement
    console.log('Chargement des produits réels depuis le backend pour le fournisseur ID:', supplierId);
    this.productService.getProducts(false).subscribe({
      next: (products) => {
        // Pour l'instant, nous récupérons tous les produits car l'API backend peut ne pas avoir
        // de filtre par fournisseur. Dans une version future, on pourrait filtrer par fournisseur côté serveur
        this.products = products;
        
        // Filtrer ici côté client pour ne garder que les produits associés au fournisseur (si l'API implémente cette relation)
        // Pour l'instant, on garde tous les produits car la relation produit-fournisseur n'est peut-être pas implémentée
        
        console.log(`Produits chargés avec succès: ${products.length} produits disponibles`);
        
        if (products.length === 0) {
          this.showWarningMessage('Aucun produit disponible pour ce fournisseur.');
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement des produits:', error);
        this.showErrorMessage(`Impossible de charger les produits: ${error.message || 'Erreur de connexion au serveur'}`);
        this.mockDataWarningMessage = "Le serveur de produits n'est pas accessible. Impossible de charger les produits. Veuillez vérifier que le backend Spring Boot est en cours d'exécution sur les ports 8080 ou 8082.";
        
        // Afficher un message d'erreur plus détaillé dans la console pour faciliter le débogage
        console.error('Détails de l\'erreur:', {
          message: error.message,
          status: error.status,
          statusText: error.statusText,
          url: error.url
        });
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  /**
   * Charge une commande par son ID
   */
  loadOrderById(id: string): void {
    this.isLoading = true;
    
    this.purchaseOrderService.getPurchaseOrderById(id).subscribe({
      next: (order) => {
        this.patchFormWithOrder(order);
      },
      error: (error) => {
        this.showErrorMessage('Erreur lors du chargement de la commande: ' + error.message);
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  /**
   * Met à jour le formulaire avec les données d'une commande
   */
  patchFormWithOrder(order: PurchaseOrder): void {
    // Vider le tableau d'articles existant
    while (this.items.length > 0) {
      this.items.removeAt(0);
    }
    
    // Ajouter les articles de la commande
    order.items.forEach(item => {
      this.addItem(item);
    });
    
    // Mettre à jour les autres champs du formulaire
    this.orderForm.patchValue({
      id: order.id,
      orderNumber: order.orderNumber,
      supplierId: order.supplierId,
      supplierEmail: order.supplierEmail,
      status: order.status,
      orderDate: order.orderDate instanceof Date 
        ? order.orderDate.toISOString().split('T')[0]
        : typeof order.orderDate === 'string'
          ? order.orderDate.split('T')[0]
          : '',
      expectedDeliveryDate: order.expectedDeliveryDate instanceof Date 
        ? order.expectedDeliveryDate.toISOString().split('T')[0]
        : typeof order.expectedDeliveryDate === 'string'
          ? order.expectedDeliveryDate.split('T')[0]
          : '',
      deliveryDate: order.deliveryDate instanceof Date 
        ? order.deliveryDate.toISOString().split('T')[0]
        : typeof order.deliveryDate === 'string'
          ? order.deliveryDate.split('T')[0]
          : '',
      notes: order.notes
    });
    
    // Si en mode lecture seule, désactiver le formulaire
    if (this.isReadOnly) {
      this.orderForm.disable();
    }
  }

  /**
   * Ajoute un nouvel article au formulaire
   */
  addItem(item: Partial<PurchaseOrderItem> = {}): void {
    const newItemGroup = this.fb.group({
      id: [item.id || null],
      productId: [item.productId || '', Validators.required],
      productName: [item.productName || '', Validators.required],
      quantity: [item.quantity || 1, [Validators.required, Validators.min(1)]],
      unitPrice: [item.unitPrice || 0, [Validators.required, Validators.min(0)]],
      total: [item.total || 0]
    });
    
    this.items.push(newItemGroup);
    
    // Calcul des totaux
    this.calculateOrderTotal();
    
    // Mettre à jour la liste des commandes
    this.updateOrdersList();
    
    // Écouter les changements de quantité et prix unitaire pour mettre à jour la liste des commandes
    const quantitySub = newItemGroup.get('quantity')?.valueChanges.subscribe(() => {
      this.updateOrdersList();
    });
    
    const priceSub = newItemGroup.get('unitPrice')?.valueChanges.subscribe(() => {
      this.updateOrdersList();
    });
    
    if (quantitySub) this.subscriptions.push(quantitySub);
    if (priceSub) this.subscriptions.push(priceSub);
  }

  /**
   * Supprime un article du formulaire
   */
  removeItem(index: number): void {
    this.items.removeAt(index);
    this.calculateOrderTotal();
  }

  /**
   * Calcule le total d'un article
   */
  calculateItemTotal(item: AbstractControl): void {
    const quantity = item.get('quantity')?.value || 0;
    const unitPrice = item.get('unitPrice')?.value || 0;
    const total = quantity * unitPrice;
    
    item.patchValue({ total: total });
  }

  /**
   * Calcule le total de la commande
   */
  calculateOrderTotal(): number {
    let total = 0;
    
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items.at(i);
      this.calculateItemTotal(item);
      total += item.get('total')?.value || 0;
    }
    
    return total;
  }

  /**
   * Ouvre la recherche de produits (non utilisé - remplacé par l'interface intégrée)
   */
  openProductSearch(): void {
    // Vérifier si un fournisseur est sélectionné
    const supplierId = this.orderForm.get('supplierId')?.value;
    if (!supplierId) {
      this.showWarningMessage('Veuillez d\'abord sélectionner un fournisseur avant d\'ajouter des articles.');
      return;
    }
    
    // Vérifier si des produits sont disponibles
    if (this.products.length === 0) {
      this.showWarningMessage('Aucun produit disponible. Veuillez réessayer plus tard.');
      this.loadSupplierProducts(supplierId); // Essayer de recharger les produits
    }
  }
  
  /**
   * Filtre les produits en fonction du terme de recherche
   */
  filterProducts(): void {
    if (!this.productSearchTerm || this.productSearchTerm.trim() === '') {
      this.filteredProducts = [];
      return;
    }
    
    const searchTerm = this.productSearchTerm.toLowerCase().trim();
    
    this.filteredProducts = this.products.filter(product => {
      return (
        (product.name && product.name.toLowerCase().includes(searchTerm)) ||
        (product.reference && product.reference.toLowerCase().includes(searchTerm))
      );
    }).slice(0, 10); // Limiter à 10 résultats pour des performances optimales
  }
  
  /**
   * Efface la recherche de produits
   */
  clearProductSearch(): void {
    this.productSearchTerm = '';
    this.filteredProducts = [];
  }
  
  /**
   * Ajoute un article à partir d'un produit sélectionné dans la liste des produits réels
   */
  addItemFromProduct(product: CatalogProduct): void {
    if (!product || !product.id) {
      this.showErrorMessage('Produit invalide ou incomplet. Impossible de l\'ajouter à la commande.');
      return;
    }
    
    // Vérifier si le produit est déjà dans la commande
    const existingItemIndex = this.findExistingItemIndex(product.id.toString());
    
    if (existingItemIndex !== -1) {
      // Si le produit existe déjà, augmenter sa quantité de 1
      const existingItem = this.items.at(existingItemIndex);
      const currentQuantity = existingItem.get('quantity')?.value || 0;
      existingItem.get('quantity')?.setValue(currentQuantity + 1);
      this.calculateItemTotal(existingItem);
      this.showSuccessMessage(`Quantité de "${product.name || 'Article'}" augmentée.`);
    } else {
      // Sinon, ajouter un nouvel article
      this.addItem({
        productId: product.id.toString(),
        productName: product.name || 'Article sans nom',
        quantity: 1,
        unitPrice: product.price || 0
      });
      this.showSuccessMessage(`"${product.name || 'Article'}" ajouté à la commande.`);
    }
    
    // Effacer la recherche après avoir ajouté l'article
    this.clearProductSearch();
  }
  
  /**
   * Recherche si un produit existe déjà dans la liste des articles
   */
  findExistingItemIndex(productId: string): number {
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items.at(i);
      const itemProductId = item.get('productId')?.value;
      if (itemProductId && itemProductId.toString() === productId) {
        return i;
      }
    }
    return -1;
  }
  
  /**
   * Met à jour la liste de commandes à partir des articles dans le formulaire
   */
  updateOrdersList(): void {
    this.ordersList = [];
    
    // Regrouper les articles par productId
    const groupedItems = new Map<string | number, {
      productId: string | number,
      productName: string,
      quantity: number,
      unitPrice: number,
      total: number
    }>();
    
    // Parcourir tous les articles du formulaire
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items.at(i);
      const productId = item.get('productId')?.value;
      const productName = item.get('productName')?.value;
      const quantity = item.get('quantity')?.value || 0;
      const unitPrice = item.get('unitPrice')?.value || 0;
      const total = quantity * unitPrice;
      
      // Si le produit existe déjà dans la liste groupée, additionner les quantités et totaux
      if (productId && groupedItems.has(productId)) {
        const existingItem = groupedItems.get(productId)!;
        existingItem.quantity += quantity;
        existingItem.total += total;
      } else if (productId) {
        // Sinon, ajouter un nouvel élément à la liste groupée
        groupedItems.set(productId, {
          productId,
          productName,
          quantity,
          unitPrice,
          total
        });
      }
    }
    
    // Convertir la Map en array pour la liste finale des commandes
    this.ordersList = Array.from(groupedItems.values());
    
    console.log('Liste des commandes mise à jour:', this.ordersList);
  }
  
  /**
   * Calcule le total général de la liste des commandes
   */
  getOrdersListTotal(): number {
    return this.ordersList.reduce((sum, item) => sum + item.total, 0);
  }

  /**
   * Enregistre la commande
   */
  saveOrder(): void {
    if (this.orderForm.invalid) {
      this.markFormGroupTouched(this.orderForm);
      this.showErrorMessage('Veuillez corriger les erreurs dans le formulaire avant de continuer.');
      return;
    }
    
    this.isLoading = true;
    const formValue = this.orderForm.value;
    
    // Construire l'objet commande
    const order: PurchaseOrder = {
      ...formValue,
      total: this.calculateOrderTotal()
    };
    
    // Mettre à jour ou créer la commande selon qu'il s'agit d'une édition ou d'une création
    const saveObservable = this.isNewOrder
      ? this.purchaseOrderService.createPurchaseOrder(order)
      : this.purchaseOrderService.updatePurchaseOrder(this.orderId!, order);
    
    saveObservable.subscribe({
      next: (savedOrder) => {
        this.showSuccessMessage('La commande a été enregistrée avec succès.');
        
        // Rediriger vers la page de visualisation
        this.router.navigate(['/stock/purchase-orders/view', savedOrder.id]);
      },
      error: (error) => {
        this.showErrorMessage('Erreur lors de l\'enregistrement de la commande: ' + error.message);
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  /**
   * Génère un PDF pour la commande
   */
  generatePdf(): void {
    if (!this.orderId) {
      this.showErrorMessage('Impossible de générer le PDF: ID de commande non disponible.');
      return;
    }
    
    this.isLoading = true;
    
    this.purchaseOrderService.generatePdf(this.orderId).subscribe({
      next: (blob) => {
        // Créer un URL pour le blob
        const url = window.URL.createObjectURL(blob);
        
        // Ouvrir le PDF dans un nouvel onglet
        window.open(url, '_blank');
        
        // Libérer l'URL
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        this.showErrorMessage('Erreur lors de la génération du PDF: ' + error.message);
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  /**
   * Envoie la commande par email au fournisseur
   */
  sendByEmail(): void {
    if (this.orderForm.invalid) {
      this.markFormGroupTouched(this.orderForm);
      this.showErrorMessage('Veuillez corriger les erreurs dans le formulaire avant d\'envoyer la commande.');
      return;
    }
    
    const formValue = this.orderForm.value;
    const supplierEmail = formValue.supplierEmail;
    
    if (!supplierEmail) {
      this.showErrorMessage('Aucune adresse email de fournisseur spécifiée.');
      return;
    }
    
    this.isLoading = true;
    
    // Si la commande n'est pas enregistrée, l'enregistrer d'abord
    if (this.isNewOrder || !this.orderId) {
      this.saveOrder();
      return;
    }
    
    // Envoyer la commande existante par email
    this.purchaseOrderService.sendOrderByEmail({
      orderId: this.orderId,
      email: supplierEmail,
      subject: `Commande ${formValue.orderNumber || this.orderId}`,
      message: 'Veuillez trouver ci-joint notre commande.'
    }).subscribe({
      next: () => {
        this.showSuccessMessage('La commande a été envoyée au fournisseur par email.');
      },
      error: (error) => {
        this.showErrorMessage('Erreur lors de l\'envoi de la commande par email: ' + error.message);
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  /**
   * Annule l'édition et retourne à la liste des commandes
   */
  cancel(): void {
    this.router.navigate(['/stock/purchase-orders']);
  }

  /**
   * Marque tous les contrôles d'un FormGroup comme touchés
   */
  markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  /**
   * Vérifie si un contrôle du formulaire est invalide et touché
   */
  isInvalid(controlName: string): boolean {
    const control = this.orderForm.get(controlName);
    return control ? control.invalid && control.touched : false;
  }

  /**
   * Affiche un message de succès temporaire
   */
  showSuccessMessage(message: string): void {
    this.successMessage = message;
    
    if (this.successMessageTimeout) {
      clearTimeout(this.successMessageTimeout);
    }
    
    this.successMessageTimeout = setTimeout(() => {
      this.successMessage = null;
    }, 5000);
  }

  /**
   * Affiche un message d'erreur temporaire
   */
  showErrorMessage(message: string): void {
    this.errorMessage = message;
    
    if (this.errorMessageTimeout) {
      clearTimeout(this.errorMessageTimeout);
    }
    
    this.errorMessageTimeout = setTimeout(() => {
      this.errorMessage = null;
    }, 5000);
  }

  /**
   * Affiche un message d'avertissement temporaire
   */
  showWarningMessage(message: string): void {
    this.warningMessage = message;
    
    if (this.warningMessageTimeout) {
      clearTimeout(this.warningMessageTimeout);
    }
    
    this.warningMessageTimeout = setTimeout(() => {
      this.warningMessage = null;
    }, 7000);
  }

  /**
   * Active ou désactive le mode données fictives
   */
  toggleMockData(): void {
    this.useMockData = !this.useMockData;
    this.purchaseOrderService.setForceMockData(this.useMockData);
    
    if (this.useMockData) {
      this.mockDataWarningMessage = this.purchaseOrderService.getBackendUnavailableMessage();
    } else {
      this.mockDataWarningMessage = null;
      this.loadReferenceData();
      if (this.orderId) {
        this.loadOrderById(this.orderId);
      }
    }
  }
  
  /**
   * Renvoie le libellé du statut en français
   */
  getStatusLabel(status: PurchaseOrderStatus | null | undefined): string {
    if (!status) return '';
    
    const statusMap: Record<string, string> = {
      'DRAFT': 'Brouillon',
      'SENT': 'Envoyée',
      'CONFIRMED': 'Confirmée',
      'DELIVERED': 'Livrée',
      'CANCELLED': 'Annulée'
    };
    
    return statusMap[status] || status;
  }

  /**
   * Gère le changement de fournisseur dans le formulaire
   */
  onSupplierChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const supplierId = select.value;
    
    // Mettre à jour l'email du fournisseur
    this.updateSupplierEmail();
    
    // Charger les produits du fournisseur
    if (supplierId) {
      this.loadSupplierProducts(supplierId);
    }
  }

  /**
   * Met à jour l'email du fournisseur lorsque le fournisseur est sélectionné
   */
  updateSupplierEmail(): void {
    const supplierId = this.orderForm.get('supplierId')?.value;
    if (supplierId) {
      const supplier = this.suppliers.find(s => s.id === supplierId);
      if (supplier) {
        this.orderForm.patchValue({ supplierEmail: supplier.email });
      }
    }
  }
}
