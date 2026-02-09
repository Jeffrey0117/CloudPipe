@echo off
title CloudPipe
cd /d "%~dp0"

echo.
echo   CloudPipe - Local Deploy Gateway
echo   ================================
echo.

echo [1/3] Stopping old instances...
call pm2 delete all >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] Starting all services with PM2...
call pm2 start ecosystem.config.js
if errorlevel 1 (
  echo.
  echo ERROR: PM2 failed to start services!
  pause
  exit /b 1
)

timeout /t 5 /nobreak >nul

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
echo [3/3] Starting tunnel...
echo   Press Ctrl+C to stop tunnel
echo.
C:\Users\jeffb\cloudflared.exe tunnel --config cloudflared.yml run cloudpipe

echo.
echo Tunnel stopped.
pause
