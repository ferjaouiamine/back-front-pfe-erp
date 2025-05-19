import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { FournisseurService, CommandeFournisseur, StatutCommande } from '../../services/fournisseur.service';

@Component({
  selector: 'app-commande-list',
  templateUrl: './commande-list.component.html',
  styleUrls: ['./commande-list.component.scss']
})
export class CommandeListComponent implements OnInit {
  // Colonnes à afficher dans le tableau
  displayedColumns: string[] = ['numero', 'date', 'client', 'montantTotal', 'statut', 'actions'];
  
  // Source de données pour le tableau
  dataSource = new MatTableDataSource<CommandeFournisseur>([]);
  
  // Pagination et tri
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  
  // Filtres
  filtreStatut: string = '';
  filtreTexte: string = '';
  
  // État de chargement
  isLoading: boolean = true;
  error: string | null = null;
  
  // Pagination côté serveur
  totalCommandes: number = 0;
  pageSize: number = 10;
  pageIndex: number = 0;
  
  // Enum pour les statuts
  StatutCommande = StatutCommande;

  constructor(
    private fournisseurService: FournisseurService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.chargerCommandes();
  }

  /**
   * Configure la pagination et le tri après l'initialisation de la vue
   */
  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  /**
   * Charge les commandes depuis le service
   */
  chargerCommandes() {
    this.isLoading = true;
    this.error = null;
    
    // Convertir le filtre de statut en enum si nécessaire
    const statutFiltre = this.filtreStatut ? (this.filtreStatut as StatutCommande) : undefined;
    
    this.fournisseurService.getCommandes(this.pageIndex, this.pageSize, statutFiltre)
      .subscribe({
        next: (response) => {
          this.dataSource.data = response.content;
          this.totalCommandes = response.totalElements;
          this.isLoading = false;
        },
        error: (err) => {
          this.error = 'Erreur lors du chargement des commandes';
          this.isLoading = false;
          console.error('Erreur commandes fournisseur:', err);
        }
      });
  }

  /**
   * Gère le changement de page
   */
  onPageChange(event: any) {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.chargerCommandes();
  }

  /**
   * Applique le filtre de texte
   */
  appliquerFiltreTexte() {
    this.pageIndex = 0; // Revenir à la première page
    this.chargerCommandes();
  }

  /**
   * Applique le filtre de statut
   */
  appliquerFiltreStatut() {
    this.pageIndex = 0; // Revenir à la première page
    this.chargerCommandes();
  }

  /**
   * Réinitialise tous les filtres
   */
  reinitialiserFiltres() {
    this.filtreTexte = '';
    this.filtreStatut = '';
    this.pageIndex = 0;
    this.chargerCommandes();
  }

  /**
   * Navigue vers la page de détail d'une commande
   */
  voirCommande(id: string) {
    this.router.navigate(['/fournisseur/commandes', id]);
  }

  /**
   * Retourne la classe CSS correspondant au statut
   */
  getStatutClass(statut: StatutCommande): string {
    switch (statut) {
      case StatutCommande.BROUILLON:
        return 'statut-brouillon';
      case StatutCommande.EN_ATTENTE:
        return 'statut-en-attente';
      case StatutCommande.CONFIRMEE:
        return 'statut-confirmee';
      case StatutCommande.EN_COURS:
        return 'statut-en-cours';
      case StatutCommande.LIVREE:
        return 'statut-livree';
      case StatutCommande.ANNULEE:
        return 'statut-annulee';
      default:
        return '';
    }
  }
}
