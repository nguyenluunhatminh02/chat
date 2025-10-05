# Test Web Push Notifications
# Run this AFTER subscribing in browser

$BASE = "http://localhost:3000"

Write-Host "=== Web Push Notification Test ===" -ForegroundColor Cyan

# Test 1: Get public key
Write-Host "`n1. Getting VAPID public key..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE/push/public-key" -Method GET
    Write-Host "✓ Public Key: $($response.publicKey.Substring(0,50))..." -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to get public key: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Check if user has subscriptions (need to query DB or check backend logs)
Write-Host "`n2. To test push, first subscribe in browser:" -ForegroundColor Yellow
Write-Host "   - Open http://localhost:5173" -ForegroundColor Gray
Write-Host "   - Login as user (e.g., u2)" -ForegroundColor Gray
Write-Host "   - Check console for 'Push subscription successful'" -ForegroundColor Gray
Write-Host "   - Then close the tab (go offline)" -ForegroundColor Gray

# Test 3: Send test message
Write-Host "`n3. Ready to send test message? (Close browser tab first!)" -ForegroundColor Yellow
$convoId = Read-Host "Enter conversation ID"
$senderId = Read-Host "Enter sender user ID (e.g., u1)"

Write-Host "`nSending message from $senderId..." -ForegroundColor Yellow

$body = @{
    conversationId = $convoId
    type = "TEXT"
    content = "🔔 Test push notification from PowerShell script!"
} | ConvertTo-Json

try {
    $headers = @{
        "Content-Type" = "application/json"
        "X-User-Id" = $senderId
    }
    
    $response = Invoke-RestMethod -Uri "$BASE/messages" -Method POST -Headers $headers -Body $body
    Write-Host "✓ Message sent: $($response.id)" -ForegroundColor Green
    Write-Host "   Check your browser notification!" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to send message: $_" -ForegroundColor Red
    exit 1
}

# Test 4: Send multiple messages (test throttling)
Write-Host "`n4. Testing throttle (sending 3 messages rapidly)..." -ForegroundColor Yellow
Write-Host "   Expected: Only 1st push notification (2nd & 3rd throttled)" -ForegroundColor Gray

for ($i = 1; $i -le 3; $i++) {
    $body = @{
        conversationId = $convoId
        type = "TEXT"
        content = "Throttle test message #$i"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE/messages" -Method POST -Headers $headers -Body $body
        Write-Host "  ✓ Message $i sent: $($response.id)" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ Message $i failed: $_" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 1
}

Write-Host "`n5. Wait 30 seconds, then send another message..." -ForegroundColor Yellow
Write-Host "   (This one should trigger a push notification)" -ForegroundColor Gray
Write-Host "   Press Enter when ready..." -ForegroundColor Gray
Read-Host

$body = @{
    conversationId = $convoId
    type = "TEXT"
    content = "🎉 Post-throttle message - should trigger push!"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE/messages" -Method POST -Headers $headers -Body $body
    Write-Host "✓ Post-throttle message sent: $($response.id)" -ForegroundColor Green
    Write-Host "   Check browser notification!" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed: $_" -ForegroundColor Red
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Yellow
Write-Host "  - Message 1: Should trigger push ✓" -ForegroundColor Gray
Write-Host "  - Messages 2-4: Throttled (no push) ⏱" -ForegroundColor Gray
Write-Host "  - Message 5: Should trigger push after 30s ✓" -ForegroundColor Gray
