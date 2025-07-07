import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';

import { AuthService } from '../../../../modules/auth/services/auth.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { MatSnackBar } from '@angular/material/snack-bar';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  data?: any;
}

interface VendorProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  hireDate: Date;
  salesTarget: number;
  totalSales: number;
  profileImage?: string;
}

@Component({
  selector: 'app-vendor-profile',
  templateUrl: './vendor-profile.component.html',
  styleUrls: ['./vendor-profile.component.scss']
})
export class VendorProfileComponent implements OnInit, OnDestroy {
  profileForm!: FormGroup;
  vendorProfile!: VendorProfile;
  notifications: Notification[] = [];
  recentActivities: any[] = [];
  selectedTabIndex = 0;
  isLoading = true;
  private notificationSubscription!: Subscription;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private notificationService: NotificationService,
    private snackBar: MatSnackBar
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadVendorProfile();
    this.loadNotifications();
    this.loadRecentActivities();
  }

  ngOnDestroy(): void {
    if (this.notificationSubscription) {
      this.notificationSubscription.unsubscribe();
    }
  }

  private initializeForm(): void {
    this.profileForm = this.fb.group({
      fullName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.pattern('^[0-9]{10}$')]],
      address: [''],
      hireDate: [''],
      salesTarget: [0, [Validators.min(0)]]
    });
  }

  private loadVendorProfile(): void {
    // Simuler un chargement
    setTimeout(() => {
      const user = this.authService.getCurrentUser();
      this.vendorProfile = {
        id: user?.id || '1',
        fullName: user?.username || 'Vendeur',
        email: user?.email || 'vendeur@example.com',
        phone: '0601020304',
        address: '123 Rue du Commerce, 75000 Paris',
        hireDate: new Date('2023-01-15'),
        salesTarget: 50000,
        totalSales: 124500,
        profileImage: 'assets/images/default-avatar.png'
      };
      
      this.profileForm.patchValue(this.vendorProfile);
      this.isLoading = false;
    }, 1000);
  }

  private loadNotifications(): void {
    this.notificationSubscription = this.notificationService.getNotifications().subscribe(
      (notifications: Notification[]) => {
        this.notifications = notifications;
      }
    );
  }

  private loadRecentActivities(): void {
    // Simuler des activités récentes
    this.recentActivities = [
      { id: 1, type: 'sale', description: 'Vente #INV-2023-0012', date: new Date(), amount: 1250 },
      { id: 2, type: 'return', description: 'Retour #RTN-2023-0005', date: new Date(Date.now() - 3600000), amount: 350 },
      { id: 3, type: 'sale', description: 'Vente #INV-2023-0011', date: new Date(Date.now() - 7200000), amount: 890 },
      { id: 4, type: 'discount', description: 'Remise appliquée', date: new Date(Date.now() - 86400000), amount: -150 }
    ];
  }

  onSaveProfile(): void {
    if (this.profileForm.valid) {
      this.isLoading = true;
      // Simuler une sauvegarde
      setTimeout(() => {
        this.vendorProfile = { ...this.vendorProfile, ...this.profileForm.value };
        this.snackBar.open('Profil mis à jour avec succès', 'Fermer', { duration: 3000 });
        this.isLoading = false;
      }, 1000);
    }
  }

  onMarkAsRead(notification: Notification): void {
    this.notificationService.markAsRead(notification.id);
  }

  onMarkAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  onDeleteNotification(notification: Notification): void {
    this.notificationService.deleteNotification(notification.id);
  }

  getSalesProgress(): number {
    if (!this.vendorProfile?.salesTarget) return 0;
    return Math.min((this.vendorProfile.totalSales / this.vendorProfile.salesTarget) * 100, 100);
  }

  getSalesProgressClass(): string {
    const progress = this.getSalesProgress();
    if (progress < 50) return 'low';
    if (progress < 80) return 'medium';
    return 'high';
  }

  getActivityIcon(activityType: string): string {
    switch (activityType) {
      case 'sale': return 'shopping_cart';
      case 'return': return 'assignment_return';
      case 'discount': return 'local_offer';
      default: return 'notifications';
    }
  }

  getActivityColor(activityType: string): string {
    switch (activityType) {
      case 'sale': return 'primary';
      case 'return': return 'warn';
      case 'discount': return 'accent';
      default: return '';
    }
  }
}
