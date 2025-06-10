/**
 * Modèles pour le système de point de vente (POS)
 */

// Modèle de produit
interface Product {
  id: string;
  name: string;
  barcode?: string;
  price: number;
  quantityInStock: number;
  taxRate?: number;
  imageUrl?: string;
  category?: string;
  description?: string;
  sku?: string;
  isActive?: boolean;
  costPrice?: number;
  reorderPoint?: number;
  supplierInfo?: {
    id: string;
    name: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

// Élément du panier
export interface CartItem {
  productId: string;
  productName: string;
  barcode?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  imageUrl?: string;
  notes?: string;
  product?: Product; // Référence optionnelle vers l'objet produit complet
}

// Transaction de vente
export interface SaleTransaction {
  id?: string;
  transactionNumber: string;
  date: Date;
  items: CartItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountTendered: number;
  change: number;
  cashierId: string;
  cashierName: string;
  registerNumber: string;
  sessionId?: string;
  status: TransactionStatus;
  customerInfo?: CustomerInfo;
  notes?: string;
}

// Méthode de paiement
export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  TRANSFER = 'TRANSFER',
  CHECK = 'CHECK',
  MOBILE_PAYMENT = 'MOBILE_PAYMENT',
  GIFT_CARD = 'GIFT_CARD',
  STORE_CREDIT = 'STORE_CREDIT',
  MULTIPLE = 'MULTIPLE'
}

// Statut de la transaction
export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  VOIDED = 'VOIDED',
  REFUNDED = 'REFUNDED'
}

// Information client (optionnel)
export interface CustomerInfo {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  loyaltyNumber?: string;
}

// Session de caisse
export interface CashRegisterSession {
  id?: string;
  registerNumber: string;
  openedBy: string;
  openedByUser?: {
    id: string;
    name: string;
    email: string;
  };
  openedAt: Date;
  startingAmount: number;
  endingAmount?: number;
  expectedAmount?: number;
  discrepancy?: number;
  status: SessionStatus;
  closedBy?: string;
  closedByUser?: {
    id: string;
    name: string;
    email: string;
  };
  closedAt?: Date;
  transactions?: SaleTransaction[];
  notes?: string;
}

// Statut de la session
export enum SessionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED'
}

// Rapport de caisse
export interface CashRegisterReport {
  sessionId: string;
  registerNumber: string;
  date: Date;
  totalSales: number;
  totalTransactions: number;
  paymentBreakdown: {
    [key in PaymentMethod]?: number;
  };
  productsSold: {
    productId: string;
    productName: string;
    quantity: number;
    totalAmount: number;
  }[];
  voidedTransactions?: number;
  refundedTransactions?: number;
  startingAmount: number;
  endingAmount: number;
  expectedAmount: number;
  discrepancy: number;
}
