import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService, User } from '../../../modules/auth/services/auth.service';

export interface StatCard {
  title: string;
  value: number;
  icon: string;
  color: string;
  change?: number;
  changeDirection?: 'up' | 'down';
}

export interface RecentActivity {
  id: number;
  type: 'user' | 'facture' | 'product';
  action: string;
  description: string;
  date: Date;
  user: string;
}

export interface DashboardData {
  statCards: StatCard[];
  recentActivities: RecentActivity[];
  usersByRoleData: any;
  monthlySalesData: any;
}

@Injectable({
  providedIn: 'root'
})
export class AdminDashboardService {
  private apiUrl = 'http://localhost:8081/api/admin';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  /**
   * Récupère toutes les données du dashboard
   */
  getDashboardData(): Observable<DashboardData> {
    return forkJoin({
      userStats: this.getUserStats(),
      // Ajoutez d'autres appels API ici pour les factures, produits, etc.
      // factures: this.getFactures(),
      // products: this.getProducts(),
    }).pipe(
      map(results => {
        const userStats = results.userStats;
        
        // Récupérer les statistiques des utilisateurs depuis l'API
        const adminCount = userStats.adminCount || 0;
        const vendeurCount = userStats.vendeurCount || 0;
        const clientCount = userStats.clientCount || 0;
        const totalUsers = userStats.totalUsers || 0;
        const activeUsers = userStats.activeUsers || 0;
        const inactiveUsers = userStats.inactiveUsers || 0;
        const recentUsers = userStats.recentUsers || [];
        
        // Créer les cartes de statistiques
        const statCards: StatCard[] = [
          { 
            title: 'Utilisateurs', 
            value: totalUsers, 
            icon: 'fas fa-users', 
            color: '#007bff', 
            change: 5, 
            changeDirection: 'up' 
          },
          // Ajoutez d'autres cartes de statistiques avec des données simulées
          { 
            title: 'Factures', 
            value: 156, 
            icon: 'fas fa-file-invoice', 
            color: '#28a745', 
            change: 8, 
            changeDirection: 'up' 
          },
          { 
            title: 'Produits', 
            value: 89, 
            icon: 'fas fa-box', 
            color: '#ffc107', 
            change: 5, 
            changeDirection: 'up' 
          },
          { 
            title: 'Chiffre d\'affaires', 
            value: 24680, 
            icon: 'fas fa-euro-sign', 
            color: '#17a2b8', 
            change: 15, 
            changeDirection: 'up' 
          }
        ];
        
        // Créer les données pour le graphique des utilisateurs par rôle
        const usersByRoleData = {
          labels: ['Admin', 'Vendeur', 'Client'],
          datasets: [{
            data: [adminCount, vendeurCount, clientCount],
            backgroundColor: ['#dc3545', '#28a745', '#17a2b8'],
            hoverBackgroundColor: ['#c82333', '#218838', '#138496']
          }]
        };
        
        // Créer les données pour le graphique des ventes mensuelles (simulées)
        const monthlySalesData = {
          labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil'],
          datasets: [{
            label: 'Ventes (€)',
            data: [4200, 5100, 4800, 6300, 5600, 7200, 8100],
            borderColor: '#007bff',
            backgroundColor: 'rgba(0, 123, 255, 0.1)',
            borderWidth: 2,
            fill: true
          }]
        };
        
        // Créer les activités récentes (simulées pour l'instant)
        const recentActivities: RecentActivity[] = this.generateRecentActivities(recentUsers);
        
        return {
          statCards,
          recentActivities,
          usersByRoleData,
          monthlySalesData
        };
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des données du dashboard:', error);
        return of({
          statCards: [],
          recentActivities: [],
          usersByRoleData: null,
          monthlySalesData: null
        });
      })
    );
  }

  /**
   * Récupère les statistiques des utilisateurs depuis l'API
   */
  getUserStats(): Observable<any> {
    // Créer des en-têtes d'authentification
    const token = this.authService.getToken();
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    
    return this.http.get<any>(`${this.apiUrl}/stats/users`, {
      headers: headers
    }).pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération des statistiques utilisateurs:', error);
        return of({
          totalUsers: 0,
          activeUsers: 0,
          inactiveUsers: 0,
          adminCount: 0,
          vendeurCount: 0,
          clientCount: 0,
          recentUsers: []
        });
      })
    );
  }
  
  /**
   * Récupère la liste des utilisateurs
   */
  getUsers(): Observable<User[]> {
    return this.authService.getUsers().pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération des utilisateurs:', error);
        return of([]);
      })
    );
  }

  /**
   * Génère des activités récentes basées sur les utilisateurs réels
   */
  private generateRecentActivities(recentUsers: any[]): RecentActivity[] {
    const activities: RecentActivity[] = [];
    
    // Utiliser les utilisateurs récents de l'API pour générer des activités
    if (recentUsers && recentUsers.length > 0) {
      // Trouver un utilisateur admin pour les activités d'administration
      const adminUser = recentUsers.find(u => 
        u.roles && u.roles.some((r: string) => r === 'ADMIN' || r === 'ROLE_ADMIN')
      )?.username || 'admin';
      
      // Créer des activités basées sur les utilisateurs récents
      recentUsers.forEach((user, index) => {
        if (index < 3) { // Limiter à 3 activités pour éviter de surcharger l'interface
          activities.push({
            id: index + 1,
            type: 'user',
            action: 'Création',
            description: `Nouvel utilisateur ${user.username} créé`,
            date: new Date(Date.now() - (index * 1000 * 60 * 60 * 24)), // Chaque utilisateur a été créé un jour avant le précédent
            user: adminUser
          });
        }
      });
      
      // Ajouter quelques activités simulant des opérations sur les factures et produits
      activities.push(
        { 
          id: activities.length + 1, 
          type: 'facture', 
          action: 'Paiement', 
          description: 'Facture #F2023-156 marquée comme payée', 
          date: new Date(Date.now() - 1000 * 60 * 60 * 48), 
          user: recentUsers[0]?.username || 'vendeur' 
        },
        { 
          id: activities.length + 2, 
          type: 'product', 
          action: 'Mise à jour', 
          description: 'Stock du produit "Laptop HP" mis à jour', 
          date: new Date(Date.now() - 1000 * 60 * 60 * 72), 
          user: adminUser 
        }
      );
    } else {
      // Activités par défaut si aucun utilisateur n'est trouvé
      activities.push(
        { 
          id: 1, 
          type: 'user', 
          action: 'Création', 
          description: 'Nouvel utilisateur créé', 
          date: new Date(), 
          user: 'admin' 
        }
      );
    }
    
    return activities;
  }
}
