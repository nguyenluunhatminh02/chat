# PHẦN 17 - MODERATION & BLOCKS TEST SCRIPT
# Run these commands in PowerShell to test the moderation system

# Setup: Replace these with actual IDs from your database
$USER1 = "cmgdazo6p0000ukag3e7sdljd"  # minh4
$USER2 = "cmg97sct00000uk3v0j6k5f6k"  # Replace with another user ID
$CONVERSATION_ID = "YOUR_CONVERSATION_ID"  # Replace with a DIRECT conversation ID
$MESSAGE_ID = "YOUR_MESSAGE_ID"  # Replace with a message ID to report

Write-Host "`n=== 1. BLOCK SYSTEM ===" -ForegroundColor Cyan

Write-Host "`n1.1) User1 blocks User2" -ForegroundColor Yellow
curl.exe -X POST http://localhost:3000/blocks `
  -H "Content-Type: application/json" `
  -H "X-User-Id: $USER1" `
  -d "{`"blockedUserId`":`"$USER2`"}"

Write-Host "`n1.2) List User1's blocks" -ForegroundColor Yellow
curl.exe http://localhost:3000/blocks `
  -H "X-User-Id: $USER1"

Write-Host "`n1.3) Try to send DM (should fail with 403)" -ForegroundColor Yellow
curl.exe -X POST http://localhost:3000/messages `
  -H "Content-Type: application/json" `
  -H "X-User-Id: $USER2" `
  -d "{`"conversationId`":`"$CONVERSATION_ID`",`"type`":`"TEXT`",`"content`":`"This should fail`"}"

Write-Host "`n1.4) Unblock User2" -ForegroundColor Yellow
curl.exe -X DELETE "http://localhost:3000/blocks/$USER2" `
  -H "X-User-Id: $USER1"

Write-Host "`n`n=== 2. REPORT SYSTEM ===" -ForegroundColor Cyan

Write-Host "`n2.1) User1 reports a message" -ForegroundColor Yellow
curl.exe -X POST http://localhost:3000/moderation/reports `
  -H "Content-Type: application/json" `
  -H "X-User-Id: $USER1" `
  -d "{`"type`":`"MESSAGE`",`"targetMessageId`":`"$MESSAGE_ID`",`"reason`":`"ABUSE`",`"details`":`"Offensive content`"}"

Write-Host "`n2.2) Admin lists all OPEN reports" -ForegroundColor Yellow
curl.exe "http://localhost:3000/moderation/reports?status=OPEN" `
  -H "X-Admin: 1"

Write-Host "`n2.3) Admin resolves report (DELETE_MESSAGE)" -ForegroundColor Yellow
$REPORT_ID = "PASTE_REPORT_ID_HERE"  # Get from previous command
curl.exe -X POST "http://localhost:3000/moderation/reports/$REPORT_ID/resolve" `
  -H "Content-Type: application/json" `
  -H "X-Admin: 1" `
  -H "X-User-Id: admin" `
  -d "{`"action`":`"DELETE_MESSAGE`",`"resolutionNotes`":`"Violated community guidelines`"}"

Write-Host "`n`n=== 3. GROUP MODERATION ===" -ForegroundColor Cyan

$GROUP_ID = "YOUR_GROUP_ID"  # Replace with a GROUP conversation ID
$TARGET_USER = "USER_TO_KICK"  # Replace with user ID to kick/ban

Write-Host "`n3.1) Admin kicks a member" -ForegroundColor Yellow
curl.exe -X POST "http://localhost:3000/moderation/conversations/$GROUP_ID/kick" `
  -H "Content-Type: application/json" `
  -H "X-User-Id: $USER1" `
  -d "{`"userId`":`"$TARGET_USER`"}"

Write-Host "`n3.2) Admin bans a member (with reason)" -ForegroundColor Yellow
curl.exe -X POST "http://localhost:3000/moderation/conversations/$GROUP_ID/ban" `
  -H "Content-Type: application/json" `
  -H "X-User-Id: $USER1" `
  -d "{`"userId`":`"$TARGET_USER`",`"reason`":`"Spam`"}"

Write-Host "`n3.3) List all bans in group" -ForegroundColor Yellow
curl.exe "http://localhost:3000/moderation/conversations/$GROUP_ID/bans" `
  -H "X-User-Id: $USER1"

Write-Host "`n3.4) Unban member" -ForegroundColor Yellow
curl.exe -X DELETE "http://localhost:3000/moderation/conversations/$GROUP_ID/ban/$TARGET_USER" `
  -H "X-User-Id: $USER1"

Write-Host "`n`n=== 4. APPEAL SYSTEM ===" -ForegroundColor Cyan

Write-Host "`n4.1) User creates an appeal for a ban" -ForegroundColor Yellow
curl.exe -X POST http://localhost:3000/moderation/appeals `
  -H "Content-Type: application/json" `
  -H "X-User-Id: $TARGET_USER" `
  -d "{`"banId`":`"${GROUP_ID}:${TARGET_USER}`",`"reason`":`"I was wrongly banned, it was a misunderstanding`"}"

Write-Host "`n4.2) Admin lists pending appeals" -ForegroundColor Yellow
curl.exe "http://localhost:3000/moderation/appeals?status=PENDING" `
  -H "X-Admin: 1"

Write-Host "`n4.3) Admin approves appeal (unbans user)" -ForegroundColor Yellow
$APPEAL_ID = "PASTE_APPEAL_ID_HERE"  # Get from previous command
curl.exe -X POST "http://localhost:3000/moderation/appeals/$APPEAL_ID/review" `
  -H "Content-Type: application/json" `
  -H "X-Admin: 1" `
  -H "X-User-Id: admin" `
  -d "{`"decision`":`"APPROVED`",`"reviewNotes`":`"Appeal granted, ban lifted`"}"

Write-Host "`n`n=== TEST COMPLETE ===" -ForegroundColor Green
Write-Host "Remember to replace placeholder IDs with actual values from your database!" -ForegroundColor Yellow
