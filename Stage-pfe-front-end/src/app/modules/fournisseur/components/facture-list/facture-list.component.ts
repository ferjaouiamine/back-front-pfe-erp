import { Component, OnInit, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { FormControl } from '@angular/forms';
import { FournisseurService, FactureFournisseur, StatutPaiement } from '../../services/fournisseur.service';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs/operators';

@Component({
  selector: 'app-facture-list',
  templateUrl: './facture-list.component.html',
  styleUrls: ['./facture-list.component.scss']
})
export class FactureListComponent implements OnInit {
  displayedColumns: string[] = ['numero', 'dateFacture', 'dateEcheance', 'montantTTC', 'statutPaiement', 'commandeNumero', 'actions'];
  dataSource = new MatTableDataSource<FactureFournisseur>([]);
  
  totalElements = 0;
  pageSize = 10;
  pageIndex = 0;
  
  loading = false;
  searchControl = new FormControl('');
  statutControl = new FormControl('');
  
  statutOptions = [
    { value: '', label: 'Tous les statuts' },
    { value: StatutPaiement.EN_ATTENTE, label: 'En attente' },
    { value: StatutPaiement.PARTIEL, label: 'Paiement partiel' },
    { value: StatutPaiement.PAYE, label: 'Payé' },
    { value: StatutPaiement.REJETE, label: 'Rejeté' },
    { value: StatutPaiement.ANNULE, label: 'Annulé' }
  ];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private fournisseurService: FournisseurService,
    private snackBar: MatSnackBar,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadFactures();
    
    this.searchControl.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(value => {
        if (value && value.trim() !== '') {
          this.searchFactures(value);
        } else {
          this.loadFactures();
        }
      });
    
    this.statutControl.valueChanges.subscribe(() => {
      this.loadFactures();
    });
  }

  loadFactures(): void {
    this.loading = true;
    const statut = this.statutControl.value as StatutPaiement | undefined;
    
    this.fournisseurService.getFactures(this.pageIndex, this.pageSize, statut)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: response => {
          this.dataSource.data = response.content;
          this.totalElements = response.totalElements;
        },
        error: error => {
          this.snackBar.open('Erreur lors du chargement des factures: ' + error.message, 'Fermer', { duration: 5000 });
        }
      });
  }

  searchFactures(query: string): void {
    this.loading = true;
    this.fournisseurService.searchFactures(query, this.pageIndex, this.pageSize)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: response => {
          this.dataSource.data = response.content;
          this.totalElements = response.totalElements;
        },
        error: error => {
          this.snackBar.open('Erreur lors de la recherche des factures: ' + error.message, 'Fermer', { duration: 5000 });
        }
      });
  }

  onPageChange(event: any): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    
    if (this.searchControl.value && this.searchControl.value.trim() !== '') {
      this.searchFactures(this.searchControl.value);
    } else {
      this.loadFactures();
    }
  }

  viewFacture(factureId: string): void {
    this.router.navigate(['/fournisseur/factures', factureId]);
  }

  editFacture(factureId: string): void {
    this.router.navigate(['/fournisseur/factures', factureId, 'edit']);
  }

  getStatutClass(statut: StatutPaiement): string {
    switch (statut) {
      case StatutPaiement.EN_ATTENTE:
        return 'bg-warning';
      case StatutPaiement.PARTIEL:
        return 'bg-info';
      case StatutPaiement.PAYE:
        return 'bg-success';
      case StatutPaiement.REJETE:
      case StatutPaiement.ANNULE:
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  }
}
