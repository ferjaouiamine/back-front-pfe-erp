import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

// Interface pour les notifications
export interface Notification {
  id: string;
  titre: string;
  message: string;
  date: Date;
  lue: boolean;
  type: 'info' | 'success' | 'warning' | 'error';
  lien?: string;
}

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.scss']
})
export class NotificationsComponent implements OnInit {
  // Liste des notifications
  notifications: Notification[] = [];
  
  // État de chargement
  isLoading: boolean = true;
  error: string | null = null;
  
  // Filtres
  filtreType: string = '';
  filtreLues: string = '';
  
  // Notifications originales (avant filtrage)
  private notificationsOriginales: Notification[] = [];

  constructor() { }

  ngOnInit(): void {
    this.chargerNotifications();
  }

  /**
   * Charge les notifications (simulé pour la démonstration)
   */
  chargerNotifications() {
    this.isLoading = true;
    
    // Simuler un appel API
    setTimeout(() => {
      this.notifications = [
        {
          id: '1',
          titre: 'Nouvelle commande',
          message: 'Vous avez reçu une nouvelle commande #CMD-2025-001 de 5 articles.',
          date: new Date('2025-05-06T10:30:00'),
          lue: false,
          type: 'info',
          lien: '/fournisseur/commandes/1'
        },
        {
          id: '2',
          titre: 'Stock faible',
          message: 'Le stock du produit "Ordinateur portable" est presque épuisé (2 articles restants).',
          date: new Date('2025-05-05T16:45:00'),
          lue: false,
          type: 'warning',
          lien: '/fournisseur/produits'
        },
        {
          id: '3',
          titre: 'Commande confirmée',
          message: 'La commande #CMD-2025-002 a été confirmée par le client.',
          date: new Date('2025-05-04T14:20:00'),
          lue: true,
          type: 'success',
          lien: '/fournisseur/commandes/2'
        },
        {
          id: '4',
          titre: 'Mise à jour du système',
          message: 'Une mise à jour du système aura lieu le 10 mai 2025 à 22h00. Le système sera indisponible pendant environ 30 minutes.',
          date: new Date('2025-05-03T09:15:00'),
          lue: true,
          type: 'info'
        },
        {
          id: '5',
          titre: 'Problème de paiement',
          message: 'Un problème est survenu lors du traitement du paiement pour la commande #CMD-2025-003.',
          date: new Date('2025-05-02T11:10:00'),
          lue: true,
          type: 'error',
          lien: '/fournisseur/commandes/3'
        }
      ];
      
      // Sauvegarder les notifications originales pour les filtres
      this.notificationsOriginales = [...this.notifications];
      
      this.isLoading = false;
    }, 1000);
  }

  /**
   * Marque une notification comme lue
   */
  marquerCommeLue(notification: Notification) {
    notification.lue = true;
    // Dans une implémentation réelle, appeler le service pour mettre à jour la notification
  }

  /**
   * Marque toutes les notifications comme lues
   */
  marquerToutesCommeLues() {
    this.notifications.forEach(notification => {
      notification.lue = true;
    });
    // Dans une implémentation réelle, appeler le service pour mettre à jour les notifications
  }

  /**
   * Supprime une notification
   */
  supprimerNotification(id: string) {
    this.notifications = this.notifications.filter(notification => notification.id !== id);
    // Dans une implémentation réelle, appeler le service pour supprimer la notification
  }

  /**
   * Filtre les notifications par type
   */
  filtrerParType() {
    // Réinitialiser le filtre si aucun type n'est sélectionné
    if (!this.filtreType) {
      this.notifications = [...this.notificationsOriginales];
      
      // Appliquer le filtre de lecture si actif
      if (this.filtreLues) {
        this.filtrerParLecture(false);
      }
      return;
    }
    
    // Filtrer les notifications par type
    this.notifications = this.notificationsOriginales.filter(notification => notification.type === this.filtreType);
    
    // Appliquer le filtre de lecture si actif
    if (this.filtreLues) {
      this.filtrerParLecture(false);
    }
  }

  /**
   * Filtre les notifications par statut de lecture
   */
  filtrerParLecture(resetNotifications = true) {
    // Réinitialiser le filtre si aucun statut n'est sélectionné
    if (!this.filtreLues) {
      if (resetNotifications) {
        this.notifications = [...this.notificationsOriginales];
        
        // Appliquer le filtre de type si actif
        if (this.filtreType) {
          this.filtrerParType();
        }
      }
      return;
    }
    
    // Filtrer les notifications par statut de lecture
    const lues = this.filtreLues === 'lues';
    
    if (resetNotifications) {
      this.notifications = this.notificationsOriginales.filter(notification => notification.lue === lues);
      
      // Appliquer le filtre de type si actif
      if (this.filtreType) {
        const tempNotifications = [...this.notifications];
        this.notifications = tempNotifications.filter(notification => notification.type === this.filtreType);
      }
    } else {
      this.notifications = this.notifications.filter(notification => notification.lue === lues);
    }
  }

  /**
   * Réinitialise tous les filtres
   */
  reinitialiserFiltres() {
    this.filtreType = '';
    this.filtreLues = '';
    this.notifications = [...this.notificationsOriginales];
  }
  
  /**
   * Vérifie s'il y a des notifications non lues
   */
  hasUnreadNotifications(): boolean {
    return this.notifications.some(notification => !notification.lue);
  }
  
  /**
   * Vérifie si des filtres sont actifs
   */
  hasFiltresActifs(): boolean {
    return !!this.filtreType || !!this.filtreLues;
  }

  /**
   * Retourne la classe CSS pour l'icône en fonction du type de notification
   */
  getIconClass(type: string): string {
    switch (type) {
      case 'info':
        return 'fas fa-info-circle notification-icon-info';
      case 'success':
        return 'fas fa-check-circle notification-icon-success';
      case 'warning':
        return 'fas fa-exclamation-triangle notification-icon-warning';
      case 'error':
        return 'fas fa-times-circle notification-icon-error';
      default:
        return 'fas fa-bell notification-icon-default';
    }
  }
}
