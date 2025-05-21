import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FactureService, Facture, FactureItem } from '../../services/facture.service';
import { finalize } from 'rxjs/operators';

// Étendre l'interface FactureItem pour inclure la propriété showDetails
interface ExtendedFactureItem extends FactureItem {
  showDetails?: boolean;
}

@Component({
  selector: 'app-facture-detail',
  templateUrl: './facture-detail.component.html',
  styleUrls: ['./facture-detail.component.scss']
})
export class FactureDetailComponent implements OnInit {
  factureId: string | null = null;
  facture: Facture | null = null;
  isLoading = false;
  errorMessage: string | null = null;

  // Propriété pour suivre les éléments dont les détails sont affichés
  expandedItems: Set<string> = new Set<string>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private factureService: FactureService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.factureId = params.get('id');
      if (this.factureId) {
        this.loadFacture(this.factureId);
      }
    });
  }

  loadFacture(id: string): void {
    this.isLoading = true;
    this.errorMessage = null;

    this.factureService.getFactureById(id)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (facture) => {
          this.facture = facture;

          // Initialiser la propriété showDetails pour chaque élément
          if (this.facture && this.facture.items) {
            this.facture.items.forEach((item: any) => {
              item.showDetails = false;
            });
          }
        },
        error: (error) => {
          console.error('Erreur lors du chargement de la facture:', error);
          this.errorMessage = 'Erreur lors du chargement de la facture. Veuillez réessayer.';
        }
      });
  }

  goBack(): void {
    this.router.navigate(['/facturation/list']);
  }

  generatePdf(): void {
    if (!this.factureId) return;

    this.isLoading = true;
    this.factureService.generatePdf(this.factureId)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          window.open(url);
        },
        error: (error) => {
          console.error('Erreur lors de la génération du PDF:', error);
          this.errorMessage = 'Erreur lors de la génération du PDF. Veuillez réessayer.';
        }
      });
  }

  sendFactureByEmail(): void {
    if (!this.factureId) return;

    this.isLoading = true;
    this.factureService.sendFactureByEmail(
      this.factureId, 
      'client@example.com',
      'Votre facture',
      'Bonjour, veuillez trouver votre facture en pièce jointe.'
    )
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: () => {
          alert('Facture envoyée par email avec succès!');
        },
        error: (error) => {
          console.error('Erreur lors de l\'envoi de la facture par email:', error);
          this.errorMessage = 'Erreur lors de l\'envoi de la facture par email. Veuillez réessayer.';
        }
      });
  }

  updateFactureStatus(status: 'DRAFT' | 'PENDING' | 'PAID' | 'CANCELLED'): void {
    if (!this.factureId) return;

    this.isLoading = true;
    this.factureService.updateFactureStatus(this.factureId, status)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (updatedFacture) => {
          this.facture = updatedFacture;
          alert(`Statut de la facture mis à jour: ${status}`);
        },
        error: (error) => {
          console.error('Erreur lors de la mise à jour du statut:', error);
          this.errorMessage = 'Erreur lors de la mise à jour du statut. Veuillez réessayer.';
        }
      });
  }

  getSubtotal(): number {
    if (!this.facture || !this.facture.items) return 0;
    return this.facture.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  }

  getTaxAmount(): number {
    return this.getSubtotal() * 0.2;
  }

  getTotal(): number {
    return this.getSubtotal() + this.getTaxAmount();
  }

  getDiscountAmount(): number {
    if (!this.facture || !this.facture.discount) return 0;
    return this.getSubtotal() * (this.facture.discount / 100);
  }

  getFinalTotal(): number {
    return this.getTotal() - this.getDiscountAmount();
  }

  toggleItemDetails(item: FactureItem): void {
    const itemId = item.id;
    if (this.expandedItems.has(itemId)) {
      this.expandedItems.delete(itemId);
    } else {
      this.expandedItems.add(itemId);
    }
  }

  isItemExpanded(item: FactureItem): boolean {
    return this.expandedItems.has(item.id);
  }

  getMetadataKeys(metadata: Record<string, any>): string[] {
    if (!metadata) return [];
    return Object.keys(metadata);
  }
}