import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Facture, FactureService } from '../../../facturation/services/facture.service';
import { Router } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-facture-management',
  templateUrl: './facture-management.component.html',
  styleUrls: ['./facture-management.component.scss']
})
export class FactureManagementComponent implements OnInit {
  factures: Facture[] = [];
  filteredFactures: Facture[] = [];
  searchForm!: FormGroup;
  filterForm!: FormGroup;
  isLoading: boolean = true;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  selectedFacture: Facture | null = null;
  showDeleteModal: boolean = false;
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalItems: number = 0;
  totalPages: number = 0;

  // Statistiques
  totalFactures: number = 0;
  totalAmount: number = 0;
  paidFactures: number = 0;
  pendingFactures: number = 0;
  cancelledFactures: number = 0;

  constructor(
    private factureService: FactureService,
    private fb: FormBuilder,
    private router: Router,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.initForms();
    this.loadFactures();
  }

  initForms(): void {
    this.searchForm = this.fb.group({
      searchTerm: [''],
    });

    this.filterForm = this.fb.group({
      status: ['all'],
      dateFrom: [''],
      dateTo: [''],
      minAmount: [''],
      maxAmount: [''],
    });

    // Réagir aux changements dans le formulaire de recherche
    this.searchForm.get('searchTerm')?.valueChanges.subscribe(value => {
      this.applyFilters();
    });

    // Réagir aux changements dans le formulaire de filtrage
    this.filterForm.valueChanges.subscribe(value => {
      this.applyFilters();
    });
  }

  loadFactures(): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.factureService.getFactures().subscribe({
      next: (factures) => {
        this.factures = factures;
        this.filteredFactures = [...factures];
        this.calculateStatistics();
        this.calculatePagination();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des factures:', error);
        this.errorMessage = 'Erreur lors du chargement des factures. Veuillez réessayer plus tard.';
        this.isLoading = false;
        
        // Données de démonstration en cas d'erreur
        this.loadDemoData();
      }
    });
  }

  loadDemoData(): void {
    // Date actuelle et date d'échéance par défaut (15 jours plus tard)
    const currentDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(currentDate.getDate() + 15);
    
    // Données de démonstration pour tester l'interface
    const demoFactures: Facture[] = [
      { 
        id: '1', 
        number: 'FACT-2025-001', 
        date: currentDate.toISOString(), 
        clientName: 'Société ABC', 
        clientEmail: 'contact@societeabc.com',
        total: 1250.50, 
        status: 'PAID', 
        items: [],
        dueDate: dueDate.toISOString() 
      },
      { 
        id: '2', 
        number: 'FACT-2025-002', 
        date: currentDate.toISOString(), 
        clientName: 'Entreprise XYZ', 
        clientEmail: 'info@xyz-entreprise.com',
        total: 875.25, 
        status: 'PENDING', 
        items: [],
        dueDate: dueDate.toISOString() 
      },
      { 
        id: '3', 
        number: 'FACT-2025-003', 
        date: currentDate.toISOString(), 
        clientName: 'Client Particulier', 
        clientEmail: 'client@example.com',
        total: 350.00, 
        status: 'PAID', 
        items: [],
        dueDate: dueDate.toISOString() 
      },
      { 
        id: '4', 
        number: 'FACT-2025-004', 
        date: currentDate.toISOString(), 
        clientName: 'Boutique Mode', 
        clientEmail: 'contact@boutiquemode.com',
        total: 1500.75, 
        status: 'CANCELLED', 
        items: [],
        dueDate: dueDate.toISOString() 
      },
      { 
        id: '5', 
        number: 'FACT-2025-005', 
        date: currentDate.toISOString(), 
        clientName: 'Restaurant Gourmet', 
        clientEmail: 'resto@gourmet.com',
        total: 950.00, 
        status: 'PENDING', 
        items: [],
        dueDate: dueDate.toISOString() 
      },
      { 
        id: '6', 
        number: 'FACT-2025-006', 
        date: currentDate.toISOString(), 
        clientName: 'Cabinet Médical', 
        clientEmail: 'cabinet@medical.com',
        total: 2200.00, 
        status: 'PAID', 
        items: [],
        dueDate: dueDate.toISOString() 
      },
      { 
        id: '7', 
        number: 'FACT-2025-007', 
        date: currentDate.toISOString(), 
        clientName: 'Auto École', 
        clientEmail: 'contact@auto-ecole.com',
        total: 1100.50, 
        status: 'PAID', 
        items: [],
        dueDate: dueDate.toISOString() 
      },
      { 
        id: '8', 
        number: 'FACT-2025-008', 
        date: currentDate.toISOString(), 
        clientName: 'Librairie Centrale', 
        clientEmail: 'info@librairie-centrale.com',
        total: 450.25, 
        status: 'PENDING', 
        items: [],
        dueDate: dueDate.toISOString() 
      },
      { 
        id: '9', 
        number: 'FACT-2025-009', 
        date: currentDate.toISOString(), 
        clientName: 'Agence Immobilière', 
        clientEmail: 'agence@immobilier.com',
        total: 3500.00, 
        status: 'PAID', 
        items: [],
        dueDate: dueDate.toISOString() 
      },
      { 
        id: '10', 
        number: 'FACT-2025-010', 
        date: currentDate.toISOString(), 
        clientName: 'Garage Auto', 
        clientEmail: 'service@garage-auto.com',
        total: 780.50, 
        status: 'CANCELLED', 
        items: [],
        dueDate: dueDate.toISOString() 
      },
      { 
        id: '11', 
        number: 'FACT-2025-011', 
        date: currentDate.toISOString(), 
        clientName: 'Pharmacie Centrale', 
        clientEmail: 'pharmacie@centrale.com',
        total: 320.75, 
        status: 'PAID', 
        items: [],
        dueDate: dueDate.toISOString() 
      },
      { 
        id: '12', 
        number: 'FACT-2025-012', 
        date: currentDate.toISOString(), 
        clientName: 'Boulangerie Tradition', 
        clientEmail: 'contact@boulangerie.com',
        total: 150.00, 
        status: 'PENDING', 
        items: [],
        dueDate: dueDate.toISOString() 
      },
    ];
    
    this.factures = demoFactures;
    this.filteredFactures = [...demoFactures];
    this.calculateStatistics();
    this.calculatePagination();
  }

  calculateStatistics(): void {
    this.totalFactures = this.factures.length;
    this.totalAmount = this.factures.reduce((sum, facture) => sum + (facture.total || 0), 0);
    this.paidFactures = this.factures.filter(f => f.status === 'PAID').length;
    this.pendingFactures = this.factures.filter(f => f.status === 'PENDING').length;
    this.cancelledFactures = this.factures.filter(f => f.status === 'CANCELLED').length;
  }

  applyFilters(): void {
    const searchTerm = this.searchForm.get('searchTerm')?.value?.toLowerCase() || '';
    const status = this.filterForm.get('status')?.value;
    const dateFrom = this.filterForm.get('dateFrom')?.value ? new Date(this.filterForm.get('dateFrom')?.value) : null;
    const dateTo = this.filterForm.get('dateTo')?.value ? new Date(this.filterForm.get('dateTo')?.value) : null;
    const minAmount = this.filterForm.get('minAmount')?.value ? parseFloat(this.filterForm.get('minAmount')?.value) : null;
    const maxAmount = this.filterForm.get('maxAmount')?.value ? parseFloat(this.filterForm.get('maxAmount')?.value) : null;

    this.filteredFactures = this.factures.filter(facture => {
      // Recherche textuelle
      const matchesSearch = searchTerm ? 
        (facture.number?.toLowerCase().includes(searchTerm) ||
         facture.clientName?.toLowerCase().includes(searchTerm)) : true;
      
      // Filtre par statut
      const matchesStatus = status === 'all' || facture.status === status;
      
      // Filtre par date
      const factureDate = facture.date ? new Date(facture.date) : null;
      const matchesDateFrom = dateFrom && factureDate ? factureDate >= dateFrom : true;
      const matchesDateTo = dateTo && factureDate ? factureDate <= dateTo : true;
      
      // Filtre par montant
      const matchesMinAmount = minAmount !== null ? (facture.total || 0) >= minAmount : true;
      const matchesMaxAmount = maxAmount !== null ? (facture.total || 0) <= maxAmount : true;
      
      return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo && matchesMinAmount && matchesMaxAmount;
    });

    this.currentPage = 1; // Réinitialiser à la première page après filtrage
    this.calculatePagination();
  }

  calculatePagination(): void {
    this.totalItems = this.filteredFactures.length;
    this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage);
  }

  getCurrentPageItems(): Facture[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredFactures.slice(startIndex, startIndex + this.itemsPerPage);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  resetFilters(): void {
    this.searchForm.reset({ searchTerm: '' });
    this.filterForm.reset({
      status: 'all',
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: ''
    });
    this.applyFilters();
  }

  viewFacture(id: string): void {
    this.router.navigate(['/facturation', id]);
  }

  editFacture(id: string): void {
    this.router.navigate(['/facturation/edit', id]);
  }

  confirmDeleteFacture(facture: Facture): void {
    this.selectedFacture = facture;
    this.showDeleteModal = true;
  }

  deleteFacture(): void {
    if (!this.selectedFacture) return;
    
    const factureId = this.selectedFacture.id;
    if (!factureId) {
      this.errorMessage = 'ID de facture invalide';
      return;
    }

    this.factureService.deleteFacture(factureId).subscribe({
      next: () => {
        this.successMessage = 'Facture supprimée avec succès';
        this.factures = this.factures.filter(f => f.id !== factureId);
        this.applyFilters();
        this.calculateStatistics();
        this.showDeleteModal = false;
        this.selectedFacture = null;
        
        // Masquer le message de succès après 3 secondes
        setTimeout(() => {
          this.successMessage = null;
        }, 3000);
      },
      error: (error) => {
        console.error('Erreur lors de la suppression de la facture:', error);
        this.errorMessage = 'Erreur lors de la suppression de la facture';
        this.showDeleteModal = false;
        
        // Masquer le message d'erreur après 3 secondes
        setTimeout(() => {
          this.errorMessage = null;
        }, 3000);
      }
    });
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.selectedFacture = null;
  }

  exportFactures(format: 'pdf' | 'excel' | 'csv'): void {
    // Simuler l'exportation des factures
    this.successMessage = `Exportation des factures au format ${format.toUpperCase()} en cours...`;
    
    setTimeout(() => {
      this.successMessage = `Factures exportées avec succès au format ${format.toUpperCase()}`;
      
      setTimeout(() => {
        this.successMessage = null;
      }, 3000);
    }, 1500);
  }

  getStatusLabel(status: string): string {
    const statusMap: { [key: string]: string } = {
      'DRAFT': 'Brouillon',
      'PENDING': 'En attente',
      'PAID': 'Payée',
      'CANCELLED': 'Annulée'
    };
    return statusMap[status] || status;
  }

  getStatusClass(status: string): string {
    const classMap: { [key: string]: string } = {
      'DRAFT': 'badge-secondary',
      'PENDING': 'badge-warning',
      'PAID': 'badge-success',
      'CANCELLED': 'badge-danger'
    };
    return classMap[status] || 'badge-secondary';
  }

  createNewFacture(): void {
    // Rediriger vers le composant de création de facture avec un paramètre indiquant que c'est l'administrateur qui crée la facture
    this.router.navigate(['/facturation/create'], { queryParams: { source: 'admin' } });
  }
}
