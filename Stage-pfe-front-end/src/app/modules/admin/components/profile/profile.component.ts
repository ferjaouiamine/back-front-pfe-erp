import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../auth/services/auth.service';
import { Router } from '@angular/router';

interface Notification {
  id: number;
  message: string;
  date: Date;
  read: boolean;
  type: 'info' | 'warning' | 'success' | 'danger';
}

interface AdminStats {
  totalUsers: number;
  totalProducts: number;
  totalFactures: number;
  pendingFactures: number;
  systemHealth: number;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  profileForm!: FormGroup;
  securityForm!: FormGroup;
  activeTab: string = 'profile';
  notifications: Notification[] = [];
  adminStats: AdminStats = {
    totalUsers: 0,
    totalProducts: 0,
    totalFactures: 0,
    pendingFactures: 0,
    systemHealth: 0
  };
  updateSuccess: boolean = false;
  updateError: boolean = false;
  passwordUpdateSuccess: boolean = false;
  passwordUpdateError: boolean = false;

  constructor(
    private fb: FormBuilder,
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForms();
    this.loadNotifications();
    this.loadAdminStats();
  }

  initForms(): void {
    const currentUser = this.authService.getCurrentUser();
    // Extraire les informations utilisateur ou utiliser des valeurs par défaut
    const userData = {
      username: currentUser?.username || '',
      email: currentUser?.email || '',
      firstName: '',
      lastName: '',
      phone: '',
      address: ''
    };

    // Si l'utilisateur a des données supplémentaires (utiliser une approche sécurisée)
    if (currentUser) {
      try {
        // Utiliser une approche sécurisée pour accéder aux propriétés potentiellement manquantes
        const userAny = currentUser as any;
        
        // Vérifier si des détails supplémentaires existent sous n'importe quelle forme
        if (userAny.details) {
          const details = typeof userAny.details === 'string' 
            ? JSON.parse(userAny.details) 
            : userAny.details;
          
          userData.firstName = details.firstName || '';
          userData.lastName = details.lastName || '';
          userData.phone = details.phone || '';
          userData.address = details.address || '';
        } else if (userAny.firstName) {
          // Si les propriétés sont directement sur l'objet utilisateur
          userData.firstName = userAny.firstName || '';
          userData.lastName = userAny.lastName || '';
          userData.phone = userAny.phone || '';
          userData.address = userAny.address || '';
        }
      } catch (e) {
        console.error('Erreur lors de la récupération des détails utilisateur:', e);
      }
    }

    this.profileForm = this.fb.group({
      username: [userData.username, Validators.required],
      email: [userData.email, [Validators.required, Validators.email]],
      firstName: [userData.firstName, Validators.required],
      lastName: [userData.lastName, Validators.required],
      phone: [userData.phone, Validators.pattern('^[0-9]{8,}$')],
      address: [userData.address]
    });

    this.securityForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    }, { validator: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: FormGroup): { [key: string]: boolean } | null {
    return g.get('newPassword')?.value === g.get('confirmPassword')?.value
      ? null
      : { 'mismatch': true };
  }

  loadNotifications(): void {
    // Simuler le chargement des notifications
    this.notifications = [
      {
        id: 1,
        message: 'Nouvelle mise à jour système disponible',
        date: new Date(),
        read: false,
        type: 'info'
      },
      {
        id: 2,
        message: '5 nouveaux utilisateurs inscrits aujourd\'hui',
        date: new Date(Date.now() - 86400000),
        read: true,
        type: 'success'
      },
      {
        id: 3,
        message: 'Alerte de sécurité: 3 tentatives de connexion échouées',
        date: new Date(Date.now() - 172800000),
        read: false,
        type: 'danger'
      },
      {
        id: 4,
        message: '10 factures en attente de validation',
        date: new Date(Date.now() - 259200000),
        read: false,
        type: 'warning'
      }
    ];
  }

  loadAdminStats(): void {
    // Simuler le chargement des statistiques d'administration
    this.adminStats = {
      totalUsers: 125,
      totalProducts: 432,
      totalFactures: 287,
      pendingFactures: 18,
      systemHealth: 92
    };
  }

  updateProfile(): void {
    if (this.profileForm.invalid) {
      return;
    }

    // Simuler la mise à jour du profil
    setTimeout(() => {
      this.updateSuccess = true;
      setTimeout(() => this.updateSuccess = false, 3000);
    }, 1000);
  }

  updatePassword(): void {
    if (this.securityForm.invalid) {
      return;
    }

    // Simuler la mise à jour du mot de passe
    setTimeout(() => {
      this.passwordUpdateSuccess = true;
      this.securityForm.reset();
      setTimeout(() => this.passwordUpdateSuccess = false, 3000);
    }, 1000);
  }

  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  markAsRead(id: number): void {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
    }
  }

  markAllAsRead(): void {
    this.notifications.forEach(notification => {
      notification.read = true;
    });
  }

  getUnreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  getNotificationIcon(type: string): string {
    const iconMap: { [key: string]: string } = {
      'info': 'fa-info-circle',
      'warning': 'fa-exclamation-triangle',
      'success': 'fa-check-circle',
      'danger': 'fa-times-circle'
    };
    return iconMap[type] || 'fa-bell';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
