import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FournisseurService, CommandeFournisseur, AvisExpedition, FactureFournisseur } from '../../services/fournisseur.service';
import { PdfService } from '../../services/pdf.service';

@Component({
  selector: 'app-pdf-generator',
  templateUrl: './pdf-generator.component.html',
  styleUrls: ['./pdf-generator.component.scss']
})
export class PdfGeneratorComponent implements OnInit {
  commandeId: string = '';
  commande: CommandeFournisseur | null = null;
  avisExpedition: AvisExpedition | null = null;
  facture: FactureFournisseur | null = null;
  isLoading: boolean = true;
  error: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fournisseurService: FournisseurService,
    private pdfService: PdfService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    // Récupérer l'ID de la commande depuis l'URL
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.commandeId = id;
        this.chargerDonnees();
      } else {
        this.error = 'ID de commande non trouvé';
        this.isLoading = false;
      }
    });
  }

  /**
   * Charge les données nécessaires pour la génération des documents
   */
  chargerDonnees(): void {
    this.isLoading = true;
    this.error = null;
    
    this.fournisseurService.getCommandeById(this.commandeId)
      .subscribe({
        next: (commande) => {
          this.commande = commande;
          
          // Essayer de récupérer l'avis d'expédition si disponible
          this.fournisseurService.getAvisExpedition(this.commandeId)
            .subscribe({
              next: (avis: AvisExpedition) => this.avisExpedition = avis,
              error: () => this.avisExpedition = null
            });
          
          // Essayer de récupérer la facture si disponible
          // Utiliser getFactureByCommandeId pour récupérer la facture associée à la commande
          this.fournisseurService.getFactureByCommandeId(this.commandeId)
            .subscribe({
              next: (facture: FactureFournisseur) => this.facture = facture,
              error: () => this.facture = null,
              complete: () => this.isLoading = false
            });
        },
        error: (err) => {
          this.error = 'Erreur lors du chargement des données';
          this.isLoading = false;
          console.error('Erreur chargement données PDF:', err);
        }
      });
  }

  /**
   * Génère et télécharge un bon de commande au format PDF
   */
  genererBonCommande(): void {
    if (!this.commande) {
      this.snackBar.open('Données de commande non disponibles', 'Fermer', { duration: 3000 });
      return;
    }
    
    try {
      const doc = this.pdfService.generateBonCommande(this.commande);
      doc.save(`bon_commande_${this.commande.numero}.pdf`);
      
      this.snackBar.open('Bon de commande généré avec succès', 'Fermer', { duration: 3000 });
    } catch (error) {
      console.error('Erreur génération PDF:', error);
      this.snackBar.open('Erreur lors de la génération du PDF', 'Fermer', { duration: 3000 });
    }
  }

  /**
   * Génère et télécharge un avis d'expédition au format PDF
   */
  genererAvisExpedition(): void {
    if (!this.commande || !this.avisExpedition) {
      this.snackBar.open('Données d\'expédition non disponibles', 'Fermer', { duration: 3000 });
      return;
    }
    
    try {
      const doc = this.pdfService.generateAvisExpedition(this.commande, this.avisExpedition);
      doc.save(`avis_expedition_${this.avisExpedition.numero}.pdf`);
      
      this.snackBar.open('Avis d\'expédition généré avec succès', 'Fermer', { duration: 3000 });
    } catch (error) {
      console.error('Erreur génération PDF:', error);
      this.snackBar.open('Erreur lors de la génération du PDF', 'Fermer', { duration: 3000 });
    }
  }

  /**
   * Génère et télécharge une facture au format PDF
   */
  genererFacture(): void {
    if (!this.commande || !this.facture) {
      this.snackBar.open('Données de facturation non disponibles', 'Fermer', { duration: 3000 });
      return;
    }
    
    try {
      const doc = this.pdfService.generateFacture(this.commande, this.facture);
      doc.save(`facture_${this.facture.numero}.pdf`);
      
      this.snackBar.open('Facture générée avec succès', 'Fermer', { duration: 3000 });
    } catch (error) {
      console.error('Erreur génération PDF:', error);
      this.snackBar.open('Erreur lors de la génération du PDF', 'Fermer', { duration: 3000 });
    }
  }

  /**
   * Retourne à la page de détail de la commande
   */
  retourDetail(): void {
    this.router.navigate(['/fournisseur/commandes', this.commandeId]);
  }
}
