#!/usr/bin/env pwsh
# API Test Script - Order to Cash System
# Usage: .\test-api.ps1

param(
    [string]$BaseUrl = "http://localhost:3001"
)

Write-Host "`n========== Order-to-Cash API Test Suite ==========" -ForegroundColor Cyan

$passedTests = 0
$failedTests = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Uri,
        [string]$Method = "Get",
        [hashtable]$Body = $null,
        [string]$ExpectedStatus = "200"
    )
    
    Write-Host "▶ Testing: $Name" -ForegroundColor Yellow
    try {
        $params = @{
            Uri = $Uri
            Method = $Method
            TimeoutSec = 30
        }
        
        if ($Method -eq "Post" -and $Body) {
            $params["ContentType"] = "application/json"
            $params["Body"] = ($Body | ConvertTo-Json)
        }
        
        $response = irm @params
        Write-Host "  ✓ PASSED" -ForegroundColor Green
        Write-Host "  Response: $(($response | ConvertTo-Json -Depth 1).Substring(0, 100))..." -ForegroundColor Gray
        $script:passedTests++
    } catch {
        Write-Host "  ✗ FAILED: $_" -ForegroundColor Red
        $script:failedTests++
    }
    Write-Host ""
}

# ========== SECTION HEADERS ==========
# 1. HEALTH CHECK
# ===========================================
Write-Host "`n=== 1. HEALTH CHECK ===" -ForegroundColor Cyan
Test-Endpoint -Name "Server Health" -Uri "$BaseUrl/health"

# ===========================================
# 2. GRAPH API
# ===========================================
Write-Host "═══ 2. GRAPH API ═══`n" -ForegroundColor Cyan
Test-Endpoint -Name "Get Full Graph" -Uri "$BaseUrl/api/graph"

# ===========================================
# 3. GRAPH NODE API
# ===========================================
Write-Host "═══ 3. GRAPH NODE API ═══`n" -ForegroundColor Cyan
Test-Endpoint -Name "Get Sales Order 740506" -Uri "$BaseUrl/api/graph/node/so/740506"
Test-Endpoint -Name "Get Delivery 80738076" -Uri "$BaseUrl/api/graph/node/del/80738076"
Test-Endpoint -Name "Get Billing Document 90504248" -Uri "$BaseUrl/api/graph/node/bd/90504248"

# ===========================================
# 4. CHAT API - TRACE FLOW
# ===========================================
Write-Host "═══ 4. CHAT API - TRACE FLOW ═══`n" -ForegroundColor Cyan
Test-Endpoint `
    -Name "Trace Sales Order Flow" `
    -Uri "$BaseUrl/api/chat" `
    -Method "Post" `
    -Body @{message = "Trace the full flow of sales order 740506"}

# ===========================================
# 5. CHAT API - BROKEN FLOWS
# ===========================================
Write-Host "═══ 5. CHAT API - BROKEN FLOWS ═══`n" -ForegroundColor Cyan
Test-Endpoint `
    -Name "Find Orders Delivered but Not Billed" `
    -Uri "$BaseUrl/api/chat" `
    -Method "Post" `
    -Body @{message = "Show me sales orders that were delivered but not billed"}

# ===========================================
# 6. CHAT API - DATA ANALYSIS
# ===========================================
Write-Host "═══ 6. CHAT API - DATA ANALYSIS ═══`n" -ForegroundColor Cyan
Test-Endpoint `
    -Name "Products with Most Billing Docs" `
    -Uri "$BaseUrl/api/chat" `
    -Method "Post" `
    -Body @{message = "Which products are associated with the highest number of billing documents?"}

Test-Endpoint `
    -Name "High Value Orders" `
    -Uri "$BaseUrl/api/chat" `
    -Method "Post" `
    -Body @{message = "Show me the sales orders with the highest total amounts"}

# ===========================================
# 7. CHAT API - COMPLEX QUERIES
# ===========================================
Write-Host "═══ 7. CHAT API - COMPLEX QUERIES ═══`n" -ForegroundColor Cyan
Test-Endpoint `
    -Name "Count Pending Deliveries" `
    -Uri "$BaseUrl/api/chat" `
    -Method "Post" `
    -Body @{message = "How many sales orders are still pending delivery?"}

Test-Endpoint `
    -Name "Paid Billing Documents" `
    -Uri "$BaseUrl/api/chat" `
    -Method "Post" `
    -Body @{message = "Which billing documents have been paid?"}

# ===========================================
# 8. CHAT API - GUARDRAIL TESTS
# ===========================================
Write-Host "═══ 8. CHAT API - GUARDRAIL TESTS ═══`n" -ForegroundColor Cyan
Test-Endpoint `
    -Name "Reject: Poetry Request" `
    -Uri "$BaseUrl/api/chat" `
    -Method "Post" `
    -Body @{message = "Write me a poem about flowers"}

Test-Endpoint `
    -Name "Reject: Weather Query" `
    -Uri "$BaseUrl/api/chat" `
    -Method "Post" `
    -Body @{message = "What is the weather today?"}

Test-Endpoint `
    -Name "Reject: General Knowledge" `
    -Uri "$BaseUrl/api/chat" `
    -Method "Post" `
    -Body @{message = "What is the capital of France?"}

# ===========================================
# 9. ERROR HANDLING
# ===========================================
Write-Host "=== 9. ERROR HANDLING ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Testing: Missing Message Field" -ForegroundColor Yellow
try {
    $response = irm -Uri "$BaseUrl/api/chat" -Method Post -ContentType "application/json" -Body "{}" -TimeoutSec 10
    Write-Host "  FAILED - Should have rejected empty body" -ForegroundColor Red
    $script:failedTests++
} catch {
    Write-Host "  PASSED - Correctly rejected bad request" -ForegroundColor Green
    $script:passedTests++
}
Write-Host ""

# ===========================================
# SUMMARY
# ===========================================
Write-Host "`n========== TEST SUMMARY ==========" -ForegroundColor Cyan
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $failedTests" -ForegroundColor Red
Write-Host "Total:  $($passedTests + $failedTests)" -ForegroundColor Cyan
Write-Host ""

if ($failedTests -eq 0) {
    Write-Host "All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some tests failed. Please check the errors above." -ForegroundColor Yellow
    exit 1
}
