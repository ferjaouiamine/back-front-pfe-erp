import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FactureService, Facture, FactureItem } from '../../services/facture.service';
import { finalize } from 'rxjs/operators';

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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private factureService: FactureService
  ) { }

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
          // Créer un URL pour le blob
          const url = window.URL.createObjectURL(blob);
          // Ouvrir le PDF dans un nouvel onglet
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
    this.factureService.sendFactureByEmail(this.factureId, 'client@example.com')
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

  // Méthodes utilitaires pour les calculs
  getSubtotal(): number {
    if (!this.facture || !this.facture.items) return 0;
    return this.facture.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  }

  getTaxAmount(): number {
    return this.getSubtotal() * 0.2; // TVA à 20%
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
}
