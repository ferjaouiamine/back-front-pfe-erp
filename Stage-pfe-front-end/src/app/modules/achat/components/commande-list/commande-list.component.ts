import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';

import { CommandeService, Commande, StatutCommande, CommandePageable, FournisseurService, Fournisseur } from '../../services/index';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { saveAs } from 'file-saver';

// Interface pour les options de statut
interface StatutOption {
  value: StatutCommande;
  label: string;
}

@Component({
  selector: 'app-commande-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule
  ],
  templateUrl: './commande-list.component.html',
  styleUrls: ['./commande-list.component.scss']
})
export class CommandeListComponent implements OnInit {
  // Exposer l'énumération pour le template
  StatutCommande = StatutCommande;
  
  commandes: Commande[] = [];
  commandesPageable: CommandePageable | null = null;
  loading = false;
  error = '';
  
  // Pagination
  pageSize = 10;
  pageIndex = 0;
  totalItems = 0;
  
  // Filtres
  filtreForm: FormGroup;
  
  // Liste des fournisseurs pour le filtre
  fournisseurs: Fournisseur[] = [];
  
  // Liste des statuts pour le filtre
  statuts: StatutOption[] = [
    { value: StatutCommande.BROUILLON, label: 'Brouillon' },
    { value: StatutCommande.CONFIRMEE, label: 'Confirmée' },
    { value: StatutCommande.EN_ATTENTE, label: 'En attente' },
    { value: StatutCommande.LIVRAISON_PARTIELLE, label: 'Livraison partielle' },
    { value: StatutCommande.LIVREE, label: 'Livrée' },
    { value: StatutCommande.ANNULEE, label: 'Annulée' }
  ];
  
  // Colonnes à afficher dans le tableau
  displayedColumns: string[] = [
    'numero', 
    'fournisseur', 
    'dateCommande', 
    'dateLivraisonPrevue', 
    'statut', 
    'montantTTC', 
    'actions'
  ];

  constructor(
    private commandeService: CommandeService,
    private fournisseurService: FournisseurService,
    private formBuilder: FormBuilder,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.filtreForm = this.formBuilder.group({
      terme: [''],
      fournisseurId: [''],
      statut: [''],
      dateDebut: [null],
      dateFin: [null]
    });
  }

  ngOnInit(): void {
    this.loadCommandes();
    this.loadFournisseurs();
  }

  // Chargement des fournisseurs pour le filtre
  loadFournisseurs(): void {
    this.fournisseurService.getAllFournisseurs().subscribe({
      next: (data: Fournisseur[]) => {
        this.fournisseurs = data;
      },
      error: (err: any) => {
        console.error('Erreur lors du chargement des fournisseurs', err);
      }
    });
  }

  loadCommandes(): void {
    this.loading = true;
    this.error = '';
    
    // Si des filtres sont appliqués, utiliser la recherche avancée
    if (this.hasActiveFilters()) {
      this.rechercheAvancee();
    } else {
      this.commandeService.getCommandesPaginees(this.pageIndex, this.pageSize).subscribe({
        next: (data) => {
          this.commandesPageable = data;
          this.commandes = data.content;
          this.totalItems = data.totalElements;
          this.loading = false;
        },
        error: (err) => {
          console.error('Erreur lors du chargement des commandes', err);
          this.error = 'Impossible de charger les commandes. Veuillez réessayer plus tard.';
          this.loading = false;
        }
      });
    }
  }

  hasActiveFilters(): boolean {
    const formValues = this.filtreForm.value;
    return Object.keys(formValues).some(key => {
      const value = formValues[key];
      return value !== null && value !== '' && value !== undefined;
    });
  }

  rechercheAvancee(): void {
    this.loading = true;
    const formValues = this.filtreForm.value;
    
    this.commandeService.rechercheAvancee(
      formValues.numero,
      formValues.fournisseurId,
      formValues.statut,
      formValues.dateDebut ? this.formatDate(formValues.dateDebut) : undefined,
      formValues.dateFin ? this.formatDate(formValues.dateFin) : undefined,
      this.pageIndex,
      this.pageSize
    ).subscribe({
      next: (data) => {
        this.commandesPageable = data;
        this.commandes = data.content;
        this.totalItems = data.totalElements;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur lors de la recherche avancée', err);
        this.error = 'Impossible d\'effectuer la recherche. Veuillez réessayer plus tard.';
        this.loading = false;
      }
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadCommandes();
  }

  appliquerFiltres(): void {
    this.pageIndex = 0; // Réinitialiser à la première page
    this.loadCommandes();
  }

  reinitialiserFiltres(): void {
    this.filtreForm.reset();
    this.pageIndex = 0;
    this.loadCommandes();
  }

  confirmerCommande(id: number): void {
    if (confirm('Êtes-vous sûr de vouloir confirmer cette commande ?')) {
      this.commandeService.confirmerCommande(id).subscribe({
        next: () => {
          this.snackBar.open('Commande confirmée avec succès', 'Fermer', { duration: 3000 });
          this.loadCommandes();
        },
        error: (err) => {
          console.error('Erreur lors de la confirmation de la commande', err);
          this.snackBar.open('Erreur lors de la confirmation de la commande', 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  livrerCommande(id: number): void {
    if (confirm('Êtes-vous sûr de vouloir marquer cette commande comme livrée ?')) {
      this.commandeService.livrerCommande(id).subscribe({
        next: () => {
          this.snackBar.open('Commande marquée comme livrée avec succès', 'Fermer', { duration: 3000 });
          this.loadCommandes();
        },
        error: (err) => {
          console.error('Erreur lors de la livraison de la commande', err);
          this.snackBar.open('Erreur lors de la livraison de la commande', 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  annulerCommande(id: number): void {
    if (confirm('Êtes-vous sûr de vouloir annuler cette commande ?')) {
      this.commandeService.annulerCommande(id).subscribe({
        next: () => {
          this.snackBar.open('Commande annulée avec succès', 'Fermer', { duration: 3000 });
          this.loadCommandes();
        },
        error: (err) => {
          console.error('Erreur lors de l\'annulation de la commande', err);
          this.snackBar.open('Erreur lors de l\'annulation de la commande', 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  supprimerCommande(id: number): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette commande ? Cette action est irréversible.')) {
      this.commandeService.deleteCommande(id).subscribe({
        next: () => {
          this.snackBar.open('Commande supprimée avec succès', 'Fermer', { duration: 3000 });
          this.loadCommandes();
        },
        error: (err) => {
          console.error('Erreur lors de la suppression de la commande', err);
          this.snackBar.open('Erreur lors de la suppression de la commande', 'Fermer', { duration: 3000 });
        }
      });
    }
  }

  genererBonCommande(id: number): void {
    this.commandeService.genererBonCommande(id).subscribe({
      next: (blob) => {
        saveAs(blob, `bon-commande-${id}.pdf`);
      },
      error: (err) => {
        console.error('Erreur lors de la génération du bon de commande', err);
        this.snackBar.open('Erreur lors de la génération du bon de commande', 'Fermer', { duration: 3000 });
      }
    });
  }

  exporterCommandes(): void {
    // Ouvrir un menu pour choisir le format d'export
    const formatOptions = ['CSV', 'Excel', 'PDF'];
    const formatChoice = window.prompt(
      'Choisissez le format d\'export : \n1. CSV\n2. Excel\n3. PDF',
      '1'
    );
    
    const choice = parseInt(formatChoice || '1');
    
    switch (choice) {
      case 1:
        this.exporterCSV();
        break;
      case 2:
        this.exporterExcel();
        break;
      case 3:
        this.exporterPDF();
        break;
      default:
        this.exporterCSV();
    }
  }

  exporterCSV(): void {
    this.commandeService.exportCommandesToCSV().subscribe({
      next: (blob: Blob) => {
        saveAs(blob, 'commandes.csv');
      },
      error: (err: any) => {
        console.error('Erreur lors de l\'export CSV', err);
        this.snackBar.open('Erreur lors de l\'export CSV', 'Fermer', { duration: 3000 });
      }
    });
  }

  exporterExcel(): void {
    this.commandeService.exportCommandesToExcel().subscribe({
      next: (blob: Blob) => {
        saveAs(blob, 'commandes.xlsx');
      },
      error: (err: any) => {
        console.error('Erreur lors de l\'export Excel', err);
        this.snackBar.open('Erreur lors de l\'export Excel', 'Fermer', { duration: 3000 });
      }
    });
  }
  
  exporterPDF(): void {
    this.commandeService.exportCommandesToPDF().subscribe({
      next: (blob: Blob) => {
        saveAs(blob, 'commandes.pdf');
      },
      error: (err: any) => {
        console.error('Erreur lors de l\'export PDF', err);
        this.snackBar.open('Erreur lors de l\'export PDF', 'Fermer', { duration: 3000 });
      }
    });
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

  formatDate(date: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  formatDateDisplay(date: string | undefined): string {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString();
  }

  formatMontant(montant: number | undefined): string {
    if (montant === undefined || montant === null) return '-';
    return montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  }
}
