import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PurchaseOrder, PurchaseOrderStatus } from '../../models/purchase-order.model';
import { PurchaseOrderService } from '../../services/purchase-order.service';

@Component({
  selector: 'app-purchase-order-list',
  templateUrl: './purchase-order-list.component.html',
  styleUrls: ['./purchase-order-list.component.scss']
})
export class PurchaseOrderListComponent implements OnInit {
  // Exposer Math pour l'utiliser dans le template
  public Math = Math;
  
  // Données
  purchaseOrders: PurchaseOrder[] = [];
  filteredOrders: PurchaseOrder[] = [];
  isLoading: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  
  // Indicateur de données fictives
  usingMockData: boolean = false;
  mockDataWarningMessage: string | null = null;
  
  // Filtres
  searchTerm: string = '';
  dateRange: { start: Date | null, end: Date | null } = { start: null, end: null };
  statusFilter: string = '';
  
  // Pagination
  currentPage: number = 1;
  pageSize: number = 10;
  totalItems: number = 0;
  
  // Tri
  sortField: string = 'orderDate';
  sortDirection: 'asc' | 'desc' = 'desc';

  constructor(
    private purchaseOrderService: PurchaseOrderService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadPurchaseOrders();
    
    // S'abonner aux notifications de création/mise à jour de commandes
    this.purchaseOrderService.orderCreated$.subscribe(order => {
      this.loadPurchaseOrders();
      if (this.usingMockData) {
        this.showSuccessMessage('Commande d\'achat créée avec succès (mode démo)');
      } else {
        this.showSuccessMessage('Commande d\'achat créée avec succès');
      }
    });
    
    this.purchaseOrderService.orderUpdated$.subscribe(order => {
      this.loadPurchaseOrders();
      if (this.usingMockData) {
        this.showSuccessMessage('Commande d\'achat mise à jour avec succès (mode démo)');
      } else {
        this.showSuccessMessage('Commande d\'achat mise à jour avec succès');
      }
    });
  }

  /**
   * Charge la liste des commandes d'achat
   */
  loadPurchaseOrders(): void {
    this.isLoading = true;
    this.errorMessage = null;
    this.mockDataWarningMessage = null;
    
    this.purchaseOrderService.getPurchaseOrders().subscribe({
      next: (orders: PurchaseOrder[]) => {
        this.purchaseOrders = orders;
        this.applyFilters();
        this.isLoading = false;
        
        // Vérifier si nous utilisons des données fictives
        this.usingMockData = !this.purchaseOrderService.isBackendAvailable();
        if (this.usingMockData) {
          this.mockDataWarningMessage = this.purchaseOrderService.getBackendUnavailableMessage();
        }
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des commandes d\'achat:', error);
        this.errorMessage = 'Erreur lors du chargement des commandes d\'achat. Veuillez réessayer.';
        this.isLoading = false;
      }
    });
  }

  /**
   * Applique les filtres à la liste des commandes
   */
  applyFilters(): void {
    let filtered = [...this.purchaseOrders];
    
    // Filtre par terme de recherche
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(order => 
        (order.orderNumber?.toLowerCase().includes(term) || false) ||
        (order.supplierName?.toLowerCase().includes(term) || false)
      );
    }
    
    // Filtre par date
    if (this.dateRange.start) {
      const startDate = new Date(this.dateRange.start);
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.orderDate);
        return orderDate >= startDate;
      });
    }
    
    if (this.dateRange.end) {
      const endDate = new Date(this.dateRange.end);
      endDate.setHours(23, 59, 59, 999); // Fin de journée
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.orderDate);
        return orderDate <= endDate;
      });
    }
    
    // Filtre par statut
    if (this.statusFilter) {
      filtered = filtered.filter(order => order.status === this.statusFilter);
    }
    
    // Tri
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (this.sortField === 'orderDate') {
        comparison = new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime();
      } else if (this.sortField === 'total') {
        comparison = a.total - b.total;
      } else if (this.sortField === 'supplierName') {
        comparison = (a.supplierName || '').localeCompare(b.supplierName || '');
      } else if (this.sortField === 'status') {
        comparison = (a.status || '').localeCompare(b.status || '');
      }
      
      return this.sortDirection === 'asc' ? comparison : -comparison;
    });
    
    // Pagination
    this.totalItems = filtered.length;
    const startIndex = (this.currentPage - 1) * this.pageSize;
    this.filteredOrders = filtered.slice(startIndex, startIndex + this.pageSize);
  }

  /**
   * Réinitialise les filtres
   */
  resetFilters(): void {
    this.searchTerm = '';
    this.dateRange = { start: null, end: null };
    this.statusFilter = '';
    this.applyFilters();
  }

  /**
   * Change la page courante
   */
  changePage(page: number): void {
    this.currentPage = page;
    this.applyFilters();
  }

  /**
   * Change le champ de tri
   */
  changeSort(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
  }

  /**
   * Navigue vers la page de détail d'une commande
   */
  viewOrder(id: string): void {
    this.router.navigate(['/stock/purchase-orders', id]);
  }

  /**
   * Navigue vers la page de modification d'une commande
   */
  editOrder(id: string): void {
    this.router.navigate(['/stock/purchase-orders/edit', id]);
  }

  /**
   * Crée une nouvelle commande
   */
  createNewOrder(): void {
    this.router.navigate(['/stock/purchase-orders/new']);
  }

  /**
   * Génère un PDF pour une commande
   */
  generatePdf(id: string): void {
    this.isLoading = true;
    this.purchaseOrderService.generatePdf(id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `commande-${id}.pdf`;
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

  /**
   * Envoie une commande par email
   */
  sendByEmail(id: string, email: string): void {
    if (!email) {
      this.showErrorMessage('Adresse email manquante');
      return;
    }
    
    this.isLoading = true;
    this.purchaseOrderService.sendPurchaseOrderByEmail(
      id, 
      email,
      'Commande d\'achat',
      'Veuillez trouver ci-joint la commande d\'achat demandée.'
    ).subscribe({
      next: () => {
        this.isLoading = false;
        this.showSuccessMessage('Commande envoyée avec succès à ' + email);
      },
      error: (error) => {
        console.error('Erreur lors de l\'envoi de la commande par email:', error);
        this.isLoading = false;
        this.showErrorMessage('Erreur lors de l\'envoi de la commande par email');
      }
    });
  }

  /**
   * Confirme et supprime une commande
   */
  confirmDeleteOrder(id: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette commande d\'achat ? Cette action est irréversible.')) {
      this.deleteOrder(id);
    }
  }

  /**
   * Supprime une commande
   */
  deleteOrder(id: string): void {
    this.isLoading = true;
    this.purchaseOrderService.deletePurchaseOrder(id).subscribe({
      next: () => {
        this.loadPurchaseOrders();
        this.showSuccessMessage('Commande d\'achat supprimée avec succès');
      },
      error: (error) => {
        console.error('Erreur lors de la suppression de la commande d\'achat:', error);
        this.isLoading = false;
        this.showErrorMessage('Erreur lors de la suppression de la commande d\'achat');
      }
    });
  }

  /**
   * Met à jour le statut d'une commande
   */
  updateOrderStatus(id: string, status: PurchaseOrderStatus): void {
    this.isLoading = true;
    this.purchaseOrderService.updatePurchaseOrderStatus(id, status).subscribe({
      next: (updatedOrder) => {
        // Mettre à jour la commande dans la liste locale
        const index = this.purchaseOrders.findIndex(o => o.id === id);
        if (index !== -1) {
          this.purchaseOrders[index] = updatedOrder;
        }
        this.applyFilters();
        this.isLoading = false;
        
        // Vérifier si nous utilisons des données fictives après la mise à jour
        this.usingMockData = !this.purchaseOrderService.isBackendAvailable();
        if (this.usingMockData) {
          this.mockDataWarningMessage = this.purchaseOrderService.getBackendUnavailableMessage();
          this.showSuccessMessage(`Statut de la commande mis à jour: ${this.getStatusLabel(status)} (mode démo)`);
        } else {
          this.showSuccessMessage(`Statut de la commande mis à jour: ${this.getStatusLabel(status)}`);
        }
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour du statut de la commande:', error);
        this.isLoading = false;
        this.showErrorMessage('Erreur lors de la mise à jour du statut de la commande');
      }
    });
  }

  /**
   * Affiche un message de succès
   */
  showSuccessMessage(message: string): void {
    this.successMessage = message;
    this.errorMessage = null;
    setTimeout(() => {
      this.successMessage = null;
    }, 3000);
  }

  /**
   * Affiche un message d'erreur
   */
  showErrorMessage(message: string): void {
    this.errorMessage = message;
    this.successMessage = null;
    setTimeout(() => {
      this.errorMessage = null;
    }, 3000);
  }

  /**
   * Retourne la classe CSS pour un statut donné
   */
  getStatusClass(status: string): string {
    switch (status) {
      case 'DRAFT':
        return 'status-draft';
      case 'SENT':
        return 'status-sent';
      case 'CONFIRMED':
        return 'status-confirmed';
      case 'DELIVERED':
        return 'status-delivered';
      case 'CANCELLED':
        return 'status-cancelled';
      default:
        return '';
    }
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
   * Retourne le nombre de commandes par statut
   */
  getOrderCountByStatus(status: PurchaseOrderStatus): number {
    return this.purchaseOrders.filter(order => order.status === status).length;
  }

  /**
   * Retourne le total des commandes par statut
   */
  getTotalByStatus(status: PurchaseOrderStatus): number {
    return this.purchaseOrders
      .filter(order => order.status === status)
      .reduce((sum, order) => sum + order.total, 0);
  }
}
