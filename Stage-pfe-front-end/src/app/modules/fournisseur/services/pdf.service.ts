import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { CommandeFournisseur, LigneCommandeFournisseur } from './fournisseur.service';
import { DatePipe } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  private datePipe: DatePipe;

  constructor() {
    this.datePipe = new DatePipe('fr-FR');
  }

  /**
   * Génère un bon de commande au format PDF
   * @param commande La commande à transformer en PDF
   * @returns Le document PDF généré
   */
  generateBonCommande(commande: CommandeFournisseur): jsPDF {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;

    // Ajouter le logo et l'en-tête
    this.addHeader(doc, y, pageWidth);
    y += 30;

    // Informations de la commande
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('BON DE COMMANDE', pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(10);
    doc.text(`N° de commande: ${commande.numero}`, margin, y);
    y += 6;
    
    const dateFormatted = this.datePipe.transform(commande.date, 'dd/MM/yyyy') || '';
    doc.text(`Date: ${dateFormatted}`, margin, y);
    y += 6;
    
    doc.text(`Statut: ${commande.statut}`, margin, y);
    y += 15;

    // Informations client
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMATIONS CLIENT', margin, y);
    y += 6;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Nom: ${commande.client.nom}`, margin, y);
    y += 6;
    
    doc.text(`Email: ${commande.client.email}`, margin, y);
    y += 6;
    
    doc.text(`Téléphone: ${commande.client.telephone}`, margin, y);
    y += 15;

    // Tableau des produits
    this.addProductTable(doc, commande.lignes, y);
    // Récupérer la position Y après le tableau (si disponible)
    const finalY = (doc as any).lastAutoTable?.finalY;
    y = finalY ? finalY + 15 : y + 10;

    // Totaux
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: ${commande.montantTotal.toFixed(2)} €`, pageWidth - margin, y, { align: 'right' });
    y += 20;

    // Commentaires
    if (commande.commentaire) {
      doc.setFont('helvetica', 'bold');
      doc.text('COMMENTAIRES:', margin, y);
      y += 6;
      
      doc.setFont('helvetica', 'normal');
      const commentLines = doc.splitTextToSize(commande.commentaire, pageWidth - (2 * margin));
      doc.text(commentLines, margin, y);
      y += (6 * commentLines.length) + 10;
    }

    // Pied de page
    this.addFooter(doc, pageHeight);

    return doc;
  }

  /**
   * Génère un avis d'expédition au format PDF
   * @param commande La commande concernée
   * @param avisExpedition Les informations d'expédition
   * @returns Le document PDF généré
   */
  generateAvisExpedition(commande: CommandeFournisseur, avisExpedition: any): jsPDF {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;

    // Ajouter le logo et l'en-tête
    this.addHeader(doc, y, pageWidth);
    y += 30;

    // Titre
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('AVIS D\'EXPÉDITION', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Informations de l'avis d'expédition
    doc.setFontSize(10);
    doc.text(`N° d'avis: ${avisExpedition.numero}`, margin, y);
    y += 6;
    
    const dateExpFormatted = this.datePipe.transform(avisExpedition.dateExpedition, 'dd/MM/yyyy') || '';
    doc.text(`Date d'expédition: ${dateExpFormatted}`, margin, y);
    y += 6;
    
    const dateLivFormatted = this.datePipe.transform(avisExpedition.dateLivraisonEstimee, 'dd/MM/yyyy') || '';
    doc.text(`Date de livraison estimée: ${dateLivFormatted}`, margin, y);
    y += 6;
    
    doc.text(`Transporteur: ${avisExpedition.transporteur}`, margin, y);
    y += 6;
    
    doc.text(`N° de suivi: ${avisExpedition.numeroSuivi}`, margin, y);
    y += 15;

    // Informations de la commande
    doc.setFont('helvetica', 'bold');
    doc.text('COMMANDE CONCERNÉE', margin, y);
    y += 6;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`N° de commande: ${commande.numero}`, margin, y);
    y += 6;
    
    const dateCommandeFormatted = this.datePipe.transform(commande.date, 'dd/MM/yyyy') || '';
    doc.text(`Date de commande: ${dateCommandeFormatted}`, margin, y);
    y += 15;

    // Tableau des produits
    this.addProductTable(doc, commande.lignes, y);
    // Récupérer la position Y après le tableau (si disponible)
    const finalY = (doc as any).lastAutoTable?.finalY;
    y = finalY ? finalY + 15 : y + 10;

    // Commentaires
    if (avisExpedition.commentaires) {
      doc.setFont('helvetica', 'bold');
      doc.text('COMMENTAIRES:', margin, y);
      y += 6;
      
      doc.setFont('helvetica', 'normal');
      const commentLines = doc.splitTextToSize(avisExpedition.commentaires, pageWidth - (2 * margin));
      doc.text(commentLines, margin, y);
    }

    // Pied de page
    this.addFooter(doc, pageHeight);

    return doc;
  }

  /**
   * Génère une facture au format PDF
   * @param commande La commande concernée
   * @param facture Les informations de facturation
   * @returns Le document PDF généré
   */
  generateFacture(commande: CommandeFournisseur, facture: any): jsPDF {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = margin;

    // Ajouter le logo et l'en-tête
    this.addHeader(doc, y, pageWidth);
    y += 30;

    // Titre
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('FACTURE', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Informations de la facture
    doc.setFontSize(10);
    doc.text(`N° de facture: ${facture.numero}`, margin, y);
    y += 6;
    
    const dateFactureFormatted = this.datePipe.transform(facture.dateFacture, 'dd/MM/yyyy') || '';
    doc.text(`Date de facture: ${dateFactureFormatted}`, margin, y);
    y += 6;
    
    const dateEcheanceFormatted = this.datePipe.transform(facture.dateEcheance, 'dd/MM/yyyy') || '';
    doc.text(`Date d'échéance: ${dateEcheanceFormatted}`, margin, y);
    y += 15;

    // Informations client
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMATIONS CLIENT', margin, y);
    y += 6;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Nom: ${commande.client.nom}`, margin, y);
    y += 6;
    
    doc.text(`Email: ${commande.client.email}`, margin, y);
    y += 6;
    
    doc.text(`Téléphone: ${commande.client.telephone}`, margin, y);
    y += 15;

    // Tableau des produits
    this.addProductTable(doc, commande.lignes, y);
    // Récupérer la position Y après le tableau (si disponible)
    const finalY = (doc as any).lastAutoTable?.finalY;
    y = finalY ? finalY + 15 : y + 10;

    // Totaux
    doc.setFont('helvetica', 'bold');
    doc.text('RÉCAPITULATIF', pageWidth - 70, y);
    y += 6;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Montant HT: ${facture.montantHT.toFixed(2)} €`, pageWidth - 70, y);
    y += 6;
    
    doc.text(`TVA (20%): ${facture.montantTVA.toFixed(2)} €`, pageWidth - 70, y);
    y += 6;
    
    doc.setFont('helvetica', 'bold');
    doc.text(`Total TTC: ${facture.montantTTC.toFixed(2)} €`, pageWidth - 70, y);
    y += 20;

    // Commentaires
    if (facture.commentaires) {
      doc.setFont('helvetica', 'bold');
      doc.text('COMMENTAIRES:', margin, y);
      y += 6;
      
      doc.setFont('helvetica', 'normal');
      const commentLines = doc.splitTextToSize(facture.commentaires, pageWidth - (2 * margin));
      doc.text(commentLines, margin, y);
    }

    // Pied de page
    this.addFooter(doc, pageHeight);

    return doc;
  }

  /**
   * Ajoute l'en-tête au document PDF
   */
  private addHeader(doc: jsPDF, y: number, pageWidth: number): void {
    // Logo (simulé avec du texte)
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 150);
    doc.text('COMPANY LOGO', 15, y + 10);
    
    // Informations de l'entreprise
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    doc.text([
      'Votre Entreprise',
      'Adresse: 123 Rue Principale',
      'Téléphone: 01 23 45 67 89',
      'Email: contact@entreprise.com'
    ], pageWidth - 15, y + 5, { align: 'right' });
    
    // Ligne de séparation
    doc.setDrawColor(200, 200, 200);
    doc.line(15, y + 20, pageWidth - 15, y + 20);
    
    // Réinitialiser la couleur du texte
    doc.setTextColor(0, 0, 0);
  }

  /**
   * Ajoute le tableau des produits au document PDF
   */
  private addProductTable(doc: jsPDF, lignes: LigneCommandeFournisseur[], y: number): void {
    // @ts-ignore
    doc.autoTable({
      startY: y,
      head: [['Référence', 'Produit', 'Quantité', 'Prix unitaire', 'Total']],
      body: lignes.map(ligne => [
        ligne.produit.reference,
        ligne.produit.nom,
        ligne.quantite.toString(),
        `${ligne.prixUnitaire.toFixed(2)} €`,
        `${ligne.montantTotal.toFixed(2)} €`
      ]),
      headStyles: {
        fillColor: [60, 60, 150],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [240, 240, 250]
      },
      margin: { left: 15, right: 15 }
    });
  }

  /**
   * Ajoute le pied de page au document PDF
   */
  private addFooter(doc: jsPDF, pageHeight: number): void {
    const margin = 15;
    const footerY = pageHeight - 10;
    
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Document généré automatiquement. Merci de votre confiance.', margin, footerY);
    
    const today = this.datePipe.transform(new Date(), 'dd/MM/yyyy HH:mm') || '';
    doc.text(`Généré le ${today}`, doc.internal.pageSize.getWidth() - margin, footerY, { align: 'right' });
  }
}
