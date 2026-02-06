@echo off
title CloudPipe
cd /d "%~dp0"

echo.
echo   CloudPipe - Local Deploy Gateway
echo   ================================
echo.

echo [1/3] Stopping old instance...
call pm2 delete cloudpipe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] Starting server with PM2...
call pm2 start ecosystem.config.js
if errorlevel 1 (
  echo.
  echo ERROR: PM2 failed to start server!
  pause
  exit /b 1
)

timeout /t 5 /nobreak >nul

REM Check if server is running
call pm2 list | findstr "online" >nul
if errorlevel 1 (
  echo.
  echo ERROR: Server failed to start!
  echo Check logs with: pm2 logs cloudpipe
  pause
  exit /b 1
)

echo   Server is running!
echo.
echo [3/3] Starting tunnel...
echo   Press Ctrl+C to stop tunnel
echo.
C:\Users\jeffb\cloudflared.exe tunnel --config cloudflared.yml run cloudpipe

echo.
echo Tunnel stopped.
pause
