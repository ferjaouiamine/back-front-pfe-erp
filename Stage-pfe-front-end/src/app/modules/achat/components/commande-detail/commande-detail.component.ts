import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatStepperModule } from '@angular/material/stepper';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { CommandeService, Commande, LigneCommande, StatutCommande, StatutLigne } from '../../services/commande.service';
import { AchatService, Fournisseur } from '../../services/achat.service';
import { ProduitService, Produit } from '../../services/produit.service';
import { saveAs } from 'file-saver';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-commande-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatDividerModule,
    MatChipsModule,
    MatDialogModule,
    MatStepperModule,
    MatExpansionModule,
    MatDividerModule,
    MatSlideToggleModule
  ],
  templateUrl: './commande-detail.component.html',
  styleUrls: ['./commande-detail.component.scss']
})
export class CommandeDetailComponent implements OnInit {
  // Exposer l'énumération pour le template
  StatutCommande = StatutCommande;
  StatutLigne = StatutLigne;
  
  commandeId: number | null = null;
  commande: Commande | null = null;
  commandeForm: FormGroup;
  fournisseurs: Fournisseur[] = [];
  useEmailMode = false; // Mode pour utiliser l'email du fournisseur au lieu de sélectionner un fournisseur existant
  fournisseurEmail = ''; // Email du fournisseur si on utilise le mode email
  produitsLowStock: Produit[] = [];
  loading = true;
  saving = false;
  error: string | null = null;
  mode: 'view' | 'edit' | 'create' = 'view';
  
  // Colonnes pour le tableau des lignes de commande
  displayedColumns: string[] = [
    'reference',
    'designation',
    'quantite',
    'prixUnitaireHT',
    'tauxTVA',
    'montantHT',
    'montantTVA',
    'montantTTC',
    'actions'
  ];
  
  // Options pour les statuts
  statutOptions = Object.values(StatutCommande);
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private formBuilder: FormBuilder,
    private commandeService: CommandeService,
    private achatService: AchatService,
    private produitService: ProduitService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.commandeForm = this.createCommandeForm();
  }

  ngOnInit(): void {
    this.loadFournisseurs();
    
    // Déterminer le mode (view, edit, create)
    const url = this.router.url;
    if (url.includes('/new')) {
      this.mode = 'create';
      this.initializeNewCommande();
      this.loadProduitsLowStock(); // Charger les produits en stock faible pour une nouvelle commande
    } else if (url.includes('/edit')) {
      this.mode = 'edit';
      this.loadCommande();
    } else {
      this.mode = 'view';
      this.loadCommande();
    }
  }

  createCommandeForm(): FormGroup {
    return this.formBuilder.group({
      fournisseur: this.formBuilder.group({
        id: [null] // Suppression du Validators.required pour permettre la sélection d'articles sans fournisseur
      }),
      dateLivraisonPrevue: [null],
      notes: [''],
      lignes: this.formBuilder.array([])
    });
  }

  get lignesFormArray(): FormArray {
    return this.commandeForm.get('lignes') as FormArray;
  }

  createLigneForm(ligne?: LigneCommande): FormGroup {
    return this.formBuilder.group({
      id: [ligne?.id || null],
      reference: [ligne?.reference || ''],
      designation: [ligne?.designation || '', Validators.required],
      description: [ligne?.description || ''],
      quantite: [ligne?.quantite || 1, [Validators.required, Validators.min(1)]],
      prixUnitaireHT: [ligne?.prixUnitaireHT || 0, [Validators.required, Validators.min(0)]],
      tauxTVA: [ligne?.tauxTVA || 20, [Validators.required, Validators.min(0)]],
      produitId: [ligne?.produitId || null],
      statut: [ligne?.statut || StatutLigne.EN_ATTENTE],
      quantiteRecue: [ligne?.quantiteRecue || 0]
    });
  }

  loadFournisseurs(): void {
    this.achatService.getFournisseurs().subscribe({
      next: (data) => {
        this.fournisseurs = data;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des fournisseurs', err);
        this.error = 'Impossible de charger les fournisseurs. Veuillez réessayer plus tard.';
      }
    });
  }

  loadCommande(): void {
    this.loading = true;
    this.error = '';
    
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      this.error = 'ID de commande non spécifié';
      this.loading = false;
      return;
    }
    
    this.commandeId = +idParam;
    
    this.commandeService.getCommandeById(this.commandeId).subscribe({
      next: (data) => {
        this.commande = data;
        if (this.mode === 'edit') {
          this.patchCommandeForm(data);
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement de la commande', err);
        this.error = 'Impossible de charger la commande. Veuillez réessayer plus tard.';
        this.loading = false;
      }
    });
  }

  initializeNewCommande(): void {
    this.commande = {
      fournisseur: { id: 0 },
      statut: StatutCommande.BROUILLON,
      lignes: []
    };
  }

  loadProduitsLowStock(): void {
    this.produitService.getProductsInLowStock().subscribe(
      (produits) => {
        this.produitsLowStock = produits;
        console.log('Produits en stock faible chargés:', produits);
        
        // Si des produits en stock faible sont trouvés, proposer de les ajouter à la commande
        if (produits && produits.length > 0) {
          this.snackBar.open(
            `${produits.length} produit(s) en stock faible détecté(s). Ils ont été ajoutés à votre commande.`, 
            'OK', 
            { duration: 5000 }
          );
          this.ajouterProduitsLowStockACommande();
        }
      },
      (error) => {
        console.error('Erreur lors du chargement des produits en stock faible:', error);
        this.snackBar.open(
          'Impossible de charger les produits en stock faible.', 
          'OK', 
          { duration: 3000 }
        );
      }
    );
  }

  ajouterProduitsLowStockACommande(): void {
    if (!this.produitsLowStock || this.produitsLowStock.length === 0) {
      return;
    }

    const lignesArray = this.commandeForm.get('lignes') as FormArray;
    
    // Ajouter chaque produit en stock faible comme ligne de commande
    this.produitsLowStock.forEach(produit => {
      // Créer une nouvelle ligne de commande
      const ligneForm = this.formBuilder.group({
        reference: [produit.reference || ''],
        designation: [produit.nom, Validators.required],
        description: [produit.description || ''],
        quantite: [10, [Validators.required, Validators.min(1)]], // Quantité par défaut à 10
        prixUnitaireHT: [produit.prix, [Validators.required, Validators.min(0)]],
        tauxTVA: [20, [Validators.required, Validators.min(0)]], // TVA par défaut à 20%
        produitId: [produit.id]
      });
      
      // Ajouter la ligne au formulaire
      lignesArray.push(ligneForm);
    });
    
    // Les totaux seront automatiquement calculés lors de l'affichage
    // via les méthodes calculerTotalHT(), calculerTotalTVA() et calculerTotalTTC()
  }

  patchCommandeForm(commande: Commande): void {
    // Réinitialiser le formulaire
    this.commandeForm = this.createCommandeForm();
    
    // Patcher les valeurs de base
    this.commandeForm.patchValue({
      fournisseur: {
        id: commande.fournisseur?.id || null
      },
      dateLivraisonPrevue: commande.dateLivraisonPrevue ? new Date(commande.dateLivraisonPrevue) : null,
      notes: commande.notes || ''
    });
    
    // Ajouter les lignes de commande
    if (commande.lignes && commande.lignes.length > 0) {
      commande.lignes.forEach(ligne => {
        this.lignesFormArray.push(this.createLigneForm(ligne));
      });
    }
  }

  addLigne(): void {
    this.lignesFormArray.push(this.createLigneForm());
  }

  removeLigne(index: number): void {
    this.lignesFormArray.removeAt(index);
  }

  calculerMontantHT(index: number): number {
    const ligne = this.lignesFormArray.at(index).value;
    return ligne.quantite * ligne.prixUnitaireHT;
  }

  calculerMontantTVA(index: number): number {
    const montantHT = this.calculerMontantHT(index);
    const ligne = this.lignesFormArray.at(index).value;
    return montantHT * (ligne.tauxTVA / 100);
  }

  calculerMontantTTC(index: number): number {
    return this.calculerMontantHT(index) + this.calculerMontantTVA(index);
  }

  calculerTotalHT(): number {
    let total = 0;
    for (let i = 0; i < this.lignesFormArray.length; i++) {
      total += this.calculerMontantHT(i);
    }
    return total;
  }

  calculerTotalTVA(): number {
    let total = 0;
    for (let i = 0; i < this.lignesFormArray.length; i++) {
      total += this.calculerMontantTVA(i);
    }
    return total;
  }

  calculerTotalTTC(): number {
    return this.calculerTotalHT() + this.calculerTotalTVA();
  }

  toggleEmailMode(): void {
    this.useEmailMode = !this.useEmailMode;
    
    if (this.useEmailMode) {
      // Si on passe en mode email, on désactive la validation du fournisseur.id
      this.commandeForm.get('fournisseur')?.get('id')?.clearValidators();
      this.commandeForm.get('fournisseur')?.get('id')?.updateValueAndValidity();
    } else {
      // Si on revient en mode sélection, on réactive la validation
      this.commandeForm.get('fournisseur')?.get('id')?.setValidators([Validators.required]);
      this.commandeForm.get('fournisseur')?.get('id')?.updateValueAndValidity();
    }
  }
  
  saveCommande(): void {
    // Vérifier la validité du formulaire
    if (this.commandeForm.invalid) {
      // Marquer tous les champs comme touchés pour afficher les erreurs
      Object.keys(this.commandeForm.controls).forEach(key => {
        const control = this.commandeForm.get(key);
        control?.markAsTouched();
      });
      
      // Afficher un message d'erreur
      this.snackBar.open('Veuillez corriger les erreurs dans le formulaire', 'Fermer', { duration: 5000 });
      return;
    }
    
    // Vérifier qu'il y a au moins une ligne de commande
    if (this.lignesFormArray.length === 0) {
      this.snackBar.open('Veuillez ajouter au moins une ligne de commande', 'Fermer', { duration: 3000 });
      return;
    }
    
    // Avant l'enregistrement, vérifier que le fournisseur est sélectionné ou que l'email est saisi
    if (this.useEmailMode) {
      // En mode email, vérifier que l'email est valide
      if (!this.fournisseurEmail || !this.validateEmail(this.fournisseurEmail)) {
        this.snackBar.open('Veuillez saisir un email de fournisseur valide', 'Fermer', { duration: 3000 });
        return;
      }
    } else {
      // En mode sélection, vérifier que le fournisseur est sélectionné
      if (!this.commandeForm.get('fournisseur')?.get('id')?.value) {
        this.snackBar.open('Veuillez sélectionner un fournisseur avant d\'enregistrer la commande', 'Fermer', { duration: 5000 });
        return;
      }
    }
    
    this.saving = true;
    
    // Construire l'objet commande à partir du formulaire
    const commandeData = this.commandeForm.value;
    
    // Préparer l'objet fournisseur
    let fournisseur: { id?: number; nom?: string; email?: string } | undefined = undefined;
    if (!this.useEmailMode) {
      fournisseur = {
        id: commandeData.fournisseur?.id
      };
    }
    
    // Préparer les lignes de commande
    const lignes = commandeData.lignes.map((ligne: any) => {
      return {
        ...ligne,
        montantHT: this.calculerMontantHT(this.lignesFormArray.controls.indexOf(ligne)),
        montantTVA: this.calculerMontantTVA(this.lignesFormArray.controls.indexOf(ligne)),
        montantTTC: this.calculerMontantTTC(this.lignesFormArray.controls.indexOf(ligne))
      };
    });
    
    // Construire l'objet commande complet
    const commande: Commande = {
      ...this.commande,
      fournisseur,
      dateLivraisonPrevue: commandeData.dateLivraisonPrevue,
      notes: commandeData.notes,
      lignes,
      montantHT: this.calculerTotalHT(),
      montantTVA: this.calculerTotalTVA(),
      montantTTC: this.calculerTotalTTC(),
      creePar: 'Utilisateur actuel' // Idéalement, récupérer l'utilisateur connecté
    };
    
    // Appeler le service pour créer ou mettre à jour la commande
    let observable: any;
    
    if (this.mode === 'create') {
      if (this.useEmailMode) {
        // Créer avec email
        observable = this.commandeService.createCommandeWithEmail(commande, this.fournisseurEmail);
      } else {
        // Créer avec fournisseur sélectionné
        observable = this.commandeService.createCommande(commande);
      }
    } else {
      observable = this.commandeService.updateCommande(this.commandeId!, commande);
    }
    
    observable.subscribe({
      next: (result: Commande) => {
        this.saving = false;
        this.commande = result;
        
        // Afficher un message de succès
        const message = this.mode === 'create' ? 'Commande créée avec succès' : 'Commande mise à jour avec succès';
        this.snackBar.open(message, 'Fermer', { duration: 3000 });
        
        // Rediriger vers la page de détail
        if (this.mode === 'create' && result.id) {
          this.router.navigate(['/achat/commandes', result.id]);
        } else {
          this.mode = 'view';
          this.loadCommande(); // Recharger la commande pour avoir les données à jour
        }
      },
      error: (err: any) => {
        this.saving = false;
        console.error('Erreur lors de l\'enregistrement de la commande', err);
        this.snackBar.open('Erreur lors de l\'enregistrement de la commande', 'Fermer', { duration: 5000 });
      }
    });
  }

  cancelEdit(): void {
    if (this.mode === 'create') {
      this.router.navigate(['/achat/commandes']);
    } else {
      this.mode = 'view';
      this.loadCommande();
    }
  }

  startEdit(): void {
    this.mode = 'edit';
    this.patchCommandeForm(this.commande!);
  }

  confirmerCommande(): void {
    if (!this.commandeId) return;
    
    if (confirm('Êtes-vous sûr de vouloir confirmer cette commande ?')) {
      this.commandeService.confirmerCommande(this.commandeId).subscribe({
        next: () => {
          this.snackBar.open('Commande confirmée avec succès', 'Fermer', { duration: 3000 });
          this.loadCommande();
        },
        error: (err) => {
          console.error('Erreur lors de la confirmation de la commande', err);
          this.snackBar.open('Erreur lors de la confirmation de la commande', 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  livrerCommande(): void {
    if (!this.commandeId) return;
    
    if (confirm('Êtes-vous sûr de vouloir marquer cette commande comme livrée ?')) {
      this.commandeService.livrerCommande(this.commandeId).subscribe({
        next: () => {
          this.snackBar.open('Commande marquée comme livrée avec succès', 'Fermer', { duration: 3000 });
          this.loadCommande();
        },
        error: (err) => {
          console.error('Erreur lors de la livraison de la commande', err);
          this.snackBar.open('Erreur lors de la livraison de la commande', 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  annulerCommande(): void {
    if (!this.commandeId) return;
    
    if (confirm('Êtes-vous sûr de vouloir annuler cette commande ?')) {
      this.commandeService.annulerCommande(this.commandeId).subscribe({
        next: () => {
          this.snackBar.open('Commande annulée avec succès', 'Fermer', { duration: 3000 });
          this.loadCommande();
        },
        error: (err) => {
          console.error('Erreur lors de l\'annulation de la commande', err);
          this.snackBar.open('Erreur lors de l\'annulation de la commande', 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  genererBonCommande(): void {
    if (!this.commandeId) return;
    
    this.commandeService.genererBonCommande(this.commandeId).subscribe({
      next: (blob) => {
        saveAs(blob, `bon-commande-${this.commandeId}.pdf`);
      },
      error: (err) => {
        console.error('Erreur lors de la génération du bon de commande', err);
        this.snackBar.open('Erreur lors de la génération du bon de commande', 'Fermer', { duration: 3000 });
      }
    });
  }

  getFournisseurNom(id: number): string {
    const fournisseur = this.fournisseurs.find(f => f.id === id.toString());
    return fournisseur ? fournisseur.nom : '';
  }

  getStatutClass(statut: StatutCommande): string {
    switch (statut) {
      case StatutCommande.BROUILLON:
        return 'statut-brouillon';
      case StatutCommande.CONFIRMEE:
        return 'statut-confirmee';
      case StatutCommande.EN_ATTENTE:
        return 'statut-en-attente';
      case StatutCommande.LIVRAISON_PARTIELLE:
        return 'statut-livraison-partielle';
      case StatutCommande.LIVREE:
        return 'statut-livree';
      case StatutCommande.ANNULEE:
        return 'statut-annulee';
      default:
        return '';
    }
  }

  getStatutLabel(statut: StatutCommande): string {
    switch (statut) {
      case StatutCommande.BROUILLON:
        return 'Brouillon';
      case StatutCommande.CONFIRMEE:
        return 'Confirmée';
      case StatutCommande.EN_ATTENTE:
        return 'En attente';
      case StatutCommande.LIVRAISON_PARTIELLE:
        return 'Livraison partielle';
      case StatutCommande.LIVREE:
        return 'Livrée';
      case StatutCommande.ANNULEE:
        return 'Annulée';
      default:
        return statut;
    }
  }

  formatDate(date: string | undefined): string {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString();
  }

  formatMontant(montant: number | undefined): string {
    if (montant === undefined || montant === null) return '-';
    return montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  }

  // Méthodes d'aide pour les conditions d'affichage des boutons
  peutModifier(commande: Commande): boolean {
    return commande && commande.statut === StatutCommande.BROUILLON;
  }

  peutConfirmer(commande: Commande): boolean {
    return commande && commande.statut === StatutCommande.BROUILLON;
  }

  peutLivrer(commande: Commande): boolean {
    return commande && (commande.statut === StatutCommande.CONFIRMEE || commande.statut === StatutCommande.LIVRAISON_PARTIELLE);
  }

  peutAnnuler(commande: Commande): boolean {
    return commande && commande.statut !== StatutCommande.LIVREE && commande.statut !== StatutCommande.ANNULEE;
  }

  peutGenererBonCommande(commande: Commande): boolean {
    return commande && commande.statut !== StatutCommande.BROUILLON;
  }

  // Méthode pour charger tous les articles disponibles
  chargerArticles(): void {
    this.produitService.getAllProducts().subscribe({
      next: (produits) => {
        if (produits && produits.length > 0) {
          // Si nous avons déjà des lignes, demander confirmation avant de remplacer
          if (this.lignesFormArray.length > 0) {
            const dialogRef = this.dialog.open(ConfirmDialogComponent, {
              data: {
                title: 'Confirmation',
                message: 'Voulez-vous remplacer les lignes existantes ou ajouter à la suite?',
                confirmText: 'Remplacer',
                cancelText: 'Ajouter'
              }
            });

            dialogRef.afterClosed().subscribe(result => {
              if (result === true) {
                // Remplacer les lignes existantes
                while (this.lignesFormArray.length !== 0) {
                  this.lignesFormArray.removeAt(0);
                }
                this.ajouterProduitsAuFormulaire(produits);
              } else if (result === false) {
                // Ajouter à la suite
                this.ajouterProduitsAuFormulaire(produits);
              }
              // Si undefined, l'utilisateur a annulé
            });
          } else {
            // Pas de lignes existantes, ajouter directement
            this.ajouterProduitsAuFormulaire(produits);
          }
        } else {
          this.snackBar.open('Aucun produit disponible', 'Fermer', { duration: 3000 });
        }
      },
      error: (err) => {
        console.error('Erreur lors du chargement des produits', err);
        this.snackBar.open('Erreur lors du chargement des produits', 'Fermer', { duration: 3000 });
      }
    });
  }

  // Méthode pour valider un email
  validateEmail(email: string): boolean {
    if (!email) return false;
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
  }
  
  // Méthode pour ajouter les produits au formulaire
  ajouterProduitsAuFormulaire(produits: Produit[]): void {
    const lignesArray = this.lignesFormArray;
    
    produits.forEach(produit => {
      const ligneForm = this.formBuilder.group({
        reference: [produit.reference || produit.id.toString(), Validators.required],
        designation: [produit.nom, Validators.required],
        quantite: [1, [Validators.required, Validators.min(1)]], // Quantité par défaut à 1
        prixUnitaireHT: [produit.prix, [Validators.required, Validators.min(0)]],
        tauxTVA: [20, [Validators.required, Validators.min(0)]], // TVA par défaut à 20%
        produitId: [produit.id]
      });
      
      // Ajouter la ligne au formulaire
      lignesArray.push(ligneForm);
    });
    
    this.snackBar.open(`${produits.length} produit(s) ajouté(s) à la commande`, 'Fermer', { duration: 3000 });
  }
}
