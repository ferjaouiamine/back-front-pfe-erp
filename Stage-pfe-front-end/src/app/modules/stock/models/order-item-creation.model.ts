import { Product } from './purchase-order.model';

/**
 * Interface pour la création d'un article de commande
 * Utilisée pour faciliter l'ajout d'articles dans les commandes
 */
export interface OrderItemCreation {
  product: Product;
  quantity: number;
  unitPrice?: number; // Prix unitaire (optionnel, peut être repris du produit)
  notes?: string;     // Notes spécifiques à l'article (optionnel)
}

/**
 * Interface pour le formulaire de création d'article
 */
export interface OrderItemForm {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total?: number;
}
