import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Facture, FactureItem, FactureService } from '../../services/facture.service';
import { Product as StockProduct, ProductService } from '../../../stock/services/product.service';

interface Product extends StockProduct {
  // Propriétés supplémentaires spécifiques à ce composant si nécessaire
}
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-facture-create',
  templateUrl: './facture-create.component.html',
  styleUrls: ['./facture-create.component.scss']
})
export class FactureCreateComponent implements OnInit {
  facture: Facture;
  factureForm: FormGroup;
  selectedItems: FactureItem[] = [];
  realProducts: Product[] = [];
  mockProducts: Product[] = [];
  displayedProducts: Product[] = [];
  useMockData: boolean = false;
  isLoading: boolean = false;
  isSubmitting: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  isAdminCreating: boolean = false; // Indique si c'est l'administrateur qui crée la facture

  constructor(
    private factureService: FactureService,
    private productService: ProductService,
    private authService: AuthService,
    private formBuilder: FormBuilder,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.facture = this.factureService.createEmptyFacture();
    this.factureForm = this.formBuilder.group({
      clientName: [''],
      clientEmail: ['', [Validators.email]],
      clientAddress: [''],
      clientPhone: [''],
      notes: [''],
      productId: [''],
      quantity: [1, [Validators.required, Validators.min(1)]]
    });
    
    // Vérifier si la facture est créée par l'administrateur
    this.route.queryParams.subscribe(params => {
      this.isAdminCreating = params['source'] === 'admin';
      console.log('Création de facture par admin:', this.isAdminCreating);
    });
  }

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.productService.getAllProductsRealAndMock().subscribe({
      next: (result) => {
        this.realProducts = result.real;
        this.mockProducts = result.mock;
        this.displayedProducts = this.useMockData ? this.mockProducts : this.realProducts;
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = 'Erreur chargement produits.';
        this.mockProducts = this.productService['generateMockProductsFromMySQLStructure']();
        this.displayedProducts = this.mockProducts;
        this.useMockData = true;
        this.isLoading = false;
      }
    });
  }

  toggleProductSource(): void {
    this.useMockData = !this.useMockData;
    this.displayedProducts = this.useMockData ? this.mockProducts : this.realProducts;
  }

  addProductToFacture(): void {
    const productId = this.factureForm.get('productId')?.value;
    const quantity = this.factureForm.get('quantity')?.value || 1;
    
    if (!productId) {
      this.errorMessage = 'Veuillez sélectionner un produit';
      return;
    }

    // Trouver le produit sélectionné dans la liste des produits affichés
    const product = this.displayedProducts.find(p => p.id?.toString() === productId);
    
    if (!product || product.id === undefined) {
      this.errorMessage = 'Produit non trouvé';
      return;
    }

    const productIdStr = product.id.toString();
    
    // Vérifier si le produit est déjà dans la facture
    const existingItem = this.selectedItems.find(item => item.productId === productIdStr);

    if (existingItem) {
      // Mettre à jour la quantité si le produit existe déjà
      existingItem.quantity += quantity;
      existingItem.total = (existingItem.unitPrice || 0) * existingItem.quantity;
      existingItem.tax = (existingItem.total || 0) * 0.2; // 20% de TVA
    } else {
      // Créer une nouvelle ligne de facture
      const newItem: FactureItem = {
        id: Math.random().toString(36).substr(2, 9),
        factureId: '',
        productId: productIdStr,
        productName: product.name || 'Produit sans nom',
        description: product.description || '',
        quantity: quantity,
        unitPrice: product.price || 0,
        total: (product.price || 0) * quantity,
        taxRate: 20, // Taux de TVA par défaut
        tax: (product.price || 0) * quantity * 0.2,
        discount: 0
      };
      this.selectedItems.push(newItem);
    }

    this.updateFactureTotal();
    this.factureForm.get('quantity')?.setValue(1);
    this.factureForm.get('productId')?.setValue('');
    this.errorMessage = null;
  }

  addItem(product: Product): void {
    const quantity = this.factureForm.get('quantity')?.value || 1;
    
    if (product.id === undefined) {
      this.errorMessage = 'ID de produit non défini';
      return;
    }
    
    const productIdStr = product.id.toString();
    const existingItem = this.selectedItems.find(item => item.productId === productIdStr);

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.total = (existingItem.unitPrice || 0) * existingItem.quantity;
      existingItem.tax = (existingItem.total || 0) * 0.2; // 20% de TVA
    } else {
      const newItem: FactureItem = {
        id: Math.random().toString(36).substr(2, 9),
        factureId: '',
        productId: productIdStr,
        productName: product.name || 'Produit sans nom',
        description: product.description || '',
        quantity: quantity,
        unitPrice: product.price || 0,
        total: (product.price || 0) * quantity,
        taxRate: 20, // Taux de TVA par défaut
        tax: (product.price || 0) * quantity * 0.2,
        discount: 0
      };
      this.selectedItems.push(newItem);
    }

    this.updateFactureTotal();
    this.factureForm.get('quantity')?.setValue(1);
  }

  removeProductFromFacture(index: number): void {
    if (index >= 0 && index < this.selectedItems.length) {
      this.selectedItems.splice(index, 1);
      this.updateFactureTotal();
    }
  }

  updateFactureTotal(): void {
    const subtotal = this.selectedItems.reduce((sum, item) => sum + item.total, 0);
    const taxRate = 20;
    const taxAmount = subtotal * (taxRate / 100);

    this.facture.subtotal = subtotal;
    this.facture.tax = taxAmount;
    this.facture.total = subtotal + taxAmount;
    this.facture.items = [...this.selectedItems];
  }

  submitFacture(): void {
    if (this.factureForm.invalid) {
      this.errorMessage = 'Veuillez remplir tous les champs obligatoires';
      return;
    }

    if (this.selectedItems.length === 0) {
      this.errorMessage = 'Veuillez ajouter au moins un produit';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = null;
    this.successMessage = null;

    // Calculer les totaux
    const subtotal = this.selectedItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const taxRate = 20; // Taux de TVA de 20%
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    // Préparer les données pour la création de la facture
    const factureToSend: any = {
      statut: this.isAdminCreating ? 'PENDING' : 'DRAFT', // Si c'est l'admin qui crée, on met directement en attente
      notes: this.factureForm.get('notes')?.value || '',
      remise: 0, // Pas de remise par défaut
      totalHT: subtotal,
      totalTVA: tax,
      totalTTC: total,
      lignes: [], // Les lignes seront ajoutées séparément
      createdBy: this.isAdminCreating ? 'admin' : 'user' // Indiquer qui a créé la facture
    };
    
    // Ajouter les informations client seulement si elles sont fournies
    const clientName = this.factureForm.get('clientName')?.value;
    const clientEmail = this.factureForm.get('clientEmail')?.value;
    const clientAddress = this.factureForm.get('clientAddress')?.value;
    const clientPhone = this.factureForm.get('clientPhone')?.value;
    
    // Si c'est l'administrateur qui crée la facture, les informations client sont obligatoires
    if (this.isAdminCreating && (!clientName || !clientEmail)) {
      this.errorMessage = "Les informations du client sont obligatoires pour une création par l'administrateur";
      this.isSubmitting = false;
      return;
    }
    
    // Vérifier si des informations client significatives ont été fournies
    if (clientName || clientEmail) {
      // Vérifier que l'email est valide s'il est fourni
      if (clientEmail && this.factureForm.get('clientEmail')?.invalid) {
        this.errorMessage = "L'adresse email fournie n'est pas valide";
        this.isSubmitting = false;
        return;
      }
      
      // Ajouter les données client au format attendu par le service Angular
      factureToSend.clientName = clientName || '';
      factureToSend.clientEmail = clientEmail || '';
      factureToSend.clientAddress = clientAddress || '';
      factureToSend.clientPhone = clientPhone || '';
      
      // Ajouter également l'objet client pour la rétrocompatibilité
      factureToSend.client = {
        id: null,
        nom: clientName || '',
        email: clientEmail || '',
        adresse: clientAddress || '',
        telephone: clientPhone || ''
      };
    }
    
    console.log('Création de la facture avec les données:', JSON.stringify(factureToSend, null, 2));
    console.log('Création par administrateur:', this.isAdminCreating);
    
    // Vérifier explicitement les données client
    if (factureToSend.clientName || factureToSend.clientEmail) {
      console.log('Données client détectées:', {
        clientName: factureToSend.clientName,
        clientEmail: factureToSend.clientEmail,
        clientAddress: factureToSend.clientAddress,
        clientPhone: factureToSend.clientPhone
      });
    } else {
      console.warn('Aucune donnée client significative détectée');
    }
    
    // D'abord, créer la facture
    this.factureService.createFacture(factureToSend).subscribe({
      next: (createdFacture: any) => {
        console.log('Facture créée avec succès:', createdFacture);
        
        if (createdFacture && createdFacture.id) {
          // Ensuite, ajouter les lignes de facture une par une
          this.addFactureLines(createdFacture.id, 0);
        } else {
          console.error('ID de facture manquant dans la réponse:', createdFacture);
          this.isSubmitting = false;
          this.errorMessage = 'Erreur: impossible de récupérer l\'ID de la facture créée';
        }
      },
      error: (error) => {
        console.error('Erreur lors de la création de la facture:', error);
        this.isSubmitting = false;
        this.errorMessage = 'Erreur lors de la création de la facture. Veuillez réessayer.';
      }
    });
  }

  // Méthode récursive pour ajouter les lignes de facture une par une
  private addFactureLines(factureId: string, index: number): void {
    if (index >= this.selectedItems.length) {
      // Toutes les lignes ont été ajoutées
      this.isSubmitting = false;
      this.successMessage = 'Facture créée avec succès !';
      setTimeout(() => {
        // Rediriger vers la vue détaillée de la facture dans tous les cas
        if (this.isAdminCreating) {
          // Si c'est l'administrateur, rediriger vers la page de détails de la facture avec un paramètre source
          this.router.navigate(['/facturation', factureId], { queryParams: { source: 'admin' } });
        } else {
          // Sinon, rediriger vers la vue détaillée de la facture dans le module facturation
          this.router.navigate(['/facturation', factureId]);
        }
      }, 1500);
      return;
    }

    const item = this.selectedItems[index];
    
    const ligneFacture = {
      productId: item.productId,
      productName: item.productName,
      description: item.description || '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      price: item.unitPrice,
      taxRate: item.taxRate || 0,
      tax: item.tax || 0,
      discount: item.discount || 0
    };

    this.factureService.ajouterLigneFacture(factureId, ligneFacture).subscribe({
      next: () => {
        console.log(`Ligne ${index + 1} ajoutée avec succès`);
        // Passer à la ligne suivante
        this.addFactureLines(factureId, index + 1);
      },
      error: (error: any) => {
        console.error(`Erreur lors de l'ajout de la ligne ${index + 1}:`, error);
        // Continuer avec la ligne suivante même en cas d'erreur
        this.addFactureLines(factureId, index + 1);
      }
    });
  }

  cancelFacture(): void {
    // Si c'est l'administrateur qui crée la facture, rediriger vers la gestion des factures admin
    if (this.isAdminCreating) {
      this.router.navigate(['/admin/factures']);
    } else {
      // Sinon, rediriger vers la liste des factures
      this.router.navigate(['/facturation']);
    }
  }

  calculateProductTotal(price: number, quantity: number): number {
    return price * quantity;
  }
}
