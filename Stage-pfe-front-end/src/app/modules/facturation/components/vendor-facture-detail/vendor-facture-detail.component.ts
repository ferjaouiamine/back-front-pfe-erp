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
  public Math = Math;

  hasDiscount(): boolean {
    return this.facture !== null && this.facture !== undefined && 
           this.facture.discount !== null && this.facture.discount !== undefined && 
           this.facture.discount > 0;
  }

  getDiscount(): number {
    return this.facture?.discount || 0;
  }

  getTaxRate(): number {
    return 20;
  }

  calculateSubtotal(): number {
    if (!this.facture || !this.facture.items) {
      console.warn('Facture ou items non définis', { facture: this.facture });
      return 0;
    }
    return this.facture.items.reduce((sum, item) => {
      const itemTotal = (item.quantity || 0) * (item.unitPrice || 0);
      return sum + itemTotal;
    }, 0);
  }

  getTaxAmount(): number {
    const subtotal = this.calculateSubtotal();
    if (subtotal <= 0) return 0;
    return subtotal * 0.2;
  }

  facture: Facture | null = null;
  isLoading: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  
  // Indique si la vue est accédée depuis le module admin
  isAdminView: boolean = false;

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
    // Vérifier si la vue est accédée depuis le module admin
    this.route.queryParams.subscribe(params => {
      this.isAdminView = params['source'] === 'admin';
      console.log('Vue admin:', this.isAdminView);
    });
    
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
        
        // Afficher un message si aucune ligne n'est trouvée
        if (!this.facture.items || this.facture.items.length === 0) {
          console.warn('Aucune ligne de facture trouvée pour cette facture');
          // Ne plus ajouter de lignes fictives automatiquement
          // Mais ajouter un bouton pour le faire manuellement
          this.errorMessage = 'Aucun article trouvé pour cette facture. Vous pouvez ajouter des articles manuellement.';
        } else {
          console.log(`${this.facture.items.length} articles trouvés pour cette facture`);
        }
        
        console.log('Facture chargée avec succès:', this.facture);
        
        this.emailRecipient = facture.clientEmail || '';
        this.emailSubject = `Facture ${facture.number || id}`;
        
        // Vérifier que total est défini avant d'appeler toFixed
        const totalAmount = facture.total !== undefined && facture.total !== null ? 
                         Number(facture.total).toFixed(2) : '0.00';
        
        this.emailMessage = `Cher ${facture.clientName || 'client'},\n\nVeuillez trouver ci-joint votre facture ${facture.number || id} d'un montant de ${totalAmount} €.\n\nCordialement,\n${this.authService.getCurrentUser()?.username || 'L\'équipe commerciale'}`;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement de la facture:', error);
        this.errorMessage = 'Erreur lors du chargement de la facture. Veuillez réessayer.';
        this.isLoading = false;
      }
    });
  }
  
  /**
   * Ajoute manuellement des articles fictifs à la facture
   */
  addMockItems(): void {
    if (!this.facture || !this.facture.id) return;
    
    // Générer les articles fictifs
    const mockItems = this.generateMockItems(this.facture.id);
    
    // Ajouter les articles à la facture
    if (!this.facture.items) {
      this.facture.items = [];
    }
    
    this.facture.items = mockItems;
    
    // Recalculer les totaux
    this.facture.subtotal = this.calculateSubtotal();
    this.facture.tax = this.getTaxAmount();
    this.facture.total = this.facture.subtotal + this.facture.tax - (this.facture.discount || 0);
    
    // Effacer le message d'erreur
    this.errorMessage = null;
    this.successMessage = 'Articles fictifs ajoutés pour démonstration.';
    
    // Faire disparaître le message de succès après 3 secondes
    setTimeout(() => {
      this.successMessage = null;
    }, 3000);
  }
  
  /**
   * Enregistre les modifications et redirige vers la liste des factures
   * Cette méthode est appelée lorsque l'utilisateur clique sur le bouton d'enregistrement
   * après avoir changé le statut d'une facture
   */
  saveAndRefresh(): void {
    // Afficher un message de confirmation temporaire
    this.successMessage = 'Modifications enregistrées avec succès! Redirection en cours...';
    
    // Pas besoin de récupérer à nouveau la facture, car elle a déjà été mise à jour dans updateFactureStatus
    // Rediriger directement vers la liste des factures après un court délai
    setTimeout(() => {
      // Utiliser la même destination que dans goBack() pour plus de cohérence
      if (this.isAdminView) {
        // Si c'est l'administrateur, rediriger vers la liste des factures dans le module admin
        this.router.navigate(['/admin/factures']);
      } else {
        // Sinon, rediriger vers la liste des factures du vendeur
        this.router.navigate(['/facturation/list']);
      }
    }, 800); // Délai légèrement plus long pour permettre à l'utilisateur de voir le message de succès
  }
  
  /**
   * Génère des lignes de facture fictives pour démonstration
   */
  private generateMockItems(factureId: string): any[] {
    const mockItems = [
      {
        id: '1',
        factureId: factureId,
        productId: '1',
        productName: 'Ordinateur portable',
        description: 'Ordinateur portable haute performance',
        quantity: 1,
        unitPrice: 899.99,
        total: 899.99,
        taxRate: 20,
        tax: 179.99,
        discount: 0
      },
      {
        id: '2',
        factureId: factureId,
        productId: '2',
        productName: 'Souris sans fil',
        description: 'Souris ergonomique sans fil',
        quantity: 2,
        unitPrice: 29.99,
        total: 59.98,
        taxRate: 20,
        tax: 12.00,
        discount: 0
      },
      {
        id: '3',
        factureId: factureId,
        productId: '3',
        productName: 'Clavier mécanique',
        description: 'Clavier mécanique rétroéclairé',
        quantity: 1,
        unitPrice: 79.99,
        total: 79.99,
        taxRate: 20,
        tax: 16.00,
        discount: 0
      }
    ];
    
    return mockItems;
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
    
    // Générer un message personnalisé en fonction du statut
    let commentaire = '';
    
    if (status === 'PAID') {
      commentaire = `Facture marquée comme payée le ${new Date().toLocaleDateString()}`;
    } else if (status === 'PENDING') {
      commentaire = 'Facture en attente de paiement';
    } else if (status === 'CANCELLED') {
      commentaire = 'Facture annulée';
    }
    
    // Mise à jour du statut à la fois localement et sur le backend
    try {
      // Sauvegarder l'ancien statut au cas où nous voudrions revenir en arrière
      const oldStatus = this.facture.status;
      
      // Mettre à jour le statut localement d'abord pour une expérience utilisateur réactive
      this.facture.status = status;
      
      // Si le statut est PAID, mettre à jour la date de finalisation
      if (status === 'PAID' && !this.facture.dueDate) {
        this.facture.dueDate = new Date().toISOString();
      }
      
      // Ajouter le commentaire aux notes si elles existent
      if (this.facture.notes) {
        this.facture.notes += '\n' + commentaire;
      } else {
        this.facture.notes = commentaire;
      }
      
      // Appeler le backend pour mettre à jour le statut avec commentaire
      this.factureService.updateFactureStatusInDetail(this.facture.id, status, commentaire).subscribe({
        next: (updatedFacture) => {
          console.log('Facture mise à jour avec succès sur le backend:', updatedFacture);
          
          // Vérifier si le statut reçu du backend correspond au statut demandé
          if (updatedFacture.status !== status) {
            console.warn(`Le statut reçu du backend (${updatedFacture.status}) ne correspond pas au statut demandé (${status}). Correction locale.`);
            // Forcer le statut à celui que nous avons demandé
            updatedFacture.status = status;
          }
          
          // Mettre à jour la facture locale avec les données du backend
          this.facture = updatedFacture;
          
          this.successMessage = `Statut de la facture mis à jour: ${this.getStatusLabel(status)}`;
          if (status === 'PAID') {
            this.successMessage += ' - Le paiement a été enregistré.';
          }
          
          // Notifier les autres composants que la facture a été mise à jour
          this.factureService.notifyFactureUpdated(updatedFacture);
          
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Erreur lors de la mise à jour du statut sur le backend:', error);
          
          // En cas d'erreur, revenir à l'ancien statut
          if (this.facture) {
            this.facture.status = oldStatus;
          }
          
          this.errorMessage = 'Erreur lors de la mise à jour du statut sur le serveur. La mise à jour a été effectuée localement uniquement.';
          this.isLoading = false;
        }
      });
      
      console.log(`Statut de la facture ${this.facture.id} en cours de mise à jour: ${oldStatus} -> ${status}`);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      this.errorMessage = 'Erreur lors de la mise à jour du statut. Veuillez réessayer.';
      this.isLoading = false;
    }
  }

  goBack(): void {
    if (this.isAdminView) {
      // Si c'est l'administrateur, rediriger vers la liste des factures dans le module admin
      this.router.navigate(['/admin/factures']);
    } else {
      // Sinon, rediriger vers la liste des factures du vendeur
      this.router.navigate(['/facturation/list']);
    }
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
