import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Facture, FactureService } from '../../services/facture.service';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-vendor-facture-detail',
  templateUrl: './vendor-facture-detail.component.html',
  styleUrls: ['./vendor-facture-detail.component.scss']
})
export class VendorFactureDetailComponent implements OnInit {
  // Exposer Math pour l'utiliser dans le template
  public Math = Math;

  // Helper pour vérifier si une facture a une remise
  hasDiscount(): boolean {
    return this.facture !== null && this.facture !== undefined && 
           this.facture.discount !== null && this.facture.discount !== undefined && 
           this.facture.discount > 0;
  }
  
  // Helper pour obtenir le montant de la remise
  getDiscount(): number {
    return this.facture?.discount || 0;
  }
  
  // Helper pour obtenir le taux de TVA
  getTaxRate(): number {
    return 20; // TVA fixe à 20%
  }
  
  // Helper pour calculer le sous-total (somme des articles)
  calculateSubtotal(): number {
    if (!this.facture) return 0;
    return this.facture.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }

  // Helper pour obtenir le montant de la TVA
  getTaxAmount(): number {
    if (!this.facture) return 0;
    return this.calculateSubtotal() * 0.2; // 20% de TVA
  }
  
  facture: Facture | null = null;
  isLoading: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  
  // Pour l'envoi par email
  emailRecipient: string = '';
  emailSubject: string = '';
  emailMessage: string = '';
  
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private factureService: FactureService,
    public authService: AuthService
  ) { }

  ngOnInit(): void {
    this.loadFacture();
  }
  
  loadFacture(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.errorMessage = 'ID de facture manquant';
      this.isLoading = false;
      return;
    }
    
    this.factureService.getFactureById(id).subscribe({
      next: (facture) => {
        this.facture = facture;
        
        // Préremplir les champs d'email
        this.emailRecipient = facture.clientEmail || '';
        this.emailSubject = `Facture ${facture.number || id}`;
        this.emailMessage = `Cher ${facture.clientName},\n\nVeuillez trouver ci-joint votre facture ${facture.number || id} d'un montant de ${facture.total.toFixed(2)} €.\n\nCordialement,\n${this.authService.getCurrentUser()?.username || 'L\'équipe commerciale'}`;
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement de la facture:', error);
        this.errorMessage = 'Erreur lors du chargement de la facture. Veuillez réessayer.';
        this.isLoading = false;
      }
    });
  }
  
  generatePdf(): void {
    if (!this.facture || !this.facture.id) return;
    
    this.factureService.generatePdf(this.facture.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `facture-${this.facture?.number || this.facture?.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      },
      error: (error) => {
        console.error('Erreur lors de la génération du PDF:', error);
        this.errorMessage = 'Erreur lors de la génération du PDF. Veuillez réessayer.';
      }
    });
  }
  
  printFacture(): void {
    window.print();
  }
  
  sendEmail(): void {
    if (!this.facture || !this.facture.id) return;
    
    if (!this.emailRecipient) {
      this.errorMessage = 'Veuillez saisir une adresse email';
      return;
    }
    
    this.isLoading = true;
    this.errorMessage = null;
    
    this.factureService.sendFactureByEmail(
      this.facture.id, 
      this.emailRecipient,
      this.emailSubject,
      this.emailMessage
    ).subscribe({
      next: () => {
        this.successMessage = `Facture envoyée avec succès à ${this.emailRecipient}`;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors de l\'envoi de la facture par email:', error);
        this.errorMessage = 'Erreur lors de l\'envoi de la facture par email. Veuillez réessayer.';
        this.isLoading = false;
      }
    });
  }
  
  updateFactureStatus(status: 'DRAFT' | 'PENDING' | 'PAID' | 'CANCELLED'): void {
    if (!this.facture || !this.facture.id) return;
    
    this.isLoading = true;
    this.errorMessage = null;
    
    this.factureService.updateFactureStatus(this.facture.id, status).subscribe({
      next: (updatedFacture) => {
        this.facture = updatedFacture;
        this.successMessage = `Statut de la facture mis à jour: ${this.getStatusLabel(status)}`;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour du statut:', error);
        this.errorMessage = 'Erreur lors de la mise à jour du statut. Veuillez réessayer.';
        this.isLoading = false;
      }
    });
  }
  
  goBack(): void {
    this.router.navigate(['/facturation']);
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
}
