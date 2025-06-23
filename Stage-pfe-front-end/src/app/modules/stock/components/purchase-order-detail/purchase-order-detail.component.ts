import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-purchase-order-detail',
  template: `
    <div class="container mt-4">
      <div class="alert alert-warning">
        <strong>Ce composant est obsolète!</strong> 
        Redirection vers le nouveau composant...
      </div>
    </div>
  `
})
export class PurchaseOrderDetailComponent implements OnInit {

  constructor(private router: Router) { }

  ngOnInit(): void {
    // Redirection automatique vers le nouveau composant après un court délai
    setTimeout(() => {
      this.router.navigate(['/stock/purchase-orders/new']);
    }, 1500);
  }
}
