# API PHP pour ERP

Ce dossier contient les fichiers PHP nécessaires pour connecter votre application Angular à votre base de données MySQL.

## Configuration requise

- PHP 7.0 ou supérieur
- MySQL 5.7 ou supérieur
- Serveur web (Apache, Nginx, etc.)

## Installation

1. Assurez-vous que votre serveur web (XAMPP, WAMP, etc.) est en cours d'exécution
2. Placez ces fichiers dans le répertoire approprié de votre serveur web (htdocs pour XAMPP, www pour WAMP)
3. Assurez-vous que votre base de données MySQL est en cours d'exécution

## Structure de la base de données

### Table `products`

Cette API s'attend à une table `products` avec la structure suivante :

```sql
CREATE TABLE `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `price` decimal(10,2) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT '0',
  `category_id` int(11) DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
```

### Table `factures`

Cette API s'attend à une table `factures` avec la structure suivante :

```sql
CREATE TABLE `factures` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `numero_facture` varchar(50) NOT NULL,
  `id_vendeur` int(11) DEFAULT NULL,
  `client` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `date_creation` date NOT NULL,
  `date_finalisation` date DEFAULT NULL,
  `statut` enum('PAYEE','NON_PAYEE','ANNULEE') NOT NULL DEFAULT 'NON_PAYEE',
  `totalttc` decimal(10,2) NOT NULL DEFAULT '0.00',
  `remise` decimal(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero_facture` (`numero_facture`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
```

## Utilisation

### Produits

- Pour récupérer tous les produits : `http://localhost/api/products.php`
- Pour récupérer un produit spécifique : `http://localhost/api/products.php?id=1`

### Factures

- Pour récupérer toutes les factures : `http://localhost/api/factures.php`
- Pour récupérer une facture spécifique : `http://localhost/api/factures.php?id=1`

## Dépannage

- Assurez-vous que votre serveur web et MySQL sont en cours d'exécution
- Vérifiez les paramètres de connexion à la base de données dans chaque fichier PHP
- Si vous rencontrez des erreurs CORS, assurez-vous que les en-têtes appropriés sont envoyés
