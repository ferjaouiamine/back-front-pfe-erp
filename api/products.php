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

// Traiter les requêtes GET pour récupérer les produits
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    // Vérifier si un ID spécifique est demandé
    if (isset($_GET['id'])) {
        $id = $_GET['id'];
        $sql = "SELECT * FROM products WHERE id = ?";
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows > 0) {
            $product = $result->fetch_assoc();
            echo json_encode($product);
        } else {
            http_response_code(404);
            echo json_encode(["error" => "Produit non trouvé"]);
        }
    } else {
        // Récupérer tous les produits
        $sql = "SELECT * FROM products";
        $result = $conn->query($sql);
        
        if ($result->num_rows > 0) {
            $products = [];
            while ($row = $result->fetch_assoc()) {
                $products[] = $row;
            }
            echo json_encode($products);
        } else {
            echo json_encode([]);
        }
    }
}

// Fermer la connexion
$conn->close();
?>
