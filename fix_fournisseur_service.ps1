$filePath = "c:\Users\LENOVO I5\Desktop\front+back\Stage-pfe-front-end\src\app\modules\fournisseur\services\fournisseur.service.ts"
$content = Get-Content -Path $filePath -Raw

# Créer une expression régulière pour trouver la deuxième implémentation de getCommandes
$pattern = '(?s)  /\*\*\r?\n   \* Récupère la liste des commandes du fournisseur avec pagination et filtrage\r?\n   \*/\r?\n  getCommandes\(page: number = 0, size: number = 10, statut\?: StatutCommande\): Observable<any> \{.*?\}\r?\n\r?\n  /\*\*\r?\n   \* Met à jour le statut d''une commande'

# Remplacer la deuxième implémentation par une chaîne vide
$newContent = $content -replace $pattern, '  /**
   * Met à jour le statut d''une commande'

# Sauvegarder le fichier modifié
$newContent | Set-Content -Path $filePath -NoNewline

Write-Host "Le fichier a été corrigé avec succès."
