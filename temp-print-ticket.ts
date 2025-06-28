/**
 * Imprime un ticket de caisse directement via la boîte de dialogue d'impression du navigateur
 * Cette méthode est optimisée pour les imprimantes thermiques de tickets
 * Elle met également à jour automatiquement le stock après l'impression
 */
printTicket(): void {
  if (this.cartItems.length === 0) {
    this.errorMessage = 'Le panier est vide. Impossible d\'imprimer un ticket.';
    setTimeout(() => this.errorMessage = null, 3000);
    return;
  }
  
  // Créer une fenêtre d'impression
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    this.errorMessage = 'Impossible d\'ouvrir la fenêtre d\'impression. Vérifiez les paramètres de votre navigateur.';
    setTimeout(() => this.errorMessage = null, 3000);
    return;
  }
  
  // Récupérer les informations de la facture ou utiliser des valeurs par défaut
  const invoiceNumber = this.clientForm.value.name ? 
    `FACTURE-${new Date().getTime().toString().substring(6)}` : 
    `TICKET-${new Date().getTime().toString().substring(6)}`;
  
  // Générer le contenu HTML pour l'impression
  printWindow.document.write(`
    <html>
      <head>
        <title>Ticket - ${invoiceNumber}</title>
        <style>
          body { 
            font-family: 'Courier New', monospace; 
            margin: 0; 
            padding: 5px; 
            width: 80mm; /* Largeur standard pour ticket thermique */
            font-size: 12px;
          }
          .header { text-align: center; margin-bottom: 10px; }
          .company-name { font-size: 16px; font-weight: bold; }
          .order-info { margin-bottom: 10px; }
          .order-number { font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
          th, td { padding: 3px 0; text-align: left; }
          .item-row td { border-bottom: 1px dashed #ddd; }
          .totals { margin-top: 10px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
          .grand-total { font-weight: bold; font-size: 14px; margin-top: 5px; }
          .footer { text-align: center; margin-top: 15px; font-size: 12px; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">DreamsPOS</div>
          <div>Système de point de vente</div>
        </div>
        
        <div class="order-info">
          <div class="order-number">${invoiceNumber}</div>
          <div>Date: ${new Date().toLocaleString()}</div>
          <div>Caissier: ${this.authService.getCurrentUser()?.username || 'Utilisateur'}</div>
          ${this.clientForm.value.name ? `<div>Client: ${this.clientForm.value.name}</div>` : ''}
        </div>
        
        <div class="divider"></div>
        
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th>Qté</th>
              <th>Prix</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${this.cartItems.map(item => `
              <tr class="item-row">
                <td>${item.productName}</td>
                <td>${item.quantity}</td>
                <td>${item.unitPrice.toFixed(2)} €</td>
                <td>${(item.unitPrice * item.quantity).toFixed(2)} €</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="divider"></div>
        
        <div class="totals">
          <div class="total-row">
            <span>Sous-total:</span>
            <span>${this.subtotal.toFixed(2)} €</span>
          </div>
          <div class="total-row">
            <span>TVA (${this.taxRate}%):</span>
            <span>${this.taxAmount.toFixed(2)} €</span>
          </div>
          ${this.discount > 0 ? `
          <div class="total-row">
            <span>Remise:</span>
            <span>${this.discount.toFixed(2)} €</span>
          </div>
          ` : ''}
          <div class="total-row grand-total">
            <span>Total:</span>
            <span>${this.total.toFixed(2)} €</span>
          </div>
        </div>
        
        <div class="divider"></div>
        
        <div class="payment-info">
          <div>Mode de paiement: ${this.selectedPaymentMethod === 'CASH' ? 'Espèces' : 
                                 this.selectedPaymentMethod === 'CARD' ? 'Carte bancaire' : 
                                 this.selectedPaymentMethod === 'TRANSFER' ? 'Virement' : 'Autre'}</div>
        </div>
        
        <div class="footer">
          <p>Merci pour votre achat!</p>
          <p>À bientôt!</p>
        </div>
      </body>
    </html>
  `);
  
  // Fermer le document et lancer l'impression
  printWindow.document.close();
  printWindow.focus();
  
  // Délai court pour s'assurer que le contenu est chargé avant d'imprimer
  setTimeout(() => {
    printWindow.print();
    
    // Mise à jour automatique du stock après impression
    this.updateStockAfterPrinting(invoiceNumber);
    
    // Optionnel: fermer la fenêtre après l'impression
    // printWindow.close();
  }, 500);
  
  this.successMessage = 'Ticket envoyé à l\'impression';
  setTimeout(() => this.successMessage = null, 2000);
}
