import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class StockUpdateService {
  // Subject pour notifier les changements de stock
  private stockUpdated = new Subject<void>();
  
  // Observable que les composants peuvent écouter
  stockUpdated$ = this.stockUpdated.asObservable();
  
  constructor() { }
  
  // Méthode pour notifier que le stock a été mis à jour
  notifyStockUpdated(): void {
    console.log('Stock update notification sent');
    this.stockUpdated.next();
  }
}
