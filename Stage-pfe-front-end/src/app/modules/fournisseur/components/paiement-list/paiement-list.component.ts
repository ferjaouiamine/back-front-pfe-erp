import { Component, OnInit, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, FormGroup } from '@angular/forms';
import { FournisseurService } from '../../services/fournisseur.service';
import { PaiementDialogComponent } from '../paiement-dialog/paiement-dialog.component';

@Component({
  selector: 'app-paiement-list',
  templateUrl: './paiement-list.component.html',
  styleUrls: ['./paiement-list.component.scss']
})
export class PaiementListComponent implements OnInit {
  displayedColumns: string[] = ['id', 'datePaiement', 'montant', 'modePaiement', 'reference', 'statut', 'factureNumero', 'actions'];
  dataSource: MatTableDataSource<any> = new MatTableDataSource<any>([]);
  isLoading = true;
  totalItems = 0;
  factureId: number | null = null;
  filterForm: FormGroup;
  statutOptions = ['EN_ATTENTE', 'VALIDE', 'REFUSE', 'AUTRE'];
  
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private fournisseurService: FournisseurService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private fb: FormBuilder
  ) {
    this.filterForm = this.fb.group({
      statut: [''],
      dateDebut: [''],
      dateFin: ['']
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const factureIdParam = params.get('factureId');
      if (factureIdParam) {
        this.factureId = +factureIdParam;
        this.loadPaiements();
      } else {
        this.loadPaiements();
      }
    });
  }

  loadPaiements(): void {
    this.isLoading = true;
    
    if (this.factureId) {
      // Si on a un ID de facture, on charge les paiements pour cette facture
      this.fournisseurService.getPaiementsByFacture(this.factureId.toString()).subscribe({
        next: (response: any) => {
          this.dataSource.data = response;
          this.totalItems = response.length;
          this.dataSource.sort = this.sort;
          this.isLoading = false;
        },
        error: (error: any) => {
          this.snackBar.open('Erreur lors du chargement des paiements: ' + error.message, 'Fermer', { duration: 5000 });
          this.isLoading = false;
        }
      });
    } else {
      // Sinon, on charge tous les paiements avec filtrage
      const statut = this.filterForm.get('statut')?.value;
      const dateDebut = this.filterForm.get('dateDebut')?.value;
      const dateFin = this.filterForm.get('dateFin')?.value;
      
      if (dateDebut && dateFin) {
        // Si on a une période, on utilise la recherche par période
        this.fournisseurService.getPaiementsByPeriode(
          dateDebut.toISOString().split('T')[0],
          dateFin.toISOString().split('T')[0],
          this.paginator?.pageIndex || 0,
          this.paginator?.pageSize || 10
        ).subscribe({
          next: (response: any) => {
            this.dataSource.data = response.content;
            this.totalItems = response.totalElements;
            this.dataSource.sort = this.sort;
            this.isLoading = false;
          },
          error: (error: any) => {
            this.snackBar.open('Erreur lors du chargement des paiements: ' + error.message, 'Fermer', { duration: 5000 });
            this.isLoading = false;
          }
        });
      } else {
        // Sinon on utilise la recherche standard
        this.fournisseurService.getPaiements(
          this.paginator?.pageIndex || 0,
          this.paginator?.pageSize || 10,
          statut
        ).subscribe({
          next: (response: any) => {
            this.dataSource.data = response.content;
            this.totalItems = response.totalElements;
            this.dataSource.sort = this.sort;
            this.isLoading = false;
          },
          error: (error: any) => {
            this.snackBar.open('Erreur lors du chargement des paiements: ' + error.message, 'Fermer', { duration: 5000 });
            this.isLoading = false;
          }
        });
      }
    }
  }

  onPageChange(event: any): void {
    this.loadPaiements();
  }

  applyFilter(): void {
    this.loadPaiements();
  }

  resetFilter(): void {
    this.filterForm.reset({
      statut: '',
      dateDebut: '',
      dateFin: ''
    });
    this.loadPaiements();
  }

  openPaiementDialog(factureId: number | null = null): void {
    const dialogRef = this.dialog.open(PaiementDialogComponent, {
      width: '600px',
      data: { factureId: factureId || this.factureId }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadPaiements();
        this.snackBar.open('Paiement enregistré avec succès', 'Fermer', { duration: 3000 });
      }
    });
  }

  getStatutClass(statut: string): string {
    switch (statut) {
      case 'VALIDE':
        return 'statut-valide';
      case 'EN_ATTENTE':
        return 'statut-attente';
      case 'REFUSE':
        return 'statut-refuse';
      default:
        return 'statut-autre';
    }
  }

  formatMontant(montant: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(montant);
  }

  goToFactureDetails(factureId: number): void {
    this.router.navigate(['/fournisseur/factures', factureId]);
  }

  retourAuxFactures(): void {
    this.router.navigate(['/fournisseur/factures']);
  }
}
