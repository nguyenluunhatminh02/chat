@echo off
echo Installing Shadcn/UI dependencies...
echo.

cd /d "%~dp0"

echo Installing class-variance-authority, clsx, tailwind-merge, tailwindcss-animate...
call npm install class-variance-authority clsx tailwind-merge tailwindcss-animate

echo.
echo Installing @radix-ui/react-slot...
call npm install @radix-ui/react-slot

echo.
echo ✅ Installation complete!
echo.
echo To start the dev server, run: npm run dev
echo Then visit: http://localhost:5173/shadcn-demo
echo.
pause