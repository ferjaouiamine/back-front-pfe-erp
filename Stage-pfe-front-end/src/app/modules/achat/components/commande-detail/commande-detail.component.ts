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

import { CommandeService, Commande, LigneCommande, StatutCommande, StatutLigne } from '../../services/commande.service';
import { AchatService, Fournisseur } from '../../services/achat.service';
import { saveAs } from 'file-saver';

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
    MatDividerModule
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
  loading = false;
  saving = false;
  error = '';
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
        id: ['', Validators.required]
      }),
      dateLivraisonPrevue: [''],
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

  patchCommandeForm(commande: Commande): void {
    // Réinitialiser le formulaire
    this.commandeForm = this.createCommandeForm();
    
    // Patcher les valeurs de base
    this.commandeForm.patchValue({
      fournisseur: {
        id: commande.fournisseur.id
      },
      dateLivraisonPrevue: commande.dateLivraisonPrevue ? new Date(commande.dateLivraisonPrevue) : null,
      notes: commande.notes
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

  saveCommande(): void {
    if (this.commandeForm.invalid) {
      this.snackBar.open('Veuillez corriger les erreurs dans le formulaire', 'Fermer', { duration: 3000 });
      return;
    }
    
    this.saving = true;
    
    // Préparer les données de la commande
    const commandeData: Commande = {
      ...this.commandeForm.value,
      id: this.commandeId,
      statut: StatutCommande.BROUILLON
    };
    
    // Calculer les montants pour chaque ligne
    if (commandeData.lignes) {
      commandeData.lignes.forEach((ligne, index) => {
        ligne.montantHT = this.calculerMontantHT(index);
        ligne.montantTVA = this.calculerMontantTVA(index);
        ligne.montantTTC = this.calculerMontantTTC(index);
      });
    }
    
    // Créer ou mettre à jour la commande
    const saveObservable = this.mode === 'create' 
      ? this.commandeService.createCommande(commandeData)
      : this.commandeService.updateCommande(this.commandeId!, commandeData);
    
    saveObservable.subscribe({
      next: (result) => {
        this.saving = false;
        this.snackBar.open('Commande enregistrée avec succès', 'Fermer', { duration: 3000 });
        
        if (this.mode === 'create') {
          // Rediriger vers la page de détail de la nouvelle commande
          this.router.navigate(['/achat/commandes', result.id]);
        } else {
          // Recharger la commande pour afficher les modifications
          this.loadCommande();
          this.mode = 'view';
        }
      },
      error: (err) => {
        console.error('Erreur lors de l\'enregistrement de la commande', err);
        this.snackBar.open('Erreur lors de l\'enregistrement de la commande', 'Fermer', { duration: 3000 });
        this.saving = false;
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
}
