import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Notification {
  id: number;
  type: 'sale' | 'inventory' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notifications: Notification[] = [];
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  private lastId = 0;

  constructor() {
    this.loadInitialData();
  }

  private loadInitialData(): void {
    // Charger les notifications depuis le localStorage ou une API
    const savedNotifications = localStorage.getItem('vendor_notifications');
    if (savedNotifications) {
      this.notifications = JSON.parse(savedNotifications);
      if (this.notifications.length > 0) {
        this.lastId = Math.max(...this.notifications.map(n => n.id));
      }
      this.notificationsSubject.next([...this.notifications]);
    }
  }

  getNotifications(): Observable<Notification[]> {
    return this.notificationsSubject.asObservable();
  }

  addNotification(notification: Omit<Notification, 'id' | 'read' | 'createdAt'>): void {
    const newNotification: Notification = {
      ...notification,
      id: ++this.lastId,
      read: false,
      createdAt: new Date()
    };
    
    this.notifications.unshift(newNotification);
    this.saveNotifications();
  }

  markAsRead(id: number): void {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.saveNotifications();
    }
  }

  markAllAsRead(): void {
    this.notifications.forEach(notification => notification.read = true);
    this.saveNotifications();
  }

  deleteNotification(id: number): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.saveNotifications();
  }

  private saveNotifications(): void {
    localStorage.setItem('vendor_notifications', JSON.stringify(this.notifications));
    this.notificationsSubject.next([...this.notifications]);
  }

  // Méthode utilitaire pour les notifications de vente
  addSaleNotification(saleData: {
    invoiceNumber: string;
    amount: number;
    customerName?: string;
  }): void {
    this.addNotification({
      type: 'sale',
      title: 'Nouvelle vente enregistrée',
      message: `Vente #${saleData.invoiceNumber} pour ${saleData.amount.toFixed(2)}€`,
      data: saleData
    });
  }
}
