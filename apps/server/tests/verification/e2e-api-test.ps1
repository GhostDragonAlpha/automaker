
$ErrorActionPreference = "Stop"
$BaseUrl = "http://localhost:3008/api"
$ProjectPath = "C:\Chimera" # Assume this project exists since it's the user's workspace
$FeatureTitle = "API Verification ZAI"
$LogFile = "C:\Chimera\tools\AutoMaker\logs\server.log"

Write-Host "Starting E2E API Verification..."

# 1. Verify Global Settings
Write-Host "1. Checking Global Settings..."
$settings = Invoke-RestMethod -Uri "$BaseUrl/settings/global" -Method Get
if ($settings.settings.zaiDefaultModel -ne "GLM-4.7") {
    Write-Error "Global Setting zaiDefaultModel is NOT GLM-4.7. Found: $($settings.settings.zaiDefaultModel)"
}
Write-Host "   Global Settings verified: zaiDefaultModel = GLM-4.7"


# 2. Create Feature
Write-Host "2. Creating Feature '$FeatureTitle'..."
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$createPayload = @{
    projectPath = $ProjectPath
    feature     = @{
        title       = "$FeatureTitle $timestamp"
        description = "Automated verification of Z.AI default model"
        category    = "Feature"
        priority    = 1
        # No 'model' here - explicitly testing default fallback!
    }
} | ConvertTo-Json -Depth 5

try {
    $createResponse = Invoke-RestMethod -Uri "$BaseUrl/features/create" -Method Post -Body $createPayload -ContentType "application/json"
    $FeatureId = $createResponse.feature.id
    Write-Host "   Feature created with ID: $FeatureId"
}
catch {
    Write-Error "Failed to create feature: $_"
}

# 3. Start Feature (triggers Auto Mode)
Write-Host "3. Starting Feature execution..."
$runPayload = @{
    projectPath  = $ProjectPath
    featureId    = $FeatureId
    useWorktrees = $false
} | ConvertTo-Json

try {
    # Capture line count to skip old logs
    if (Test-Path $LogFile) {
        $startLogLength = (Get-Content $LogFile).Count
    }
    else {
        $startLogLength = 0
    }

    Invoke-RestMethod -Uri "$BaseUrl/auto-mode/run-feature" -Method Post -Body $runPayload -ContentType "application/json"
    Write-Host "   Feature execution started."
}
catch {
    Write-Error "Failed to start feature: $_"
}

# 4. Verify Logs for Correct Model Usage
Write-Host "4. Verifying logs for Z.AI usage..."
$maxRetries = 20 # 10 seconds total (0.5s sleep)
$retryCount = 0
$foundZai = $false
$foundClaude = $false

while ($retryCount -lt $maxRetries) {
    if (Test-Path $LogFile) {
        # Read new lines added since start
        # character stream -Encoding UTF8 could be an issue, use Get-Content with ReadCount
        $allLogs = Get-Content $LogFile
        $recentLogs = $allLogs | Select-Object -Skip $startLogLength 
        
        # Updated match based on source code: (Line 599) "Executing feature ... with model: ... provider: ..."
        if ($recentLogs -match "Executing feature $FeatureId with model: glm-4.7") {
            $foundZai = $true
            Write-Host "   SUCCESS: Found confirmation log for Feature $FeatureId"
            break
        }
        if ($recentLogs -match "Executing feature $FeatureId with model: claude") {
            $foundClaude = $true
            Write-Error "FAILURE: Found CLAUDE executing Feature $FeatureId"
            break
        }
    }
    Start-Sleep -Milliseconds 500
    $retryCount++
}

if (-not $foundZai) {
    Write-Error "Timed out waiting for logs for Feature $FeatureId"
}

Write-Host "E2E VERIFICATION COMPLETE: ALL CHECKS PASSED"
