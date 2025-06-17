import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, finalize, map, switchMap, delay } from 'rxjs/operators';
import { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, Product, Supplier } from '../../models/purchase-order.model';
import { PurchaseOrderService } from '../../services/purchase-order.service';
import { ProductService } from '../../services/product.service';

// Note: Nous utilisons l'interface Product du modèle purchase-order.model.ts, pas celle de product.service.ts

@Component({
  selector: 'app-purchase-order-detail',
  templateUrl: './purchase-order-detail.component.html',
  styleUrls: ['./purchase-order-detail.component.scss']
})
export class PurchaseOrderDetailComponent implements OnInit {
  // Formulaire principal
  orderForm!: FormGroup;
  
  // Données
  orderId: string | null = null;
  isNewOrder: boolean = true;
  isReadOnly: boolean = false;
  isLoading: boolean = false;
  
  // Variables pour les messages
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
  
  // Listes de référence
  products: Product[] = [];
  suppliers: Supplier[] = [];
  
  // État de l'interface
  showProductSearch: boolean = false;
  productSearchTerm: string = '';
  filteredProducts: Product[] = [];
  
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
    
    const id = this.route.snapshot.paramMap.get('id');
    if (id === 'new') {
      this.isNewOrder = true;
      this.isReadOnly = false;
      console.log('Nouvelle commande détectée: mode édition forcé');
    }

    // Ne pas forcer l'utilisation de données fictives
    this.useMockData = false;
    this.purchaseOrderService.setForceMockData(false);
    
    // Essayer de charger les données depuis le backend
    if (id && id !== 'new') {
      this.loadOrderById(id);
    } else {
      this.loadReferenceData();
    }
    
    this.orderForm.enable();
    const supplierIdControl = this.orderForm.get('supplierId');
    if (supplierIdControl) {
      supplierIdControl.enable();
    }
    
    // Vérifier la disponibilité du backend
    this.updateBackendStatus();
    // Déterminer si c'est une nouvelle commande, une vue ou une modification
    this.route.paramMap.pipe(
      switchMap(params => {
        const id = params.get('id');
        const mode = this.route.snapshot.data['mode'] || 'view';
        
        this.isReadOnly = mode === 'view';
        
        if (id === 'new') {
          this.isNewOrder = true;
          this.isReadOnly = false; // Forcer le mode édition pour les nouvelles commandes
          console.log('Nouvelle commande: mode édition forcé');
          return of(this.purchaseOrderService.createEmptyPurchaseOrder());
        } else if (id) {
          this.isNewOrder = false;
          this.orderId = id;
          return this.purchaseOrderService.getPurchaseOrderById(id);
        }
        
        return of(this.purchaseOrderService.createEmptyPurchaseOrder());
      })
    ).subscribe({
      next: (order) => {
        this.populateForm(order);
        
        // Vérifier si nous utilisons des données fictives après le chargement de la commande
        this.usingMockData = !this.purchaseOrderService.isBackendAvailable();
        if (this.usingMockData || this.useMockData) {
          this.mockDataWarningMessage = this.purchaseOrderService.getBackendUnavailableMessage();
        }
        
        // Forcer l'activation du formulaire pour les nouvelles commandes
        if (this.isNewOrder) {
          console.log('Activation du formulaire après chargement des données');
          this.orderForm.enable();
          // Activer spécifiquement le champ supplierId
          const supplierIdControl = this.orderForm.get('supplierId');
          if (supplierIdControl) {
            supplierIdControl.enable();
            console.log('Champ supplierId activé explicitement');
          }
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement de la commande:', error);
        this.showErrorMessage('Impossible de charger la commande. ' + error.message);
      }
    });
  }

  /**
   * Initialise le formulaire
   */
  initForm(): void {
    this.orderForm = this.fb.group({
      supplierId: ['', Validators.required],
      orderDate: [new Date().toISOString().split('T')[0], Validators.required],
      expectedDeliveryDate: [''],
      status: ['DRAFT', Validators.required],
      notes: [''],
      items: this.fb.array([])
    });
  }

  /**
   * Convertit un produit du format service vers le format modèle utilisé par ce composant
   */
  private convertToModelProduct(serviceProduct: any): Product {
    return {
      id: serviceProduct.id ? String(serviceProduct.id) : '',
      name: serviceProduct.name || '',
      description: serviceProduct.description || '',
      price: serviceProduct.price || 0,
      category: serviceProduct.category ? {
        id: serviceProduct.category.id ? String(serviceProduct.category.id) : '',
        name: serviceProduct.category.name || ''
      } : undefined,
      sku: serviceProduct.sku || serviceProduct.reference || '',
      quantity: serviceProduct.quantity || 0
    };
  }

  /**
   * Charge une commande d'achat par son ID
   * @param id ID de la commande à charger
   */
  loadOrderById(id: string): void {
    this.isLoading = true;
    this.purchaseOrderService.getPurchaseOrderById(id).subscribe({
      next: (order) => {
        this.orderId = id;
        this.populateForm(order);
        this.isLoading = false;
        this.usingMockData = !this.purchaseOrderService.isBackendAvailable();
        if (this.usingMockData) {
          this.mockDataWarningMessage = this.purchaseOrderService.getBackendUnavailableMessage();
        }
        // Charger les données de référence après avoir chargé la commande
        this.loadReferenceData();
      },
      error: (error) => {
        console.error('Erreur lors du chargement de la commande:', error);
        this.isLoading = false;
        this.showErrorMessage('Impossible de charger la commande demandée');
      }
    });
  }

  /**
   * Met à jour le statut du backend et affiche un message si nécessaire
   */
  updateBackendStatus(): void {
    this.usingMockData = !this.purchaseOrderService.isBackendAvailable();
    if (this.usingMockData) {
      this.mockDataWarningMessage = this.purchaseOrderService.getBackendUnavailableMessage();
    } else {
      this.mockDataWarningMessage = '';
    }
  }

  /**
   * Charge les données de référence (produits, fournisseurs)
   */
  loadReferenceData(): void {
    this.isLoading = true;
    console.log('Chargement des données de référence...');
    
    // Si on force l'utilisation des données fictives, charger directement les données mockées
    if (this.useMockData) {
      console.log('Mode données fictives activé, chargement direct des données fictives');
      this.loadMockData();
      this.isLoading = false;
      return;
    }
    
    forkJoin({
      products: this.productService.getProducts(true).pipe(
        map(products => products.map(p => this.convertToModelProduct(p))),
        catchError(err => {
          console.error('Erreur lors du chargement des produits:', err);
          return of([]);
        })
      ),
      suppliers: this.loadSuppliers().pipe(catchError(err => {
        console.error('Erreur lors du chargement des fournisseurs:', err);
        return of([]);
      }))
    }).subscribe({
      next: (data) => {
        console.log('Données de référence chargées:', data);
        
        // Vérifier si les données sont vides
        if (data.products.length === 0 || data.suppliers.length === 0) {
          console.warn('Données de référence vides ou incomplètes, utilisation des données fictives');
          this.loadMockData();
        } else {
          this.products = data.products;
          this.suppliers = data.suppliers;
        }
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des données de référence:', error);
        // Utiliser des données de sauvegarde en cas d'erreur (mode dégradé)
        this.loadMockData();
        // Montrer un message d'avertissement au lieu d'une erreur
        this.showWarningMessage('Connexion au serveur impossible. Utilisation de données fictives.');
        this.isLoading = false;
      }
    });
  }

  /**
   * Charge la liste des fournisseurs
   * Note: Ceci est un mock, à remplacer par un vrai service
   */
  loadSuppliers(): Observable<Supplier[]> {
    // Simuler un appel API pour récupérer les fournisseurs
    return of([
      { id: '1', name: 'Fournisseur A', email: 'contact@fournisseura.com', phone: '0123456789', address: '123 Rue des Fournisseurs, Paris' },
      { id: '2', name: 'Fournisseur B', email: 'contact@fournisseurb.com', phone: '0123456790', address: '456 Avenue des Distributeurs, Lyon' },
    ]);
  }

  /**
   * Charge des données fictives pour les tests
   */
  loadMockData(): void {
    console.log('Chargement des données fictives...');
    
    // Générer des fournisseurs fictifs
    this.suppliers = [
      { id: 'sup-1', name: 'Tech Distributors', email: 'contact@techdist.com', phone: '123-456-7890', address: '123 Tech St' },
      { id: 'sup-2', name: 'Office Supplies Inc', email: 'info@officesupplies.com', phone: '234-567-8901', address: '456 Office Blvd' },
      { id: 'sup-3', name: 'Global Imports', email: 'sales@globalimports.com', phone: '345-678-9012', address: '789 Import Ave' },
      { id: 'sup-4', name: 'Tech Dalibaba', email: 'tech@dalibaba.com', phone: '456-789-0123', address: '101 Tech Blvd' },
      { id: 'sup-5', name: 'Hardware Express', email: 'info@hwexpress.com', phone: '567-890-1234', address: '202 Hardware St' }
    ];
    
    // Générer des produits fictifs
    this.products = [
      { id: 'prod-1', name: 'Laptop Dell XPS 13', sku: 'DELL-XPS13', price: 1299.99, description: 'Laptop haut de gamme', category: { id: 'cat1', name: 'Informatique' }, quantity: 15 },
      { id: 'prod-2', name: 'Écran 27" 4K', sku: 'SCREEN-4K27', price: 349.99, description: 'Écran 4K 27 pouces', category: { id: 'cat1', name: 'Informatique' }, quantity: 23 },
      { id: 'prod-3', name: 'Clavier sans fil', sku: 'KB-WIRELESS', price: 59.99, description: 'Clavier ergonomique sans fil', category: { id: 'cat5', name: 'Accessoires' }, quantity: 42 },
      { id: 'prod-4', name: 'Souris Bluetooth', sku: 'MOUSE-BT', price: 29.99, description: 'Souris Bluetooth portable', category: { id: 'cat5', name: 'Accessoires' }, quantity: 50 },
      { id: 'prod-5', name: 'Disque dur externe 1TB', sku: 'HDD-EXT-1TB', price: 79.99, description: 'Disque dur externe 1TB USB 3.0', category: { id: 'cat6', name: 'Stockage' }, quantity: 18 },
      { id: 'prod-6', name: 'Imprimante laser', sku: 'PRINT-LASER', price: 199.99, description: 'Imprimante laser noir et blanc', category: { id: 'cat2', name: 'Périphériques' }, quantity: 7 },
      { id: 'prod-7', name: 'Cartouches d\'encre', sku: 'INK-CART', price: 45.99, description: 'Pack de cartouches d\'encre', category: { id: 'cat2', name: 'Périphériques' }, quantity: 35 },
      { id: 'prod-8', name: 'Routeur WiFi', sku: 'WIFI-ROUTER', price: 89.99, description: 'Routeur WiFi haut débit', category: { id: 'cat4', name: 'Réseau' }, quantity: 12 },
      { id: 'prod-9', name: 'Câble HDMI 2m', sku: 'CABLE-HDMI-2M', price: 12.99, description: 'Câble HDMI 2m haute qualité', category: { id: 'cat5', name: 'Accessoires' }, quantity: 60 },
      { id: 'prod-10', name: 'Webcam HD', sku: 'CAM-HD', price: 49.99, description: 'Webcam HD 1080p', category: { id: 'cat5', name: 'Accessoires' }, quantity: 20 },
      { id: 'prod-11', name: 'Casque audio sans fil', sku: 'AUDIO-WIRELESS', price: 129.99, description: 'Casque audio Bluetooth avec réduction de bruit', category: { id: 'cat3', name: 'Audio' }, quantity: 25 },
      { id: 'prod-12', name: 'Batterie externe 20000mAh', sku: 'POWER-20K', price: 39.99, description: 'Batterie externe haute capacité', category: { id: 'cat5', name: 'Accessoires' }, quantity: 30 },
      { id: 'prod-13', name: 'Clé USB 128GB', sku: 'USB-128GB', price: 24.99, description: 'Clé USB 3.0 haute vitesse', category: { id: 'cat6', name: 'Stockage' }, quantity: 45 },
      { id: 'prod-14', name: 'Adaptateur USB-C vers HDMI', sku: 'ADAPT-C-HDMI', price: 19.99, description: 'Adaptateur multiport', category: { id: 'cat5', name: 'Accessoires' }, quantity: 22 },
      { id: 'prod-15', name: 'Tapis de souris ergonomique', sku: 'MOUSE-PAD-ERGO', price: 14.99, description: 'Tapis de souris avec repose-poignet', category: { id: 'cat5', name: 'Accessoires' }, quantity: 38 }
    ];
    
    // Initialiser les produits filtrés
    // Préparer les produits pour la recherche
    this.filteredProducts = [...this.products];
    console.log('Produits filtrés prêts pour la recherche:', this.filteredProducts);
  }

  /**
   * Remplit le formulaire avec les données de la commande
   */
  populateForm(order: PurchaseOrder): void {
    // Réinitialiser le formulaire des items
    this.items.clear();
    
    // Remplir le formulaire principal
    this.orderForm.patchValue({
      supplierId: order.supplierId,
      orderDate: order.orderDate instanceof Date ? order.orderDate.toISOString().split('T')[0] : order.orderDate.toString().split('T')[0],
      expectedDeliveryDate: order.expectedDeliveryDate ? (order.expectedDeliveryDate instanceof Date ? order.expectedDeliveryDate.toISOString().split('T')[0] : order.expectedDeliveryDate.toString().split('T')[0]) : '',
      status: order.status,
      notes: order.notes || ''
    });
    
    // Ajouter les items
    if (order.items && order.items.length > 0) {
      order.items.forEach(item => {
        this.addItem(item);
      });
    }
    
    // Désactiver le formulaire en mode lecture seule, sinon s'assurer qu'il est activé
    if (this.isReadOnly) {
      this.orderForm.disable();
    } else {
      // S'assurer que le formulaire est activé en mode création ou édition
      this.orderForm.enable();
      console.log('Formulaire activé en mode création/édition');
    }
  }

  /**
   * Getter pour accéder au FormArray des items
   */
  get items(): FormArray {
    return this.orderForm.get('items') as FormArray;
  }

  /**
   * Ajoute un item à la commande
   */
  addItem(item?: PurchaseOrderItem): void {
    console.log('Début de addItem avec:', item);
    
    if (!item) {
      console.error('Tentative d\'ajout d\'un article null ou undefined');
      return;
    }
    
    try {
      const itemForm = this.fb.group({
        id: [item.id || null],
        productId: [item.productId || '', Validators.required],
        productName: [item.productName || '', Validators.required],
        quantity: [item.quantity || 1, [Validators.required, Validators.min(1)]],
        unitPrice: [item.unitPrice || 0, [Validators.required, Validators.min(0)]],
        total: [item.total || 0],
        product: [item.product || null]
      });
      
      // Calculer le total automatiquement quand la quantité ou le prix change
      itemForm.get('quantity')?.valueChanges.subscribe(() => this.calculateItemTotal(itemForm));
      itemForm.get('unitPrice')?.valueChanges.subscribe(() => this.calculateItemTotal(itemForm));
      
      // Calculer le total initial
      this.calculateItemTotal(itemForm);
      
      console.log('Ajout de l\'article au formulaire:', itemForm.value);
      this.items.push(itemForm);
      this.calculateOrderTotal();
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'article:', error);
      this.showErrorMessage('Erreur lors de l\'ajout de l\'article');
    }
  }

  /**
   * Supprime un item de la commande
   */
  removeItem(index: number): void {
    this.items.removeAt(index);
    this.calculateOrderTotal();
  }

  /**
   * Calcule le total d'un item
   */
  calculateItemTotal(itemForm: FormGroup): void {
    const quantity = itemForm.get('quantity')?.value || 0;
    const unitPrice = itemForm.get('unitPrice')?.value || 0;
    const total = quantity * unitPrice;
    
    itemForm.patchValue({ total }, { emitEvent: false });
    this.calculateOrderTotal();
  }

  /**
   * Calcule le total de la commande
   */
  calculateOrderTotal(): number {
    let total = 0;
    
    for (let i = 0; i < this.items.length; i++) {
      const itemForm = this.items.at(i) as FormGroup;
      total += itemForm.get('total')?.value || 0;
    }
    
    return total;
  }

  /**
   * Ouvre la recherche de produits
   */
  openProductSearch(): void {
    console.log('Ouverture de la recherche de produits...');
    
    // S'assurer que le formulaire est activé avant d'ajouter des articles
    if (this.orderForm.disabled) {
      console.log('Formulaire désactivé, activation avant recherche de produits');
      this.orderForm.enable();
    }
    
    // Forcer le mode données fictives
    this.useMockData = true;
    this.usingMockData = true;
    
    // Forcer le chargement des produits
    console.log('Chargement forcé des produits fictifs...');
    this.isLoading = true;
    
    // Générer des données fictives
    console.log('Génération de données fictives pour la recherche de produits');
    this.loadMockData();
    
    // Afficher la fenêtre de recherche
    this.isLoading = false;
    this.showProductSearch = true;
    
    // Afficher tous les produits sans filtrage
    this.filteredProducts = [...this.products];
    console.log(`${this.filteredProducts.length} produits fictifs disponibles pour la recherche:`, this.filteredProducts);
  }

  /**
   * Ferme la recherche de produits
   */
  closeProductSearch(): void {
    this.showProductSearch = false;
  }

  /**
   * Filtre les produits selon le terme de recherche
   */
  filterProducts(): void {
    console.log(`Filtrage des produits avec le terme: "${this.productSearchTerm}"`);
    console.log('Nombre total de produits disponibles:', this.products.length);
    
    // Si aucun produit n'est disponible, essayer de les recharger
    if (this.products.length === 0) {
      console.log('Aucun produit disponible pour le filtrage, tentative de rechargement...');
      this.productService.getProducts(true).pipe(
        map(products => products.map(p => this.convertToModelProduct(p)))
      ).subscribe({
        next: (products: Product[]) => {
          console.log(`${products.length} produits rechargés`);
          this.products = products;
          this.applyProductFilter();
        },
        error: (error) => {
          console.error('Erreur lors du rechargement des produits:', error);
        }
      });
      return;
    }
    
    this.applyProductFilter();
  }
  


  /**
   * Applique le filtre sur la liste des produits
   */
  private applyProductFilter(): void {
    if (!this.productSearchTerm || !this.productSearchTerm.trim()) {
      this.filteredProducts = [...this.products];
      console.log(`Aucun terme de recherche, affichage de tous les produits (${this.filteredProducts.length})`);
      return;
    }
    
    const searchTerm = this.productSearchTerm.toLowerCase().trim();
    
    this.filteredProducts = this.products.filter(product => {
      const nameMatch = product.name && product.name.toLowerCase().includes(searchTerm);
      const descMatch = product.description && product.description.toLowerCase().includes(searchTerm);
      const catMatch = product.category && product.category.name && 
                      product.category.name.toLowerCase().includes(searchTerm);
      const refMatch = product.sku && product.sku.toLowerCase().includes(searchTerm);
      
      return nameMatch || descMatch || catMatch || refMatch;
    });
    
    console.log(`Filtrage terminé: ${this.filteredProducts.length} produits correspondent au terme "${searchTerm}"`);
  }

  /**
   * Sélectionne un produit et l'ajoute à la commande
   */
  selectProduct(product: Product): void {
    console.log('Produit sélectionné:', product);
    
    // Vérifier que le produit est valide
    if (!product || !product.name) {
      console.error('Produit invalide:', product);
      return;
    }
    
    const newItem: PurchaseOrderItem = {
      productId: product.id,
      productName: product.name,
      quantity: 1,
      unitPrice: product.price || 0,
      total: product.price || 0,
      product: this.convertToOrderProduct(product)
    };
    
    console.log('Nouvel article créé:', newItem);
    
    // S'assurer que le formulaire est activé avant d'ajouter l'article
    if (this.orderForm.disabled) {
      console.log('Formulaire désactivé, activation avant ajout d\'article');
      this.orderForm.enable();
    }
    
    // Ajouter l'article et afficher un message de confirmation
    this.addItem(newItem);
    this.showSuccessMessage(`Article "${product.name}" ajouté à la commande`);
    this.closeProductSearch();
  }
  
  /**
   * Convertit un produit du modèle en produit du modèle de commande
   */
  convertToOrderProduct(product: Product): Product {
    console.log('Conversion du produit:', product);
    if (!product) {
      console.error('Tentative de conversion d\'un produit null ou undefined');
      return {
        id: '',
        name: '',
        price: 0
      };
    }
    
    const convertedProduct: Product = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      sku: product.sku,
      quantity: product.quantity,
      category: product.category
      // Suppression de la propriété imageUrl qui n'existe pas dans l'interface Product
    };
    
    return convertedProduct;
  }

  /**
   * Enregistre la commande
   */
  saveOrder(): void {
    if (this.orderForm.invalid) {
      this.markFormGroupTouched(this.orderForm);
      this.showErrorMessage('Veuillez corriger les erreurs dans le formulaire');
      return;
    }
    
    this.isLoading = true;
    
    // Réinitialiser les messages
    this.mockDataWarningMessage = null;
    
    const formValue = this.orderForm.getRawValue();
    
    // Construire l'objet commande
    const order: PurchaseOrder = {
      ...formValue,
      total: this.calculateOrderTotal()
    };
    
    // Ajouter les informations du fournisseur
    const selectedSupplier = this.suppliers.find(s => s.id === order.supplierId);
    if (selectedSupplier) {
      order.supplierName = selectedSupplier.name;
      order.supplierEmail = selectedSupplier.email;
      order.supplierAddress = selectedSupplier.address;
    }
    
    const saveOperation = this.isNewOrder 
      ? this.purchaseOrderService.createPurchaseOrder(order)
      : this.purchaseOrderService.updatePurchaseOrder(this.orderId!, order);
    
    saveOperation.pipe(
      finalize(() => this.isLoading = false)
    ).subscribe({
      next: (savedOrder) => {
        this.isLoading = false;
        this.isNewOrder = false;
        this.orderId = savedOrder.id || null;
        this.populateForm(savedOrder);
        
        // Vérifier si nous utilisons des données fictives après la sauvegarde
        this.usingMockData = !this.purchaseOrderService.isBackendAvailable();
        if (this.usingMockData || this.useMockData) {
          this.mockDataWarningMessage = this.purchaseOrderService.getBackendUnavailableMessage();
          this.showSuccessMessage('Commande enregistrée avec succès (mode démo)');
        } else {
          this.showSuccessMessage('Commande enregistrée avec succès');
        }
      },
      error: (error) => {
        console.error('Erreur lors de l\'enregistrement de la commande:', error);
        this.showErrorMessage('Erreur lors de l\'enregistrement de la commande: ' + error.message);
      }
    });
  }

  /**
   * Met à jour le statut de la commande
   */
  updateStatus(status: PurchaseOrderStatus): void {
    if (!this.orderId) return;
    
    this.isLoading = true;
    
    this.purchaseOrderService.updatePurchaseOrderStatus(this.orderId, status).pipe(
      finalize(() => this.isLoading = false)
    ).subscribe({
      next: (updatedOrder) => {
        this.orderForm.patchValue({ status: updatedOrder.status });
        this.showSuccessMessage(`Statut mis à jour: ${this.getStatusLabel(updatedOrder.status)}`);
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour du statut:', error);
        this.showErrorMessage('Erreur lors de la mise à jour du statut: ' + error.message);
      }
    });
  }

  /**
   * Génère un PDF de la commande
   */
  generatePdf(): void {
    if (!this.orderId) return;
    
    this.isLoading = true;
    
    this.purchaseOrderService.generatePdf(this.orderId).pipe(
      finalize(() => this.isLoading = false)
    ).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `commande-${this.orderId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.showSuccessMessage('PDF généré avec succès');
      },
      error: (error) => {
        console.error('Erreur lors de la génération du PDF:', error);
        this.showErrorMessage('Erreur lors de la génération du PDF: ' + error.message);
      }
    });
  }

  /**
   * Envoie la commande par email
   */
  sendByEmail(): void {
    if (!this.orderId) return;
    
    const supplierEmail = this.orderForm.get('supplierEmail')?.value;
    
    if (!supplierEmail) {
      this.showErrorMessage('Adresse email du fournisseur manquante');
      return;
    }
    
    this.isLoading = true;
    
    this.purchaseOrderService.sendPurchaseOrderByEmail(
      this.orderId,
      supplierEmail,
      'Commande d\'achat',
      'Veuillez trouver ci-joint notre commande d\'achat.'
    ).pipe(
      finalize(() => this.isLoading = false)
    ).subscribe({
      next: () => {
        this.showSuccessMessage('Commande envoyée par email avec succès');
        this.updateStatus('SENT');
      },
      error: (error) => {
        console.error('Erreur lors de l\'envoi de la commande par email:', error);
        this.showErrorMessage('Erreur lors de l\'envoi de la commande par email: ' + error.message);
      }
    });
  }

  /**
   * Annule les modifications et retourne à la liste
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
      } else if (control instanceof FormArray) {
        for (let i = 0; i < control.length; i++) {
          const arrayControl = control.at(i);
          if (arrayControl instanceof FormGroup) {
            this.markFormGroupTouched(arrayControl);
          } else {
            arrayControl.markAsTouched();
          }
        }
      }
    });
  }

  /**
   * Affiche un message de succès
   */
  showSuccessMessage(message: string): void {
    console.log('Message de succès:', message);
    this.successMessage = message;
    this.errorMessage = null;
    
    // Effacer tout timer précédent
    if (this.successMessageTimeout) {
      clearTimeout(this.successMessageTimeout);
    }
    
    // Configurer un nouveau timer pour effacer le message après 3 secondes
    this.successMessageTimeout = setTimeout(() => {
      this.successMessage = null;
    }, 3000);
  }

  /**
   * Affiche un message d'erreur
   */
  showErrorMessage(message: string): void {
    console.log('Message d\'erreur:', message);
    this.errorMessage = message;
    this.warningMessage = null;
    this.successMessage = null;
    
    // Effacer tout timer précédent
    if (this.errorMessageTimeout) {
      clearTimeout(this.errorMessageTimeout);
    }
    
    // Configurer un nouveau timer pour effacer le message après 5 secondes
    this.errorMessageTimeout = setTimeout(() => {
      this.errorMessage = null;
    }, 5000);
  }

  /**
   * Active ou désactive le mode données fictives
   */
  public toggleMockData(): void {
    this.useMockData = !this.useMockData;
    this.purchaseOrderService.setForceMockData(this.useMockData);
    
    // Mettre à jour le message d'avertissement
    if (this.useMockData) {
      this.mockDataWarningMessage = this.purchaseOrderService.getBackendUnavailableMessage();
      // Forcer le chargement des données fictives
      console.log('Chargement forcé des données fictives');
      this.loadMockData();
      this.showSuccessMessage('Mode données fictives activé');
    } else {
      this.mockDataWarningMessage = null;
      // Recharger les données réelles
      this.loadReferenceData();
      this.showSuccessMessage('Mode données fictives désactivé');
    }
  }

  /**
   * Affiche un message d'avertissement temporaire
   */
  showWarningMessage(message: string): void {
    console.log('Message d\'avertissement:', message);
    this.warningMessage = message;
    
    // Effacer tout timer précédent
    if (this.warningMessageTimeout) {
      clearTimeout(this.warningMessageTimeout);
    }
    
    // Configurer un nouveau timer pour effacer le message après 7 secondes
    this.warningMessageTimeout = setTimeout(() => {
      this.warningMessage = null;
    }, 7000);
  }

  /**
   * Retourne le libellé pour un statut donné
   */
  getStatusLabel(status: string): string {
    switch (status) {
      case 'DRAFT':
        return 'Brouillon';
      case 'SENT':
        return 'Envoyée';
      case 'CONFIRMED':
        return 'Confirmée';
      case 'DELIVERED':
        return 'Livrée';
      case 'CANCELLED':
        return 'Annulée';
      default:
        return status;
    }
  }

  /**
   * Vérifie si un contrôle est invalide et touché
   */
  isInvalid(controlName: string): boolean {
    const control = this.orderForm.get(controlName);
    return control ? control.invalid && control.touched : false;
  }

  /**
   * Vérifie si un contrôle d'un item est invalide et touché
   */
  isItemInvalid(index: number, controlName: string): boolean {
    const control = (this.items.at(index) as FormGroup).get(controlName);
    return control ? control.invalid && control.touched : false;
  }

  /**
   * Vérifie si le statut actuel permet une action spécifique
   */
  canChangeStatusTo(status: PurchaseOrderStatus): boolean {
    const currentStatus = this.orderForm.get('status')?.value;
    
    switch (status) {
      case 'SENT':
        return currentStatus === 'DRAFT';
      case 'CONFIRMED':
        return currentStatus === 'SENT';
      case 'DELIVERED':
        return currentStatus === 'CONFIRMED';
      case 'CANCELLED':
        return ['DRAFT', 'SENT', 'CONFIRMED'].includes(currentStatus);
      default:
        return false;
    }
  }
}
