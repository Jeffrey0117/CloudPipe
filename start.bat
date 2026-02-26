@echo off
title CloudPipe
cd /d "%~dp0"

echo.
echo   CloudPipe - Local Deploy Gateway
echo   ================================
echo.

echo [1/4] Stopping old instances...
call pm2 delete all >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/4] Starting CloudPipe core...
call pm2 start ecosystem.config.js --only cloudpipe
if errorlevel 1 (
  echo.
  echo ERROR: PM2 failed to start CloudPipe!
  pause
  exit /b 1
)
timeout /t 5 /nobreak >nul

echo [3/4] Deploying projects...
call node scripts/deploy-all.js
timeout /t 2 /nobreak >nul

echo.
call pm2 list
echo.

REM Check if at least one service is running
call pm2 list | findstr "online" >nul
if errorlevel 1 (
  echo.
  echo ERROR: No services started!
  echo Check logs with: pm2 logs
  pause
  exit /b 1
)

echo   All services running!
echo.
echo [4/4] Starting tunnel...
echo   Press Ctrl+C to stop tunnel
echo.

REM Read cloudflared path from config.json dynamically
FOR /F "delims=" %%i IN ('node -e "console.log(require('./config.json').cloudflared?.path||'cloudflared')"') DO SET CF_CMD=%%i
"%CF_CMD%" tunnel --config cloudflared.yml run cloudpipe

echo.
echo Tunnel stopped.
pause
