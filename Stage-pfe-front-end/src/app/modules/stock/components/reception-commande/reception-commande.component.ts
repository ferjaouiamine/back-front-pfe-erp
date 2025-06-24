import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StockCommandeService } from '../../services/stock-commande.service';
import { PurchaseOrder, PurchaseOrderItem } from '../../models/purchase-order.model';

@Component({
  selector: 'app-reception-commande',
  templateUrl: './reception-commande.component.html',
  styleUrls: ['./reception-commande.component.scss']
})
export class ReceptionCommandeComponent implements OnInit {
  @Input() commande!: PurchaseOrder;
  @Output() receptionComplete = new EventEmitter<void>();

  receptionForm!: FormGroup;
  loading = false;
  error: string | null = null;
  disponibilites: { [produitId: string]: boolean } = {};

  constructor(
    private fb: FormBuilder,
    private stockService: StockCommandeService,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.initForm();
    if (this.commande && this.commande.id) {
      this.verifierDisponibilite();
    }
  }

  private initForm(): void {
    const group: { [key: string]: FormControl } = {};
    
    if (this.commande && this.commande.items) {
      this.commande.items.forEach(item => {
        // Initialiser avec 0 ou la quantité restante à recevoir
        const quantiteRecue = 0; // À remplacer par la logique appropriée si nécessaire
        group[item.id as string] = this.fb.control(quantiteRecue, [
          Validators.required,
          Validators.min(0),
          Validators.max(item.quantity)
        ]);
      });
    }
    
    this.receptionForm = this.fb.group(group);
  }

  verifierDisponibilite(): void {
    if (!this.commande || !this.commande.id) return;
    
    this.loading = true;
    this.stockService.verifierDisponibiliteProduits(Number(this.commande.id)).subscribe({
      next: (disponibilites) => {
        this.disponibilites = disponibilites;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur lors de la vérification de disponibilité', err);
        this.error = 'Impossible de vérifier la disponibilité des produits';
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.receptionForm.invalid) {
      this.snackBar.open('Veuillez corriger les erreurs dans le formulaire', 'Fermer', { duration: 3000 });
      return;
    }
    
    if (!this.commande || !this.commande.id) {
      this.error = 'Commande invalide';
      return;
    }
    
    const lignesRecues: { [ligneId: number]: number } = {};
    
    // Récupérer uniquement les lignes avec une quantité > 0
    Object.keys(this.receptionForm.value).forEach(ligneId => {
      const quantite = this.receptionForm.value[ligneId];
      if (quantite > 0) {
        lignesRecues[Number(ligneId)] = quantite;
      }
    });
    
    if (Object.keys(lignesRecues).length === 0) {
      this.snackBar.open('Aucune quantité à réceptionner', 'Fermer', { duration: 3000 });
      return;
    }
    
    this.loading = true;
    this.stockService.receptionnerCommande(Number(this.commande.id), lignesRecues).subscribe({
      next: (response) => {
        this.snackBar.open('Réception enregistrée avec succès', 'OK', { duration: 3000 });
        this.receptionComplete.emit();
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur lors de la réception de la commande', err);
        this.error = 'Erreur lors de la réception de la commande';
        this.loading = false;
      }
    });
  }

  getItemStatus(item: PurchaseOrderItem): string {
    if (!item.productId || !this.disponibilites) return 'unknown';
    return this.disponibilites[item.productId] ? 'available' : 'unavailable';
  }

  getStatusIcon(item: PurchaseOrderItem): string {
    const status = this.getItemStatus(item);
    switch (status) {
      case 'available': return 'check_circle';
      case 'unavailable': return 'error';
      default: return 'help';
    }
  }

  // Calcule la quantité restante à recevoir
  getQuantiteRestante(item: PurchaseOrderItem): number {
    // Cette logique doit être adaptée selon votre modèle de données
    // Supposons que item.quantity est la quantité totale commandée
    return item.quantity;
  }
}
