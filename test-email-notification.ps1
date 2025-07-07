# Script PowerShell pour tester la fonctionnalité d'envoi d'email pour les commandes fournisseurs

# Définition des chemins et variables
$BACKEND_DIR = "c:\Users\LENOVO I5\Desktop\front+back\Stage-pfe-microservice\service-achat"
$TEST_SCRIPT = "c:\Users\LENOVO I5\Desktop\front+back\test-commande-email.js"
$LOG_FILE = "c:\Users\LENOVO I5\Desktop\front+back\email-test-log.txt"

# Fonction pour écrire dans le fichier de log
function Write-Log {
    param (
        [string]$Message
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -FilePath $LOG_FILE -Append
    Write-Host $Message
}

# Vérifier si Node.js est installé
Write-Log "Vérification de l'installation de Node.js..."
try {
    $nodeVersion = node -v
    Write-Log "Node.js version: $nodeVersion"
} catch {
    Write-Log "ERREUR: Node.js n'est pas installé ou n'est pas dans le PATH."
    Write-Log "Veuillez installer Node.js et réessayer."
    exit 1
}

# Vérifier si le fichier package.json existe dans le répertoire du test
$packageJsonPath = "c:\Users\LENOVO I5\Desktop\front+back\package.json"
if (-not (Test-Path $packageJsonPath)) {
    Write-Log "Création du fichier package.json pour le test..."
    
    @"
{
  "name": "test-commande-email",
  "version": "1.0.0",
  "description": "Test pour la fonctionnalité d'envoi d'email pour les commandes fournisseurs",
  "main": "test-commande-email.js",
  "type": "module",
  "dependencies": {
    "node-fetch": "^3.3.0"
  }
}
"@ | Out-File -FilePath $packageJsonPath -Encoding utf8
    
    Write-Log "package.json créé avec succès."
}

# Installer les dépendances
Write-Log "Installation des dépendances Node.js..."
Set-Location -Path "c:\Users\LENOVO I5\Desktop\front+back"
npm install

# Vérifier si le service Spring Boot est en cours d'exécution
Write-Log "Vérification du service Spring Boot..."
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8088/api/commandes/health" -Method GET -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Log "Le service Spring Boot est déjà en cours d'exécution."
        $serviceRunning = $true
    }
} catch {
    Write-Log "Le service Spring Boot n'est pas en cours d'exécution. Démarrage du service..."
    $serviceRunning = $false
}

# Démarrer le service Spring Boot si nécessaire
if (-not $serviceRunning) {
    Write-Log "Démarrage du service Spring Boot..."
    
    # Changer de répertoire vers le backend
    Set-Location -Path $BACKEND_DIR
    
    # Démarrer le service Spring Boot en arrière-plan
    Start-Process -FilePath "mvn" -ArgumentList "spring-boot:run" -NoNewWindow
    
    # Attendre que le service démarre
    Write-Log "Attente du démarrage du service (30 secondes)..."
    Start-Sleep -Seconds 30
    
    # Vérifier si le service a démarré
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8088/api/commandes/health" -Method GET -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Log "Le service Spring Boot a démarré avec succès."
        } else {
            Write-Log "AVERTISSEMENT: Le service Spring Boot a démarré mais renvoie un code d'état inattendu: $($response.StatusCode)"
        }
    } catch {
        Write-Log "ERREUR: Impossible de se connecter au service Spring Boot après le démarrage."
        Write-Log "Vérifiez les logs du service pour plus de détails."
        exit 1
    }
}

# Exécuter le test
Write-Log "Exécution du test de création de commande avec email..."
Set-Location -Path "c:\Users\LENOVO I5\Desktop\front+back"
node $TEST_SCRIPT

Write-Log "Test terminé. Vérifiez la boîte de réception du fournisseur pour l'email de notification."
Write-Log "Consultez également les logs du service Spring Boot pour plus de détails sur le traitement de la requête."
