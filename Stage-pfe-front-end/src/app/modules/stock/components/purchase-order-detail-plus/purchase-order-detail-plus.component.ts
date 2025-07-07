import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, AbstractControl, Validators, ValidatorFn, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, forkJoin, Observable, of } from 'rxjs';
import { catchError, finalize, map, switchMap, delay } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { EmailDialogComponent } from '../../dialogs/email-dialog/email-dialog.component';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, Product as OrderProduct, Supplier } from '../../models/purchase-order.model';
import { OrderItemForm } from '../../models/order-item-creation.model';
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
  
  // Propriétés pour la recherche de produits
  filteredProducts: CatalogProduct[] = [];
  productSearchTerm: string = '';
  showProductSearch: boolean = false;
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
    private productService: ProductService,
    private http: HttpClient,
    private dialog: MatDialog
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
      supplierId: [''], // Suppression du validateur required
      supplierEmail: ['', [Validators.email]], // Email reste optionnel mais doit être valide si fourni
      status: [this.STATUS_DRAFT, Validators.required],
      orderDate: [new Date().toISOString().split('T')[0], Validators.required],
      expectedDeliveryDate: [''],
      deliveryDate: [''],
      notes: [''],
      items: this.fb.array([])
    });
    
    // Ajout d'un validateur personnalisé pour s'assurer qu'au moins un supplierId ou un supplierEmail est fourni
    this.orderForm.setValidators(this.supplierValidator);
  }
  
  /**
   * Validateur personnalisé pour s'assurer qu'au moins un supplierId ou un supplierEmail est fourni
   */
  supplierValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const formGroup = control as FormGroup;
    const supplierId = formGroup.get('supplierId')?.value;
    const supplierEmail = formGroup.get('supplierEmail')?.value;
    
    if (!supplierId && !supplierEmail) {
      // Si aucun fournisseur n'est sélectionné et aucun email n'est fourni
      formGroup.get('supplierEmail')?.setErrors({ supplierRequired: true });
      return { supplierRequired: true };
    } else {
      // Si au moins l'un des deux est fourni, on supprime cette erreur spécifique
      const emailControl = formGroup.get('supplierEmail');
      if (emailControl?.errors) {
        const errors = { ...emailControl.errors };
        if (errors['supplierRequired']) {
          delete errors['supplierRequired'];
          emailControl.setErrors(Object.keys(errors).length ? errors : null);
        }
      }
      return null;
    }
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
        this.setErrorMessage('Erreur lors du chargement des fournisseurs: ' + error.message);
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }
  
  /**
   * Gère le changement de fournisseur dans le formulaire
   * @param event Événement de changement du select
   */
  onSupplierChange(event: any): void {
    const supplierId = event.target.value;
    console.log('Fournisseur sélectionné:', supplierId);
    
    if (supplierId) {
      // Trouver le fournisseur sélectionné
      const selectedSupplier = this.suppliers.find(s => s.id.toString() === supplierId.toString());
      
      if (selectedSupplier) {
        // Mettre à jour l'email du fournisseur dans le formulaire
        this.orderForm.patchValue({
          supplierEmail: selectedSupplier.email
        });
      }
      
      // Charger les produits associés à ce fournisseur
      this.loadSupplierProducts(supplierId);
    } else {
      // Si aucun fournisseur n'est sélectionné, vider l'email
      this.orderForm.patchValue({
        supplierEmail: ''
      });
      
      // Réinitialiser les produits
      this.products = [];
      this.filteredProducts = [];
    }
  }

  /**
   * Charge tous les produits disponibles
   */
  loadAllProducts(): void {
    this.isLoading = true;
    this.products = [];
    this.filteredProducts = [];
    this.productSearchTerm = '';
    
    console.log('Chargement de tous les produits disponibles depuis le backend');
    
    // Utiliser le paramètre false pour forcer l'utilisation des données réelles
    this.productService.getProducts(false).subscribe({
      next: (products) => {
        this.products = products;
        console.log(`Produits chargés avec succès: ${products.length} produits disponibles`);
        
        // Initialiser également les produits filtrés
        this.filteredProducts = [...this.products];
        
        if (products.length === 0) {
          this.setWarningMessage('Aucun produit disponible. Essayez d\'activer les données fictives.');
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement des produits:', error);
        this.setErrorMessage('Erreur lors du chargement des produits: ' + error.message);
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
    
    console.log('Chargement des produits réels depuis le backend pour le fournisseur ID:', supplierId);
    
    // Utiliser le paramètre false pour forcer l'utilisation des données réelles
    this.productService.getProducts(false).subscribe({
      next: (products) => {
        // Pour l'instant, nous récupérons tous les produits car l'API backend peut ne pas avoir
        // de filtre par fournisseur. Dans une version future, on pourrait filtrer par fournisseur côté serveur
        this.products = products;
        
        // Filtrer ici côté client pour ne garder que les produits associés au fournisseur (si l'API implémente cette relation)
        // Pour l'instant, on garde tous les produits car la relation produit-fournisseur n'est peut-être pas implémentée
        
        console.log(`Produits chargés avec succès: ${products.length} produits disponibles`);
        
        // Initialiser également les produits filtrés
        this.filteredProducts = [...this.products];
        
        if (products.length === 0) {
          this.setWarningMessage('Aucun produit disponible pour ce fournisseur. Essayez d\'activer les données fictives.');
        }
      },
      error: (error) => {
        this.setErrorMessage('Erreur lors du chargement des produits: ' + error.message);
        
        // Afficher un message d'erreur plus détaillé dans la console pour faciliter le débogage
        console.error('Détails de l\'erreur:', {
          message: error.message,
          status: error.status,
          statusText: error.statusText,
          url: error.url
        });
        
        // En cas d'erreur, essayer de récupérer les produits avec fallback sur les données fictives
        this.productService.getProducts(true).subscribe({
          next: (mockProducts) => {
            this.products = mockProducts;
            this.filteredProducts = [...this.products];
            console.log(`Produits fictifs chargés avec succès: ${mockProducts.length} produits disponibles`);
          },
          error: (mockError) => {
            console.error('Erreur lors du chargement des produits fictifs:', mockError);
            // Activer automatiquement les données fictives en cas d'erreur
            if (!this.useMockData) {
              this.toggleMockData();
            }
          }
        });
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  /**
   * Met à jour le formulaire avec les données d'une commande
   * @param order Commande à afficher dans le formulaire
   */
  private patchFormWithOrder(order: PurchaseOrder): void {
    console.log('Mise à jour du formulaire avec les données de la commande:', order);
    
    // Vider le tableau d'articles existant
    while (this.items.length > 0) {
      this.items.removeAt(0);
    }

    // Mettre à jour les champs du formulaire
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
      notes: order.notes || ''
    });

    // Ajouter les articles à la commande
    if (order.items && order.items.length > 0) {
      console.log(`Ajout de ${order.items.length} articles au formulaire`);
      order.items.forEach(item => this.addItem(item));
    } else {
      console.warn('Aucun article trouvé dans la commande');
    }

    // Si en mode lecture seule, désactiver le formulaire
    if (this.isReadOnly) {
      this.orderForm.disable();
    }
  }

  /**
   * Charge une commande par son ID
   */
  loadOrderById(id: string): void {
    this.isLoading = true;
    console.log(`Chargement de la commande avec l'ID: ${id}`);

    this.purchaseOrderService.getPurchaseOrderById(id).subscribe({

      next: (order) => {
        try {
          console.log('Réponse de l\'API:', order);
          
          // Vérifier si les articles sont présents dans différentes propriétés
          if (!order.items || order.items.length === 0) {
            if (order.lignes && order.lignes.length > 0) {
              console.log('Utilisation de la propriété "lignes" pour les articles');
              order.items = order.lignes;
            } else if (order.lignesCommande && order.lignesCommande.length > 0) {
              console.log('Utilisation de la propriété "lignesCommande" pour les articles');
              order.items = order.lignesCommande;
            } else if (order.articles && order.articles.length > 0) {
              console.log('Utilisation de la propriété "articles" pour les articles');
              order.items = order.articles;
            } else {
              console.warn('Aucun article trouvé dans la réponse de l\'API');
              order.items = [];
            }
          }

          console.log(`Nombre d'articles chargés: ${order.items.length}`);
          this.patchFormWithOrder(order);
        } catch (error) {
          console.error('Erreur lors du traitement de la commande:', error);
          this.setErrorMessage('Erreur lors du chargement de la commande');
        } finally {
          this.isLoading = false;
        }
      },
      error: (error) => {
        console.error('Erreur lors de la récupération de la commande:', error);
        this.setErrorMessage('Impossible de charger la commande. Veuillez réessayer.');
        this.isLoading = false;
      }
    });
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

    // Ajouter le nouvel article au début du tableau
    this.items.insert(0, newItemGroup);
    
    // Forcer le calcul du total
    this.calculateItemTotal(newItemGroup);
    
    // Mettre à jour le total de la commande
    this.calculateOrderTotal();
    
    // Mettre à jour la liste des commandes
    this.updateOrdersList();
    
    // S'abonner aux changements de quantité et de prix
    const quantitySub = newItemGroup.get('quantity')?.valueChanges.subscribe(() => {
      this.calculateItemTotal(newItemGroup);
      this.calculateOrderTotal();
      this.updateOrdersList();
    });
    
    const priceSub = newItemGroup.get('unitPrice')?.valueChanges.subscribe(() => {
      this.calculateItemTotal(newItemGroup);
      this.calculateOrderTotal();
      this.updateOrdersList();
    });
    
    // Stocker les souscriptions pour les nettoyer plus tard
    if (quantitySub && priceSub) {
      this.subscriptions.push(quantitySub, priceSub);
    }
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
   * Ouvre la recherche de produits
   */
  openProductSearch(): void {
    // Afficher la section de recherche de produits
    this.showProductSearch = true;
    
    // S'assurer que les produits sont chargés
    const supplierId = this.orderForm.get('supplierId')?.value;
    if (this.products.length === 0) {
      if (supplierId) {
        // Si un fournisseur est sélectionné, charger ses produits spécifiques
        this.loadSupplierProducts(supplierId);
      } else {
        // Sinon, charger tous les produits disponibles
        this.loadAllProducts();
      }
    }
    
    // Initialiser les produits filtrés
    this.filteredProducts = [...this.products];
  }

  /**
   * Ferme la recherche de produits
   */
  closeProductSearch(): void {
    this.showProductSearch = false;
  }

  /**
   * Gère l'ajout d'un article depuis le composant OrderItemCreation
   * @param itemData Données de l'article à ajouter
   */
  handleItemAdded(itemData: OrderItemForm): void {
    try {
      if (!itemData) {
        console.error('Données d\'article invalides');
        return;
      }
      
      console.log('Ajout d\'article depuis le composant de création:', itemData);
      
      // Récupérer l'ID de la commande actuelle (soit du formulaire, soit de la propriété orderId)
      const orderId = this.orderForm.get('id')?.value || this.orderId;
      
      if (!orderId) {
        // Pour les nouvelles commandes sans ID, nous devons d'abord sauvegarder la commande
        if (this.isNewOrder) {
          // Préparer les données de l'article
          const newItem = {
            productId: itemData.productId,
            productName: itemData.productName,
            quantity: itemData.quantity,
            unitPrice: itemData.unitPrice,
            total: itemData.total
          };
          
          // Ajouter d'abord l'article au formulaire local
          this.addItem(newItem);
          
          this.setWarningMessage('La commande doit être sauvegardée avant d\'ajouter des articles au backend.');
          
          // On ne sauvegarde pas automatiquement pour éviter des problèmes de logique
          // L'utilisateur devra cliquer sur le bouton Enregistrer
          return;
        } else {
          this.setErrorMessage('Impossible d\'ajouter un article: ID de commande non disponible');
          return;
        }
      }
      
      console.log(`Ajout d'article à la commande ${orderId}`);
      
      // Vérifier si le produit est déjà dans la commande
      const existingItemIndex = this.findItemIndexByProductId(itemData.productId);
      
      if (existingItemIndex !== -1) {
        // Si le produit existe déjà, mettre à jour sa quantité
        const existingItem = this.items.at(existingItemIndex);
        const currentQuantity = existingItem.get('quantity')?.value || 0;
        const newQuantity = currentQuantity + itemData.quantity;
        
        existingItem.patchValue({ 
          quantity: newQuantity,
          unitPrice: itemData.unitPrice // Mettre à jour le prix unitaire avec le dernier prix
        });
        
        this.setSuccessMessage(`Quantité de "${itemData.productName}" mise à jour à ${newQuantity}.`);
        
        // TODO: Implémenter la mise à jour de la quantité d'un article existant via l'API
      } else {
        // Préparer les données de l'article pour l'ajout au formulaire local et l'envoi au backend
        // Le format correspond à Partial<PurchaseOrderItem> attendu par le service
        const newItem = {
          productId: itemData.productId,
          productName: itemData.productName,
          quantity: itemData.quantity,
          unitPrice: itemData.unitPrice,
          total: itemData.total
        };
        
        // Ajouter l'article au formulaire local
        this.addItem(newItem);
        
        // Envoyer l'article au backend
        this.purchaseOrderService.addLineToOrder(orderId, newItem).subscribe({
          next: (response) => {
            console.log('Article ajouté avec succès au backend:', response);
            this.setSuccessMessage(`"${itemData.productName}" ajouté à la commande et sauvegardé.`);
            
            // Recharger la commande pour obtenir les données à jour
            this.loadOrderById(orderId);
          },
          error: (error) => {
            console.error('Erreur lors de l\'ajout de l\'article au backend:', error);
            this.setErrorMessage(`Erreur lors de la sauvegarde de l'article: ${error.message || 'Erreur de communication avec le serveur'}`);
          }
        });
      }
      
      // Recalculer le total de la commande
      this.calculateOrderTotal();
      
      // Fermer la recherche de produits
      this.closeProductSearch();
    } catch (error: any) {
      console.error('Erreur lors de l\'ajout de l\'article:', error);
      this.setErrorMessage(`Erreur lors de l'ajout de l'article: ${error.message || 'Erreur inconnue'}`);
    }
  }
  
  /**
   * Trouve l'index d'un article dans le formulaire par son ID de produit
   * @param productId ID du produit à rechercher
   * @returns Index de l'article ou -1 si non trouvé
   */
  findItemIndexByProductId(productId: string): number {
    if (!this.items || this.items.length === 0) {
      return -1;
    }
    
    return this.items.controls.findIndex(item => 
      item.get('productId')?.value === productId
    );
  }
  
  /**
   * Définit un message à afficher
   * @param message Le message à afficher
   * @param type Le type de message (success, error, warning)
   */
  setMessage(message: string, type: 'success' | 'error' | 'warning'): void {
    switch (type) {
      case 'success':
        this.successMessage = message;
        break;
      case 'error':
        this.errorMessage = message;
        break;
      case 'warning':
        this.warningMessage = message;
        break;
    }
    if (this.successMessageTimeout) {
      clearTimeout(this.successMessageTimeout);
    }
    if (this.errorMessageTimeout) {
      clearTimeout(this.errorMessageTimeout);
    }
    if (this.warningMessageTimeout) {
      clearTimeout(this.warningMessageTimeout);
    }
    
    const timeout = setTimeout(() => {
      switch (type) {
        case 'success':
          this.successMessage = null;
          break;
        case 'error':
          this.errorMessage = null;
          break;
        case 'warning':
          this.warningMessage = null;
          break;
      }
    }, 5000); // Effacer après 5 secondes
    
    switch (type) {
      case 'success':
        this.successMessageTimeout = timeout;
        break;
      case 'error':
        this.errorMessageTimeout = timeout;
        break;
      case 'warning':
        this.warningMessageTimeout = timeout;
        break;
    }
  }
  
  /**
   * Définit un message de succès à afficher
   * @param message Le message à afficher
   */
  setSuccessMessage(message: string): void {
    this.setMessage(message, 'success');
  }
  
  /**
   * Définit un message d'erreur à afficher
   * @param message Le message à afficher
   */
  setErrorMessage(message: string): void {
    this.setMessage(message, 'error');
  }
  
  /**
   * Définit un message d'avertissement à afficher
   * @param message Le message à afficher
   */
  setWarningMessage(message: string): void {
    this.setMessage(message, 'warning');
  }

  /**
   * Filtre les produits en fonction du terme de recherche
   */
  filterProducts(): void {
    if (!this.productSearchTerm) {
      this.filteredProducts = [...this.products];
      return;
    }
    
    const searchTerm = this.productSearchTerm.toLowerCase();
    
    this.filteredProducts = this.products.filter(product => {
      return (
        (product.name && product.name.toLowerCase().includes(searchTerm)) ||
        (product.reference && product.reference.toLowerCase().includes(searchTerm))
      );
    });
    
    console.log(`Filtrage des produits avec le terme "${searchTerm}": ${this.filteredProducts.length} résultats trouvés`);
  }

  /**
   * Efface la recherche de produits
   */
  clearProductSearch(): void {
    this.productSearchTerm = '';
    // Réinitialiser les produits filtrés pour afficher tous les produits
    this.filteredProducts = [...this.products];
  }

  /**
   * Ajoute un article à partir d'un produit sélectionné dans la liste des produits réels
   */
  addItemFromProduct(product: CatalogProduct): void {
    if (!product || !product.id) {
      this.setErrorMessage('Produit invalide ou incomplet. Impossible de l\'ajouter à la commande.');
      return;
    }
    
    try {
      console.log('Ajout du produit à la commande:', product);
      
      // Vérifier si le produit est déjà dans la commande
      const existingItemIndex = this.findExistingItemIndex(product.id.toString());
      
      if (existingItemIndex !== -1) {
        // Si le produit existe déjà, augmenter sa quantité de 1
        const existingItem = this.items.at(existingItemIndex);
        const currentQuantity = existingItem.get('quantity')?.value || 0;
        existingItem.patchValue({ quantity: currentQuantity + 1 });
        this.setSuccessMessage(`Quantité de "${product.name || 'Article'}" augmentée à ${currentQuantity + 1}.`);
      } else {
        // Sinon, ajouter un nouvel article
        this.addItem({
          productId: product.id.toString(), // Convertir en string pour éviter les erreurs de type
          productName: product.name,
          quantity: 1,
          unitPrice: product.price || 0
        });
        this.setSuccessMessage(`"${product.name || 'Article'}" ajouté à la commande.`);
      }
      
      // Recalculer le total de la commande
      this.calculateOrderTotal();
      
      // Mettre à jour la liste des commandes
      this.updateOrdersList();
      
      // Effacer la recherche après avoir ajouté l'article
      this.clearProductSearch();
    } catch (error: any) {
      console.error('Erreur lors de l\'ajout du produit:', error);
      this.setErrorMessage(`Erreur lors de l'ajout du produit: ${error.message || 'Erreur inconnue'}`);
    }
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
    // Marquer tous les champs comme touchés pour déclencher la validation
    this.markFormGroupTouched(this.orderForm);
    
    if (this.orderForm.invalid) {
      this.setErrorMessage('Veuillez corriger les erreurs dans le formulaire avant de continuer.');
      return;
    }
    
    // Vérifier les champs obligatoires
    const formValue = this.orderForm.value;
    if (!formValue.supplierId && !formValue.supplierEmail) {
      this.setErrorMessage('Veuillez sélectionner un fournisseur ou saisir une adresse email.');
      return;
    }
    
    if (!formValue.orderDate) {
      this.setErrorMessage('La date de commande est obligatoire.');
      return;
    }
    
    // Vérifier s'il y a des articles dans le formulaire
    if (!this.items || this.items.length === 0) {
      this.setErrorMessage('Veuillez ajouter au moins un article à la commande.');
      return;
    }
    
    // Vérifier que chaque article a les informations nécessaires
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items.at(i);
      if (!item.get('productId')?.value || !item.get('productName')?.value || 
          !item.get('quantity')?.value || item.get('quantity')?.value <= 0 || 
          item.get('unitPrice')?.value < 0) {
        this.setErrorMessage(`L'article #${i+1} contient des informations incomplètes ou invalides.`);
        return;
      }
    }
    
    this.isLoading = true;
    
    // Préparer les articles avec le format attendu par l'API
    const items = this.items.controls.map(item => {
      const itemValue = item.value;
      const quantity = Number(itemValue.quantity) || 0;
      const unitPrice = Number(itemValue.unitPrice) || 0;
      const total = quantity * unitPrice;
      
      return {
        id: itemValue.id,
        productId: itemValue.productId,
        productName: itemValue.productName,
        quantity: quantity,
        unitPrice: unitPrice,
        total: total
      };
    });
    
    console.log('Articles extraits du formulaire:', items);
    
    // Construire l'objet commande avec les articles formatés
    const order: PurchaseOrder = {
      ...formValue,
      items: items,
      total: items.reduce((sum, item) => sum + (item.total || 0), 0),
      // Assurer que les dates sont au bon format
      orderDate: formValue.orderDate ? new Date(formValue.orderDate).toISOString() : new Date().toISOString(),
      expectedDeliveryDate: formValue.expectedDeliveryDate ? new Date(formValue.expectedDeliveryDate).toISOString() : null,
      deliveryDate: formValue.deliveryDate ? new Date(formValue.deliveryDate).toISOString() : null,
      // S'assurer que le statut est défini
      status: formValue.status || 'DRAFT'
    };
    
    console.log('Données de la commande à enregistrer:', JSON.stringify(order, null, 2));
    
    // Mettre à jour ou créer la commande selon qu'il s'agit d'une édition ou d'une création
    const saveObservable = this.isNewOrder
      ? this.purchaseOrderService.createPurchaseOrder(order)
      : this.purchaseOrderService.updatePurchaseOrder(this.orderId!, order);
    
    saveObservable.subscribe({
      next: (savedOrder) => {
        console.log('Commande enregistrée avec succès:', savedOrder);
        this.setSuccessMessage('La commande a été enregistrée avec succès.');
        
        // Mettre à jour l'ID de la commande si c'est une nouvelle commande
        if (this.isNewOrder && savedOrder.id) {
          this.orderId = savedOrder.id;
          this.isNewOrder = false;
        }
        
        // Rediriger vers la page de visualisation
        this.router.navigate(['/stock/purchase-orders/view', savedOrder.id]);
      },
      error: (error) => {
        console.error('Erreur complète lors de l\'enregistrement:', error);
        let errorMessage = 'Erreur lors de l\'enregistrement de la commande';
        
        // Ajouter plus de détails sur l'erreur si disponibles
        if (error.error) {
          if (typeof error.error === 'string') {
            errorMessage += `: ${error.error}`;
          } else if (error.error.message) {
            errorMessage += `: ${error.error.message}`;
          } else if (error.error.error) {
            errorMessage += `: ${error.error.error}`;
          }
          
          // Afficher les erreurs de validation détaillées si disponibles
          if (error.error.errors) {
            const validationErrors = Object.values(error.error.errors).flat();
            errorMessage += '\n' + validationErrors.join('\n');
          }
        } else {
          errorMessage += `: ${error.message || 'Erreur inconnue'}`;
        }
        
        this.setErrorMessage(errorMessage);
        this.isLoading = false;
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
      this.setErrorMessage('Impossible de générer le PDF : identifiant de commande manquant');
      return;
    }
  }

  /**
   * Envoie la commande par email au fournisseur
   */
  sendByEmail(): void {
    if (!this.orderId) {
      this.setErrorMessage('Impossible d\'envoyer l\'email: ID de commande manquant');
      return;
    }

    // Récupérer les informations du fournisseur depuis le formulaire
    const supplierEmail = this.orderForm.get('supplierEmail')?.value || '';
    const orderNumber = this.orderForm.get('orderNumber')?.value || this.orderId;
    const supplierName = this.orderForm.get('supplierName')?.value || '';
    
    // Ouvrir le dialogue pour saisir les informations d'email
    const dialogRef = this.dialog.open(EmailDialogComponent, {
      width: '500px',
      data: {
        orderNumber: orderNumber,
        supplierName: supplierName,
        supplierEmail: supplierEmail,
        subject: `Commande ${orderNumber}`,
        message: `Veuillez trouver ci-joint notre commande ${orderNumber}.`
      }
    });

    // Traiter le résultat du dialogue
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.isLoading = true;
        
        // Appeler le service pour envoyer l'email
        this.purchaseOrderService.sendOrderEmail(this.orderId!.toString(), result).subscribe({
          next: (response: any) => {
            this.isLoading = false;
            this.setSuccessMessage(`Email envoyé avec succès à ${result.email}`);
            console.log('Réponse du serveur:', response);
          },
          error: (error: any) => {
            this.isLoading = false;
            this.setErrorMessage(`Erreur lors de l'envoi de l'email: ${error.message || 'Erreur inconnue'}`);
            console.error('Erreur d\'envoi d\'email:', error);
          }
        });
      }
    });
  }

  /**
   * Marque tous les contrôles d'un FormGroup comme touchés
   * @param formGroup Le FormGroup à marquer comme touché
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
   * Active ou désactive le mode données fictives
   */
  toggleMockData(): void {
    this.useMockData = !this.useMockData;
    this.purchaseOrderService.setForceMockData(this.useMockData);
    
    if (this.useMockData) {
      this.mockDataWarningMessage = this.purchaseOrderService.getBackendUnavailableMessage();
      // Recharger les produits en mode données fictives
      const supplierId = this.orderForm.get('supplierId')?.value;
      if (supplierId) {
        this.loadSupplierProducts(supplierId);
      }
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
   * Annule les modifications et retourne à la liste des commandes
   */
  cancel(): void {
    this.router.navigate(['/stock/purchase-orders']);
  }

  // La fonction onSupplierChange a été déplacée plus haut dans le code

  /**
   * Met à jour l'email du fournisseur lorsque le fournisseur est sélectionné
   */
  updateSupplierEmail(): void {
    const supplierId = this.orderForm.get('supplierId')?.value;
    if (supplierId) {
      const supplier = this.suppliers.find((s: Supplier) => s.id === supplierId);
      if (supplier) {
        this.orderForm.patchValue({ supplierEmail: supplier.email });
      }
    }
  }
}
