@echo off
echo Stopping backend...
taskkill /F /IM node.exe >nul 2>&1

echo.
echo Regenerating Prisma client...
cd backend
call npx prisma generate

echo.
echo Starting backend...
call npm run start:dev
