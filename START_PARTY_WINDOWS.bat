@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 is required. Install it from https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules\ws\package.json (
  call npm ci --omit=dev --ignore-scripts --no-audit --no-fund
  if errorlevel 1 (
    echo Dependency installation failed. Check your internet connection.
    pause
    exit /b 1
  )
)
node server\index.cjs
pause
