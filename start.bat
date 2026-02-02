@echo off
title CloudPipe
cd /d "%~dp0"

echo.
echo   CloudPipe - Local Deploy Gateway
echo   ================================
echo.

echo [1/2] Starting server with PM2...

REM Kill PM2 daemon completely to ensure clean start
pm2 kill >nul 2>&1

REM Wait for PM2 to fully stop
timeout /t 3 /nobreak >nul

REM Start using ecosystem config
pm2 start ecosystem.config.js

REM Wait for server to fully start
timeout /t 5 /nobreak >nul

REM Check if server is running
pm2 list | findstr "online" >nul
if errorlevel 1 (
  echo ERROR: Server failed to start!
  echo Check logs with: pm2 logs cloudpipe
  pause
  exit /b 1
)

echo [2/2] Starting tunnel...
C:\Users\jeffb\cloudflared.exe tunnel --config cloudflared.yml run cloudpipe

pause
