import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AchatService, Fournisseur } from '../../services/achat.service';

@Component({
  selector: 'app-fournisseur-list',
  templateUrl: './fournisseur-list.component.html',
  styleUrls: ['./fournisseur-list.component.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class FournisseurListComponent implements OnInit {
  fournisseurs: Fournisseur[] = [];
  loading = false;
  error = '';

  constructor(private achatService: AchatService) {}

  ngOnInit(): void {
    this.loadFournisseurs();
  }

  loadFournisseurs(): void {
    this.loading = true;
    this.error = '';
    
    this.achatService.getFournisseurs().subscribe({
      next: (data) => {
        this.fournisseurs = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des fournisseurs', err);
        this.error = 'Impossible de charger les fournisseurs. Veuillez réessayer plus tard.';
        this.loading = false;
      }
    });
  }

  deleteFournisseur(id: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) {
      this.achatService.deleteFournisseur(id).subscribe({
        next: () => {
          this.fournisseurs = this.fournisseurs.filter(f => f.id !== id);
        },
        error: (err) => {
          console.error('Erreur lors de la suppression du fournisseur', err);
          this.error = 'Impossible de supprimer le fournisseur. Veuillez réessayer plus tard.';
        }
      });
    }
  }
}
