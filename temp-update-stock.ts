/**
* Met à jour automatiquement le stock après l'impression d'un ticket
* et rafraîchit la page pour afficher les quantités mises à jour
* @param invoiceNumber Numéro de facture/ticket pour référence
*/
private updateStockAfterPrinting(invoiceNumber: string): void {
  // Afficher un message de chargement pendant la mise à jour du stock
  this.loadingMessage = 'Mise à jour du stock en cours...';
  
  // Appeler le service de caisse pour mettre à jour le stock
  this.caisseService.updateStockAfterPrint(this.cartItems, invoiceNumber)
    .pipe(
      finalize(() => {
        // Masquer le message de chargement une fois terminé
        this.loadingMessage = null;
      })
    )
    .subscribe({
      next: () => {
        console.log('Stock mis à jour avec succès après impression du ticket');
        this.successMessage = 'Ticket imprimé et stock mis à jour avec succès!';
        
        // Attendre un court délai pour s'assurer que le backend a terminé la mise à jour
        setTimeout(() => {
          // Forcer le rafraîchissement des produits depuis le backend sans utiliser de cache
          this.productService.clearCache();
          this.loadProducts();
          
          // Réinitialiser le panier après l'impression et la mise à jour du stock
          this.resetForm();
          
          // Forcer une nouvelle recherche pour mettre à jour les produits filtrés
          if (this.searchTerm) {
            this.searchProducts();
          }
        }, 1000); // Attendre 1 seconde pour s'assurer que le backend a terminé
        
        setTimeout(() => this.successMessage = null, 3000);
      },
      error: (error) => {
        console.error('Erreur lors de la mise à jour du stock:', error);
        this.errorMessage = 'Le ticket a été imprimé mais une erreur est survenue lors de la mise à jour du stock.';
        
        // Rafraîchir quand même les produits pour vérifier l'état actuel du stock après un délai
        setTimeout(() => {
          this.productService.clearCache();
          this.loadProducts();
        }, 1000);
        
        setTimeout(() => this.errorMessage = null, 5000);
      }
    });
}
