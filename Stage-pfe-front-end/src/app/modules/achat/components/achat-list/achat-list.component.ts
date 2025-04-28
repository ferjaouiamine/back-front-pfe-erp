import { Component, OnInit } from '@angular/core';
import { AchatService, Achat } from '../../services/achat.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-achat-list',
  templateUrl: './achat-list.component.html',
  styleUrls: ['./achat-list.component.scss']
})
export class AchatListComponent implements OnInit {
  achats: Achat[] = [];
  loading = false;
  error = '';
  statusColors: Record<string, string> = {
    'COMMANDE': 'badge-warning',
    'LIVRAISON_PARTIELLE': 'badge-info',
    'LIVREE': 'badge-success',
    'ANNULEE': 'badge-danger'
  };

  constructor(
    private achatService: AchatService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadAchats();
  }

  loadAchats(): void {
    this.loading = true;
    this.error = '';
    
    this.achatService.getAchats().subscribe({
      next: (data) => {
        this.achats = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des commandes', err);
        this.error = 'Impossible de charger les commandes. Veuillez réessayer plus tard.';
        this.loading = false;
      }
    });
  }

  getStatusClass(status: string): string {
    return this.statusColors[status] || 'badge-secondary';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'COMMANDE': 'Commandée',
      'LIVRAISON_PARTIELLE': 'Livraison partielle',
      'LIVREE': 'Livrée',
      'ANNULEE': 'Annulée'
    };
    return labels[status] || status;
  }

  viewAchat(id: string): void {
    this.router.navigate(['/achat/commandes', id]);
  }

  generatePdf(id: string, event: Event): void {
    event.stopPropagation();
    this.achatService.generateBonCommande(id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bon_commande_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      },
      error: (err) => {
        console.error('Erreur lors de la génération du PDF', err);
        alert('Impossible de générer le PDF. Veuillez réessayer plus tard.');
      }
    });
  }
}
