export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: {
    id: string;
    name: string;
  };
  sku?: string;
  quantity?: number;
}

export interface PurchaseOrderItem {
  id?: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  product?: Product;
}

export type PurchaseOrderStatus = 'DRAFT' | 'SENT' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';

export interface PurchaseOrder {
  id?: string;
  orderNumber?: string;
  supplierId: string;
  supplierName?: string;
  supplierEmail?: string;
  supplierAddress?: string;
  status: PurchaseOrderStatus;
  orderDate: Date | string;
  expectedDeliveryDate?: Date | string;
  deliveryDate?: Date | string;
  items: PurchaseOrderItem[];
  lignes?: PurchaseOrderItem[]; // Alias pour items
  lignesCommande?: PurchaseOrderItem[]; // Autre alias pour items
  articles?: PurchaseOrderItem[]; // Autre alias pour items
  total: number;
  notes?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  [key: string]: any; // Pour permettre l'accès aux propriétés dynamiques
}
