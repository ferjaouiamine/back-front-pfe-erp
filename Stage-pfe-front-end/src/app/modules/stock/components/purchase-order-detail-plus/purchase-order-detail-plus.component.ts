import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, AbstractControl, Validators, ValidatorFn, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, forkJoin, Observable, of } from 'rxjs';
import { catchError, finalize, map, switchMap, delay } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
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
    private http: HttpClient
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
        this.showErrorMessage('Erreur lors du chargement des fournisseurs: ' + error.message);
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
          this.showWarningMessage('Aucun produit disponible. Essayez d\'activer les données fictives.');
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement des produits:', error);
        this.showErrorMessage('Erreur lors du chargement des produits: ' + error.message);
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
          this.showWarningMessage('Aucun produit disponible pour ce fournisseur. Essayez d\'activer les données fictives.');
        }
      },
      error: (error) => {
        this.showErrorMessage('Erreur lors du chargement des produits: ' + error.message);
        
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
   * Charge une commande par son ID
   */
  loadOrderById(id: string): void {
    this.isLoading = true;
    console.log('Chargement de la commande avec ID:', id);
    
    // Récupérer directement les données brutes du backend pour les examiner
    this.http.get(`http://localhost:8088/api/commandes/${id}`).subscribe({
      next: (rawData: any) => {
        console.log('DONNÉES BRUTES du backend pour la commande', id, ':', rawData);
        console.log('STRUCTURE JSON COMPLÈTE:', JSON.stringify(rawData, null, 2));
        
        // Examiner la structure des données pour trouver les articles
        console.log(`Type de données reçues:`, typeof rawData);
        const keys = Object.keys(rawData);
        console.log(`Clés disponibles dans la réponse:`, keys);
        
        // Vérifier les propriétés qui pourraient contenir des articles
        this.debugArticlesProperty(rawData, 'lignes');
        this.debugArticlesProperty(rawData, 'lignesCommande');
        this.debugArticlesProperty(rawData, 'articles');
        
        // Continuer avec le traitement normal
        this.purchaseOrderService.getPurchaseOrderById(id).subscribe({
          next: (order) => {
            console.log('Commande récupérée via le service:', order);
            console.log('Nombre de produits dans la commande:', order.items?.length || 0);
            
            // Vérifier si les articles sont présents et leur structure
            if (order.items && order.items.length > 0) {
              console.log('Articles trouvés dans la commande:');
              order.items.forEach((item, index) => {
                console.log(`Article ${index + 1}:`, item);
              });
            } else {
              console.warn('Aucun article trouvé dans la commande!');
              
              // Vérifier si la commande contient d'autres propriétés qui pourraient contenir les articles
              const orderKeys = Object.keys(order);
              console.log('Propriétés disponibles dans la commande:', orderKeys);
              
              // Récupérer les articles depuis les propriétés non mappées si nécessaire
              let articlesRecuperes = false;
              
              // Vérifier si la commande a des propriétés non mappées
              if ((order as any).lignes && Array.isArray((order as any).lignes) && (order as any).lignes.length > 0) {
                console.log('Propriété "lignes" trouvée avec', (order as any).lignes.length, 'éléments');
                // Convertir les lignes en articles pour le modèle
                order.items = (order as any).lignes.map((ligne: any) => ({
                  id: ligne.id?.toString(),
                  productId: ligne.produit?.id?.toString(),
                  productName: ligne.produit?.nom ?? ligne.designation,
                  quantity: ligne.quantite ?? 0,
                  unitPrice: ligne.prixUnitaire ?? 0,
                  total: ligne.montantHT ?? (ligne.quantite * ligne.prixUnitaire) ?? 0
                }));
                articlesRecuperes = true;
                console.log('Articles récupérés depuis la propriété "lignes":', order.items);
              } else if ((order as any).lignesCommande && Array.isArray((order as any).lignesCommande) && (order as any).lignesCommande.length > 0) {
                console.log('Propriété "lignesCommande" trouvée avec', (order as any).lignesCommande.length, 'éléments');
                // Convertir les lignesCommande en articles pour le modèle
                order.items = (order as any).lignesCommande.map((ligne: any) => ({
                  id: ligne.id?.toString(),
                  productId: ligne.produit?.id?.toString(),
                  productName: ligne.produit?.nom ?? ligne.designation,
                  quantity: ligne.quantite ?? 0,
                  unitPrice: ligne.prixUnitaire ?? 0,
                  total: ligne.montantHT ?? (ligne.quantite * ligne.prixUnitaire) ?? 0
                }));
                articlesRecuperes = true;
                console.log('Articles récupérés depuis la propriété "lignesCommande":', order.items);
              } else {
                // Essayer de récupérer les articles directement depuis les données brutes
                if (rawData) {
                  if (Array.isArray(rawData.lignes) && rawData.lignes.length > 0) {
                    console.log('Récupération des articles depuis les données brutes (lignes)');
                    order.items = rawData.lignes.map((ligne: any) => ({
                      id: ligne.id?.toString(),
                      productId: ligne.produit?.id?.toString(),
                      productName: ligne.produit?.nom ?? ligne.designation,
                      quantity: ligne.quantite ?? 0,
                      unitPrice: ligne.prixUnitaire ?? 0,
                      total: ligne.montantHT ?? (ligne.quantite * ligne.prixUnitaire) ?? 0
                    }));
                    articlesRecuperes = true;
                  } else if (Array.isArray(rawData.lignesCommande) && rawData.lignesCommande.length > 0) {
                    console.log('Récupération des articles depuis les données brutes (lignesCommande)');
                    order.items = rawData.lignesCommande.map((ligne: any) => ({
                      id: ligne.id?.toString(),
                      productId: ligne.produit?.id?.toString(),
                      productName: ligne.produit?.nom ?? ligne.designation,
                      quantity: ligne.quantite ?? 0,
                      unitPrice: ligne.prixUnitaire ?? 0,
                      total: ligne.montantHT ?? (ligne.quantite * ligne.prixUnitaire) ?? 0
                    }));
                    articlesRecuperes = true;
                  } else if (Array.isArray(rawData.articles) && rawData.articles.length > 0) {
                    console.log('Récupération des articles depuis les données brutes (articles)');
                    order.items = rawData.articles.map((article: any) => ({
                      id: article.id?.toString(),
                      productId: article.produit?.id?.toString() || article.productId?.toString(),
                      productName: article.produit?.nom ?? article.designation ?? article.productName,
                      quantity: article.quantite ?? article.quantity ?? 0,
                      unitPrice: article.prixUnitaire ?? article.unitPrice ?? 0,
                      total: article.montantHT ?? article.total ?? (article.quantite * article.prixUnitaire) ?? 0
                    }));
                    articlesRecuperes = true;
                  }
                }
              }
              
              if (articlesRecuperes) {
                console.log('Nombre d\'articles récupérés après correction:', order.items.length);
              } else {
                console.warn('Aucune propriété alternative contenant des articles n\'a été trouvée');
                // Initialiser un tableau vide si aucun article n'a été trouvé
                order.items = [];
              }
            }
            
            this.patchFormWithOrder(order);
          },
          error: (error: any) => {
            console.error('Erreur détaillée lors du chargement de la commande via le service:', error);
            this.showErrorMessage('Erreur lors du chargement de la commande: ' + error.message);
            this.isLoading = false;
          }
        });
      },
      error: (error: any) => {
        console.error('Erreur lors de la récupération des données brutes:', error);
        // Continuer avec le service normal en cas d'erreur
        this.continueWithNormalService(id);
      }
    });
  }
  
  /**
   * Méthode de débogage pour examiner une propriété qui pourrait contenir des articles
   */
  private debugArticlesProperty(data: any, propertyName: string): void {
    if (data[propertyName]) {
      console.log(`La propriété '${propertyName}' contient:`, data[propertyName]);
      console.log(`Type de '${propertyName}':`, typeof data[propertyName]);
      if (Array.isArray(data[propertyName])) {
        console.log(`Nombre d'éléments dans '${propertyName}':`, data[propertyName].length);
        if (data[propertyName].length > 0) {
          console.log(`Premier élément de '${propertyName}':`, data[propertyName][0]);
          if (data[propertyName][0].produit) {
            console.log(`Détails du produit dans le premier élément:`, data[propertyName][0].produit);
          }
        }
      }
    } else {
      console.log(`La propriété '${propertyName}' n'existe pas dans les données.`);
    }
  }
  
  /**
   * Continuer avec le service normal en cas d'erreur lors de la récupération des données brutes
   */
  private continueWithNormalService(id: string): void {
    this.purchaseOrderService.getPurchaseOrderById(id).subscribe({
      next: (order) => {
        console.log('Commande récupérée via le service:', order);
        this.patchFormWithOrder(order);
      },
      error: (error: any) => {
        console.error('Erreur détaillée lors du chargement de la commande:', error);
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
    console.log('Mise à jour du formulaire avec les données de la commande:', order);
    
    // Vider le tableau d'articles existant
    while (this.items.length > 0) {
      this.items.removeAt(0);
    }
    
    // Vérifier si la commande contient des articles
    if (!order.items || order.items.length === 0) {
      console.warn('La commande ne contient aucun article!');
    } else {
      console.log('Nombre d\'articles dans la commande:', order.items.length);
      
      // Ajouter les articles de la commande
      order.items.forEach((item, index) => {
        console.log(`Ajout de l'article ${index + 1}:`, item);
        this.addItem(item);
      });
    }
    
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
    if (!itemData) {
      this.showErrorMessage('Données d\'article invalides');
      return;
    }
    
    try {
      console.log('Ajout d\'article depuis le composant de création:', itemData);
      
      // Vérifier si le produit est déjà dans la commande
      const existingItemIndex = this.findExistingItemIndex(itemData.productId);
      
      if (existingItemIndex !== -1) {
        // Si le produit existe déjà, mettre à jour sa quantité
        const existingItem = this.items.at(existingItemIndex);
        const currentQuantity = existingItem.get('quantity')?.value || 0;
        const newQuantity = currentQuantity + itemData.quantity;
        
        existingItem.patchValue({ 
          quantity: newQuantity,
          unitPrice: itemData.unitPrice // Mettre à jour le prix unitaire avec le dernier prix
        });
        
        this.showSuccessMessage(`Quantité de "${itemData.productName}" mise à jour à ${newQuantity}.`);
      } else {
        // Sinon, ajouter un nouvel article
        this.addItem({
          productId: itemData.productId,
          productName: itemData.productName,
          quantity: itemData.quantity,
          unitPrice: itemData.unitPrice,
          total: itemData.total
        });
        
        this.showSuccessMessage(`"${itemData.productName}" ajouté à la commande.`);
      }
      
      // Recalculer le total de la commande
      this.calculateOrderTotal();
      
      // Mettre à jour la liste des commandes
      this.updateOrdersList();
      
      // Fermer la recherche de produits
      this.closeProductSearch();
    } catch (error: any) {
      console.error('Erreur lors de l\'ajout de l\'article:', error);
      this.showErrorMessage(`Erreur lors de l'ajout de l'article: ${error.message || 'Erreur inconnue'}`);
    }
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
      this.showErrorMessage('Produit invalide ou incomplet. Impossible de l\'ajouter à la commande.');
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
        this.showSuccessMessage(`Quantité de "${product.name || 'Article'}" augmentée à ${currentQuantity + 1}.`);
      } else {
        // Sinon, ajouter un nouvel article
        this.addItem({
          productId: product.id.toString(), // Convertir en string pour éviter les erreurs de type
          productName: product.name,
          quantity: 1,
          unitPrice: product.price || 0
        });
        this.showSuccessMessage(`"${product.name || 'Article'}" ajouté à la commande.`);
      }
      
      // Recalculer le total de la commande
      this.calculateOrderTotal();
      
      // Mettre à jour la liste des commandes
      this.updateOrdersList();
      
      // Effacer la recherche après avoir ajouté l'article
      this.clearProductSearch();
    } catch (error: any) {
      console.error('Erreur lors de l\'ajout du produit:', error);
      this.showErrorMessage(`Erreur lors de l'ajout du produit: ${error.message || 'Erreur inconnue'}`);
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
      this.showErrorMessage('Impossible de générer le PDF : identifiant de commande manquant');
      return;
    }
    
    this.isLoading = true;
    this.showWarningMessage('Génération du PDF en cours...');
    
    this.purchaseOrderService.generatePdf(this.orderId)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: (blob: Blob) => {
          // Créer une URL pour le blob
          const url = window.URL.createObjectURL(blob);
          
          // Créer un lien pour télécharger le PDF
          const link = document.createElement('a');
          link.href = url;
          link.download = `commande_${this.orderForm.get('orderNumber')?.value || this.orderId}.pdf`;
          
          // Ajouter le lien au document, cliquer dessus, puis le supprimer
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Ouvrir également dans un nouvel onglet pour prévisualisation
          window.open(url, '_blank');
          
          // Libérer l'URL après un court délai pour permettre l'ouverture de l'onglet
          setTimeout(() => {
            window.URL.revokeObjectURL(url);
          }, 1000);
          
          this.showSuccessMessage('PDF généré avec succès');
        },
        error: (error) => {
          console.error('Erreur lors de la génération du PDF:', error);
          this.showErrorMessage(`Erreur lors de la génération du PDF: ${error.message || 'Erreur inconnue'}`);
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
