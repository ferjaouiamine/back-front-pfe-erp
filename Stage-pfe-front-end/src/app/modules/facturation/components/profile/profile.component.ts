import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';

interface User {
  id?: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  address?: string;
  phone?: string;
  roles?: string[];
}

interface Notification {
  id: number;
  title: string;
  message: string;
  date: Date;
  type: 'info' | 'warning' | 'alert';
  read: boolean;
}

interface Stats {
  todaySales: number;
  monthSales: number;
  totalCustomers: number;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  // Utilisateur connecté
  user: User | null = null;
  
  // Formulaires
  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  
  // État des onglets
  activeTab: 'profile' | 'security' | 'notifications' | 'performance' = 'profile';
  
  // État des mots de passe
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  
  // Messages de retour
  successMessage = '';
  errorMessage = '';
  isSubmitting = false;
  
  // Notifications
  notifications: Notification[] = [];
  notificationCount = 0;
  
  // Statistiques
  stats: Stats = {
    todaySales: 0,
    monthSales: 0,
    totalCustomers: 0
  };

  constructor(
    private authService: AuthService,
    private formBuilder: FormBuilder,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForms();
    this.loadUserInfo();
    this.loadNotifications();
    this.loadStats();
  }

  /**
   * Initialise les formulaires
   */
  initForms(): void {
    // Formulaire de profil
    this.profileForm = this.formBuilder.group({
      username: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      firstName: [''],
      lastName: [''],
      address: [''],
      phone: ['']
    });

    // Formulaire de mot de passe
    this.passwordForm = this.formBuilder.group({
      currentPassword: ['', [Validators.required]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  /**
   * Charge les informations de l'utilisateur
   */
  loadUserInfo(): void {
    // Récupérer l'utilisateur depuis le service d'authentification
    const currentUser = this.authService.getCurrentUser();
    
    if (currentUser) {
      // Définir un type pour currentUser pour éviter les erreurs de type
      interface CurrentUser {
        id?: number;
        username: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        address?: string;
        phone?: string;
      }
      
      // Cast pour s'assurer que currentUser a le bon type
      const typedUser = currentUser as unknown as CurrentUser;
      
      this.user = {
        id: typedUser.id,
        username: typedUser.username,
        email: typedUser.email || '',
        firstName: typedUser.firstName || '',
        lastName: typedUser.lastName || '',
        address: typedUser.address || '',
        phone: typedUser.phone || '',
        roles: this.authService.getUserRoles()
      };
      
      // Mettre à jour le formulaire avec les données de l'utilisateur
      if (this.user) {
        this.profileForm.patchValue({
          username: this.user.username,
          email: this.user.email,
          firstName: this.user.firstName || '',
          lastName: this.user.lastName || '',
          address: this.user.address || '',
          phone: this.user.phone || ''
        });
      }
    }
  }

  /**
   * Charge les notifications de l'utilisateur
   */
  loadNotifications(): void {
    // Simuler des notifications (à remplacer par un appel API)
    this.notifications = [
      {
        id: 1,
        title: 'Nouvelle facture créée',
        message: 'La facture #F-2023-056 a été créée avec succès',
        date: new Date(),
        type: 'info',
        read: false
      },
      {
        id: 2,
        title: 'Paiement reçu',
        message: 'Un paiement de 250,00 € a été reçu pour la facture #F-2023-042',
        date: new Date(Date.now() - 86400000), // Hier
        type: 'info',
        read: false
      },
      {
        id: 3,
        title: 'Facture en retard',
        message: 'La facture #F-2023-038 est en retard de paiement',
        date: new Date(Date.now() - 172800000), // Avant-hier
        type: 'warning',
        read: false
      }
    ];
    
    // Mettre à jour le compteur de notifications
    this.notificationCount = this.notifications.filter(n => !n.read).length;
  }

  /**
   * Charge les statistiques du vendeur
   */
  loadStats(): void {
    // Simuler des statistiques (à remplacer par un appel API)
    this.stats = {
      todaySales: 3,
      monthSales: 42,
      totalCustomers: 78
    };
  }

  /**
   * Change l'onglet actif
   */
  setActiveTab(tab: 'profile' | 'security' | 'notifications' | 'performance'): void {
    this.activeTab = tab;
    // Réinitialiser les messages
    this.successMessage = '';
    this.errorMessage = '';
  }

  /**
   * Affiche/masque le mot de passe
   */
  togglePasswordVisibility(field: 'current' | 'new' | 'confirm'): void {
    if (field === 'current') {
      this.showCurrentPassword = !this.showCurrentPassword;
    } else if (field === 'new') {
      this.showNewPassword = !this.showNewPassword;
    } else {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }

  /**
   * Valide que les mots de passe correspondent
   */
  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPassword = control.get('newPassword')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  /**
   * Met à jour le profil de l'utilisateur
   */
  updateProfile(): void {
    if (this.profileForm.invalid) {
      return;
    }
    
    this.isSubmitting = true;
    this.successMessage = '';
    this.errorMessage = '';
    
    // Récupérer les données du formulaire
    const profileData = this.profileForm.value;
    
    // Simuler une mise à jour (à remplacer par un appel API)
    setTimeout(() => {
      // Mise à jour réussie
      this.isSubmitting = false;
      this.successMessage = 'Votre profil a été mis à jour avec succès';
      
      // Mettre à jour les informations de l'utilisateur
      if (this.user) {
        this.user = {
          ...this.user,
          ...profileData
        };
      }
    }, 1000);
  }

  /**
   * Met à jour le mot de passe de l'utilisateur
   */
  updatePassword(): void {
    if (this.passwordForm.invalid) {
      return;
    }
    
    this.isSubmitting = true;
    this.successMessage = '';
    this.errorMessage = '';
    
    // Récupérer les données du formulaire
    const passwordData = this.passwordForm.value;
    
    // Simuler une mise à jour (à remplacer par un appel API)
    setTimeout(() => {
      // Vérifier si le mot de passe actuel est correct (simulation)
      if (passwordData.currentPassword !== 'password123') {
        this.isSubmitting = false;
        this.errorMessage = 'Le mot de passe actuel est incorrect';
        return;
      }
      
      // Mise à jour réussie
      this.isSubmitting = false;
      this.successMessage = 'Votre mot de passe a été mis à jour avec succès';
      
      // Réinitialiser le formulaire
      this.passwordForm.reset();
    }, 1000);
  }

  /**
   * Marque une notification comme lue
   */
  markAsRead(notificationId: number): void {
    // Trouver la notification
    const notification = this.notifications.find(n => n.id === notificationId);
    
    if (notification) {
      // Marquer comme lue
      notification.read = true;
      
      // Mettre à jour le compteur de notifications
      this.notificationCount = this.notifications.filter(n => !n.read).length;
    }
  }

  /**
   * Déconnecte l'utilisateur
   */
  logout(): void {
    // Appeler la méthode de déconnexion du service d'authentification
    this.authService.logout();
    
    // Rediriger vers la page de connexion
    this.router.navigate(['/auth/login']);
  }
}
