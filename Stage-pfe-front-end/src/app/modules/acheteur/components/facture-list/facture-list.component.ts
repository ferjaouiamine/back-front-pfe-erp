import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AcheteurService } from '../../services';
import { FactureService, Facture } from '../../../facturation/services/facture.service';
import { finalize } from 'rxjs/operators';

// Interface pour les factures avec propriété payee pour la rétrocompatibilité
interface FactureWithPaymentStatus extends Facture {
  payee?: boolean;
}

// Interface Facture est maintenant importée depuis le service

@Component({
  selector: 'app-facture-list',
  templateUrl: './facture-list.component.html',
  styleUrls: ['./facture-list.component.scss']
})
export class FactureListComponent implements OnInit {
  factures: FactureWithPaymentStatus[] = [];
  loading: boolean = true;
  error: string | null = null;
  message: { type: 'success' | 'warning' | 'danger' | 'info', text: string } | null = null;
  
  // Pagination et filtrage
  currentPage: number = 1;
  pageSize: number = 10;
  totalItems: number = 0;
  searchTerm: string = '';

  constructor(
    private acheteurService: AcheteurService,
    private factureService: FactureService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadFactures();
  }

  loadFactures(): void {
    this.loading = true;
    this.error = null;

    // Utiliser le service de facturation pour récupérer les factures
    this.factureService.getFactures({
      searchTerm: this.searchTerm
    })
    .pipe(finalize(() => this.loading = false))
    .subscribe({
      next: (factures) => {
        // Mapper les factures pour ajouter la propriété payee basée sur le statut
        this.factures = factures.map(facture => ({
          ...facture,
          payee: facture.status === 'PAID'
        }));
        
        this.totalItems = factures.length;
        
        if (this.factures.length === 0 && this.searchTerm) {
          // Si aucune facture n'est trouvée avec le terme de recherche,
          // effacer le terme de recherche et réessayer
          this.searchTerm = '';
          this.loadFactures();
        }
      },
      error: (error) => {
        console.error('Erreur lors du chargement des factures:', error);
        this.error = 'Impossible de charger les factures. Veuillez réessayer plus tard.';
        
        // En cas d'erreur, utiliser des données fictives
        this.factures = [
          {
            id: '1',
            number: 'FAC-2025-001',
            date: '2025-06-01',
            clientName: 'Client Test',
            clientEmail: 'client@test.com',
            dueDate: '2025-07-01',
            status: 'PENDING',
            total: 450.75,
            items: [],
            payee: false
          },
          {
            id: '2',
            number: 'FAC-2025-002',
            date: '2025-06-05',
            clientName: 'Client Test 2',
            clientEmail: 'client2@test.com',
            dueDate: '2025-07-05',
            status: 'PENDING',
            total: 320.50,
            items: [],
            payee: false
          },
          {
            id: '3',
            number: 'FAC-2025-003',
            date: '2025-06-08',
            clientName: 'Client Test 3',
            clientEmail: 'client3@test.com',
            dueDate: '2025-07-08',
            status: 'PAID',
            total: 480.00,
            items: [],
            payee: true
          }
        ];
      }
    });
  }

  payerFacture(facture: any): void {
    this.router.navigate(['/acheteur/paiements/new'], { 
      queryParams: { 
        factureId: facture.id,
        montant: facture.total || facture.montantTotal
      } 
    });
  }
  
  /**
   * Télécharge le reçu d'une facture
   * @param facture La facture dont on veut télécharger le reçu
   */
  telechargerRecu(facture: FactureWithPaymentStatus): void {
    // Vérifier si la facture est payée (soit via la propriété payee, soit via le statut)
    if (!(facture.payee || facture.status === 'PAID')) {
      this.showMessage('warning', 'Vous devez d\'abord payer la facture pour télécharger le reçu.');
      return;
    }
    
    this.showMessage('info', 'Téléchargement du reçu en cours...');
    
    // Convertir l'ID en string si nécessaire (car le service attend un string)
    const factureId = facture.id.toString();
    
    this.factureService.downloadReceipt(factureId).subscribe({
      next: () => {
        // Le téléchargement est géré dans le service
        this.showMessage('success', 'Le reçu a été téléchargé avec succès.');
      },
      error: (error) => {
        console.error('Erreur lors du téléchargement du reçu:', error);
        this.showMessage('danger', 'Impossible de télécharger le reçu. Veuillez réessayer plus tard.');
      }
    });
  }
  
  /**
   * Affiche un message à l'utilisateur
   * @param type Type de message (success, warning, danger, info)
   * @param text Texte du message
   */
  private showMessage(type: 'success' | 'warning' | 'danger' | 'info', text: string): void {
    this.message = { type, text };
    
    // Effacer le message après 5 secondes
    setTimeout(() => {
      this.message = null;
    }, 5000);
  }
}
