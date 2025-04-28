import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Facture, FactureService } from '../../services/facture.service';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-vendor-factures',
  templateUrl: './vendor-factures.component.html',
  styleUrls: ['./vendor-factures.component.scss']
})
export class VendorFacturesComponent implements OnInit {
  // Exposer Math pour l'utiliser dans le template
  public Math = Math;
  
  // Messages de notification
  successMessage: string = '';
  showSuccess: boolean = false;
  factures: Facture[] = [];
  filteredFactures: Facture[] = [];
  isLoading: boolean = false;
  errorMessage: string | null = null;
  
  // Filtres
  searchTerm: string = '';
  dateRange: { start: Date | null, end: Date | null } = { start: null, end: null };
  statusFilter: string = '';
  
  // Pagination
  currentPage: number = 1;
  pageSize: number = 10;
  totalItems: number = 0;
  
  // Tri
  sortField: string = 'date';
  sortDirection: 'asc' | 'desc' = 'desc';
  
  constructor(
    private factureService: FactureService,
    public authService: AuthService,
    private router: Router
  ) { }

  // Afficher un message de succès
  showSuccessMessage(message: string): void {
    this.successMessage = message;
    this.showSuccess = true;
    this.errorMessage = '';
    setTimeout(() => {
      this.showSuccess = false;
      this.successMessage = '';
    }, 3000);
  }

  // Afficher un message d'erreur
  showErrorMessage(message: string): void {
    this.errorMessage = message;
    setTimeout(() => {
      this.errorMessage = '';
    }, 3000);
  }
  
  // Méthodes pour compter les factures par statut
  getPaidFacturesCount(): number {
    if (!this.factures) return 0;
    return this.factures.filter(f => f.status === 'PAID').length;
  }

  getPendingFacturesCount(): number {
    if (!this.factures) return 0;
    return this.factures.filter(f => f.status === 'PENDING').length;
  }

  ngOnInit(): void {
    this.loadFactures();
  }
  
  loadFactures(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.errorMessage = 'Utilisateur non connecté';
      this.isLoading = false;
      return;
    }
    
    this.factureService.getVendorFactures().subscribe({
      next: (factures) => {
        this.factures = factures;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des factures:', error);
        this.errorMessage = 'Erreur lors du chargement des factures. Veuillez réessayer.';
        this.isLoading = false;
      }
    });
  }
  
  applyFilters(): void {
    let filtered = [...this.factures];
    
    // Filtre par terme de recherche (numéro de facture ou nom du client)
    if (this.searchTerm) {
      const search = this.searchTerm.toLowerCase();
      filtered = filtered.filter(facture => 
        (facture.number && facture.number.toLowerCase().includes(search)) ||
        (facture.clientName && facture.clientName.toLowerCase().includes(search))
      );
    }
    
    // Filtre par plage de dates
    if (this.dateRange.start && this.dateRange.end) {
      filtered = filtered.filter(facture => {
        const factureDate = new Date(facture.date);
        return factureDate >= this.dateRange.start! && factureDate <= this.dateRange.end!;
      });
    } else if (this.dateRange.start) {
      filtered = filtered.filter(facture => {
        const factureDate = new Date(facture.date);
        return factureDate >= this.dateRange.start!;
      });
    } else if (this.dateRange.end) {
      filtered = filtered.filter(facture => {
        const factureDate = new Date(facture.date);
        return factureDate <= this.dateRange.end!;
      });
    }
    
    // Filtre par statut
    if (this.statusFilter) {
      filtered = filtered.filter(facture => facture.status === this.statusFilter);
    }
    
    // Tri
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (this.sortField === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (this.sortField === 'total') {
        comparison = a.total - b.total;
      } else if (this.sortField === 'clientName') {
        comparison = (a.clientName || '').localeCompare(b.clientName || '');
      } else if (this.sortField === 'status') {
        comparison = (a.status || '').localeCompare(b.status || '');
      }
      
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
    
    // Pagination
    this.totalItems = filtered.length;
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.filteredFactures = filtered.slice(startIndex, startIndex + this.pageSize);
  }
  
  resetFilters(): void {
    this.searchTerm = '';
    this.dateRange = { start: null, end: null };
    this.statusFilter = '';
    this.applyFilters();
  }
  
  changePage(page: number): void {
    this.currentPage = page;
    this.applyFilters();
  }
  
  changeSort(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }
  
  viewFacture(id: string): void {
    this.router.navigate(['/facturation', id]);
  }
  
  generatePdf(id: string): void {
    this.isLoading = true;
    this.factureService.generatePdf(id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `facture-${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.isLoading = false;
        this.showSuccessMessage('PDF généré avec succès');
      },
      error: (error) => {
        console.error('Erreur lors de la génération du PDF:', error);
        this.isLoading = false;
        this.showErrorMessage('Erreur lors de la génération du PDF');
      }
    });
  }

  sendByEmail(id: string, email: string): void {
    if (!email) {
      this.showErrorMessage('Adresse email manquante');
      this.errorMessage = 'Adresse email manquante';
      return;
    }
    
    this.factureService.sendFactureByEmail(id, email).subscribe({
      next: () => {
        alert('Facture envoyée avec succès à ' + email);
      },
      error: (error) => {
        console.error('Erreur lors de l\'envoi de la facture par email:', error);
        this.errorMessage = 'Erreur lors de l\'envoi de la facture par email. Veuillez réessayer.';
      }
    });
  }
  
  getStatusClass(status: string): string {
    switch (status) {
      case 'PAID':
        return 'status-paid';
      case 'PENDING':
        return 'status-pending';
      case 'CANCELLED':
        return 'status-cancelled';
      default:
        return '';
    }
  }
  
  getStatusLabel(status: string): string {
    switch (status) {
      case 'PAID':
        return 'Payée';
      case 'PENDING':
        return 'En attente';
      case 'CANCELLED':
        return 'Annulée';
      default:
        return status;
    }
  }
  
  getTotalSales(): number {
    return this.factures
      .filter(facture => facture.status === 'PAID')
      .reduce((sum, facture) => sum + facture.total, 0);
  }
  
  getPendingSales(): number {
    return this.factures
      .filter(facture => facture.status === 'PENDING')
      .reduce((sum, facture) => sum + facture.total, 0);
  }
  
  createNewFacture(): void {
    this.router.navigate(['/caisse/dashboard']);
  }
}
