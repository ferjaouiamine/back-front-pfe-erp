<?php
// Autoriser les requêtes cross-origin (CORS)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

// Répondre automatiquement aux requêtes OPTIONS (pre-flight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Paramètres de connexion à la base de données MySQL
$servername = "localhost";
$username = "root";
$password = "";
$dbname = "erp";

// Créer la connexion
$conn = new mysqli($servername, $username, $password, $dbname);

// Vérifier la connexion
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["error" => "Connexion à la base de données échouée: " . $conn->connect_error]);
    exit();
}

// Définir l'encodage des caractères
$conn->set_charset("utf8");

// Fonction pour récupérer les éléments d'une facture
function getFactureItems($conn, $factureId) {
    $items = [];
    $sql = "SELECT * FROM facture_items WHERE facture_id = ?";
    $stmt = $conn->prepare($sql);
    
    if (!$stmt) {
        error_log("Erreur de préparation de la requête pour les éléments: " . $conn->error);
        return $items;
    }
    
    $stmt->bind_param("i", $factureId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    while ($row = $result->fetch_assoc()) {
        $items[] = [
            "id" => $row["id"],
            "factureId" => $row["facture_id"],
            "productId" => $row["product_id"],
            "productName" => $row["product_name"],
            "description" => $row["description"],
            "quantity" => (float)$row["quantity"],
            "unitPrice" => (float)$row["unit_price"],
            "total" => (float)$row["total"]
        ];
    }
    
    return $items;
}

// Vérifier si les tables existent et créer des données de test si nécessaire
function ensureTablesExist($conn) {
    // Vérifier si la table factures existe
    $result = $conn->query("SHOW TABLES LIKE 'factures'");
    $facturesTableExists = $result->num_rows > 0;
    
    // Vérifier si la table facture_items existe
    $result = $conn->query("SHOW TABLES LIKE 'facture_items'");
    $itemsTableExists = $result->num_rows > 0;
    
    // Créer les tables si elles n'existent pas
    if (!$facturesTableExists) {
        $conn->query("CREATE TABLE factures (
            id INT(11) AUTO_INCREMENT PRIMARY KEY,
            numero_facture VARCHAR(50) NOT NULL,
            id_vendeur INT(11) NOT NULL,
            client VARCHAR(100) NOT NULL,
            email VARCHAR(100),
            date_creation DATE NOT NULL,
            date_finalisation DATE NOT NULL,
            statut VARCHAR(20) NOT NULL,
            totalttc DECIMAL(10,2) NOT NULL,
            remise DECIMAL(10,2) DEFAULT 0
        )");
    }
    
    if (!$itemsTableExists) {
        $conn->query("CREATE TABLE facture_items (
            id INT(11) AUTO_INCREMENT PRIMARY KEY,
            facture_id INT(11) NOT NULL,
            product_id INT(11) NOT NULL,
            product_name VARCHAR(100) NOT NULL,
            description TEXT,
            quantity INT(11) NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            total DECIMAL(10,2) NOT NULL,
            FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE CASCADE
        )");
    }
    
    // Vérifier s'il y a des données dans la table factures
    $result = $conn->query("SELECT COUNT(*) as count FROM factures");
    $row = $result->fetch_assoc();
    $hasFactures = $row['count'] > 0;
    
    // Ajouter des données de test si nécessaire
    if (!$hasFactures) {
        // Insérer quelques factures de test
        $conn->query("INSERT INTO factures (numero_facture, id_vendeur, client, email, date_creation, date_finalisation, statut, totalttc, remise) VALUES 
            ('FACT-001', 1, 'Client A', 'clienta@example.com', '2025-01-15', '2025-02-15', 'PAID', 1200.00, 0),
            ('FACT-002', 1, 'Client B', 'clientb@example.com', '2025-02-20', '2025-03-20', 'PENDING', 850.50, 50),
            ('FACT-003', 1, 'Client C', 'clientc@example.com', '2025-03-10', '2025-04-10', 'PAID', 2300.75, 100),
            ('FACT-004', 1, 'Client D', 'clientd@example.com', '2025-04-05', '2025-05-05', 'CANCELLED', 450.25, 0),
            ('FACT-005', 1, 'Client E', 'cliente@example.com', '2025-05-01', '2025-06-01', 'PAID', 1750.00, 75)
        ");
        
        // Récupérer les IDs des factures insérées
        $result = $conn->query("SELECT id FROM factures ORDER BY id");
        $factureIds = [];
        while ($row = $result->fetch_assoc()) {
            $factureIds[] = $row['id'];
        }
        
        // Insérer des éléments pour chaque facture
        if (count($factureIds) > 0) {
            $conn->query("INSERT INTO facture_items (facture_id, product_id, product_name, description, quantity, unit_price, total) VALUES 
                ({$factureIds[0]}, 1, 'Ordinateur portable', 'HP EliteBook 840', 2, 500.00, 1000.00),
                ({$factureIds[0]}, 2, 'Souris sans fil', 'Logitech MX Master', 4, 50.00, 200.00),
                ({$factureIds[1]}, 3, 'Clavier mécanique', 'Corsair K70', 3, 100.00, 300.00),
                ({$factureIds[1]}, 4, 'Écran 27"', 'Dell UltraSharp', 1, 550.50, 550.50),
                ({$factureIds[2]}, 5, 'Imprimante laser', 'Brother HL-L2350DW', 1, 200.75, 200.75),
                ({$factureIds[2]}, 6, 'Cartouches d\'encre', 'Pack de 4 couleurs', 5, 40.00, 200.00),
                ({$factureIds[2]}, 7, 'Papier A4', 'Ramette 500 feuilles', 10, 5.00, 50.00),
                ({$factureIds[2]}, 8, 'Disque dur externe', 'Seagate 2TB', 3, 80.00, 240.00),
                ({$factureIds[2]}, 9, 'Câble HDMI', '2m haute qualité', 5, 12.00, 60.00),
                ({$factureIds[3]}, 10, 'Webcam HD', 'Logitech C920', 1, 100.25, 100.25),
                ({$factureIds[3]}, 11, 'Microphone USB', 'Blue Yeti', 1, 150.00, 150.00),
                ({$factureIds[3]}, 12, 'Casque audio', 'Sony WH-1000XM4', 1, 200.00, 200.00),
                ({$factureIds[4]}, 13, 'Station d\'accueil', 'Dell WD19', 2, 175.00, 350.00),
                ({$factureIds[4]}, 14, 'Chaise de bureau', 'Ergonomique deluxe', 3, 250.00, 750.00),
                ({$factureIds[4]}, 15, 'Bureau ajustable', 'Hauteur réglable électrique', 2, 325.00, 650.00)
            ");
        }
    }
}

// Vérifier et créer des données de test si nécessaire
ensureTablesExist($conn);

// Traiter les requêtes GET pour récupérer les factures
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Vérifier si un ID spécifique est demandé
    if (isset($_GET['id'])) {
        $id = $_GET['id'];
        
        // Log pour débogage
        error_log("Recherche de la facture avec ID: " . $id);
        
        // Essayer de convertir l'ID en entier si c'est une chaîne
        if (is_string($id)) {
            $id = intval($id);
        }
        
        $sql = "SELECT * FROM factures WHERE id = ?";
        $stmt = $conn->prepare($sql);
        
        if (!$stmt) {
            error_log("Erreur de préparation de la requête SQL: " . $conn->error);
            http_response_code(500);
            echo json_encode(["error" => "Erreur de préparation de la requête", "details" => $conn->error]);
            exit();
        }
        
        $stmt->bind_param("i", $id);
        $result = $stmt->execute();
        
        if (!$result) {
            error_log("Erreur d'exécution de la requête: " . $stmt->error);
            http_response_code(500);
            echo json_encode(["error" => "Erreur d'exécution de la requête", "details" => $stmt->error]);
            exit();
        }
        
        $result = $stmt->get_result();
        
        if ($result->num_rows > 0) {
            $facture = $result->fetch_assoc();
            
            // Récupérer les éléments de la facture
            $facture['items'] = getFactureItems($conn, $id);
            
            error_log("Facture trouvée: " . json_encode($facture));
            echo json_encode($facture);
        } else {
            error_log("Aucune facture trouvée avec l'ID: " . $id);
            http_response_code(404);
            echo json_encode(["error" => "Facture non trouvée", "id" => $id]);
        }
    } else {
        // Récupérer toutes les factures
        $sql = "SELECT * FROM factures";
        $result = $conn->query($sql);
        
        if ($result->num_rows > 0) {
            $factures = [];
            while ($row = $result->fetch_assoc()) {
                // Récupérer les éléments de la facture
                $row['items'] = getFactureItems($conn, $row['id']);
                
                // Convertir les champs numériques
                $row['totalttc'] = (float)$row['totalttc'];
                $row['remise'] = (float)$row['remise'];
                
                // Ajouter la facture au tableau
                $factures[] = $row;
            }
            
            // Log pour débogage
            error_log("Nombre de factures récupérées: " . count($factures));
            
            echo json_encode($factures);
        } else {
            echo json_encode([]);
        }
    }
}

// Fermer la connexion
$conn->close();
?>
