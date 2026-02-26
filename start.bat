@echo off
chcp 65001 >nul
title CloudPipe
cd /d "%~dp0"

echo.
echo   CloudPipe - Local Deploy Gateway
echo   ================================
echo.

REM ============================================================
REM  Step 0: Check & install prerequisites
REM ============================================================

echo [0/4] Checking prerequisites...

REM --- winget ---
winget --version >nul 2>&1
if errorlevel 1 (
  echo.
  echo   [ERROR] winget not found!
  echo   Install from: https://aka.ms/getwinget
  pause
  exit /b 1
)

REM --- Node.js ---
node --version >nul 2>&1
if errorlevel 1 (
  echo   Installing Node.js...
  winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements >nul 2>&1
  call :REFRESH_PATH
  node --version >nul 2>&1
  if errorlevel 1 (
    echo   [ERROR] Node.js install failed, restart terminal and try again
    pause
    exit /b 1
  )
)
echo   Node.js OK

REM --- Git ---
git --version >nul 2>&1
if errorlevel 1 (
  echo   Installing Git...
  winget install Git.Git --accept-source-agreements --accept-package-agreements >nul 2>&1
  call :REFRESH_PATH
  git --version >nul 2>&1
  if errorlevel 1 (
    echo   [ERROR] Git install failed, restart terminal and try again
    pause
    exit /b 1
  )
)
echo   Git OK

REM --- PM2 ---
call pm2 --version >nul 2>&1
if errorlevel 1 (
  echo   Installing PM2...
  call npm install -g pm2 >nul 2>&1
  call :REFRESH_PATH
)
echo   PM2 OK

REM --- node_modules ---
if not exist node_modules (
  echo   Installing dependencies...
  call npm install >nul 2>&1
)
echo   Dependencies OK
echo.

REM ============================================================
REM  Step 1-4: Start services
REM ============================================================

echo [1/4] Stopping old instances...
call pm2 delete all >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/4] Starting CloudPipe core...
call pm2 start ecosystem.config.js --only cloudpipe
if errorlevel 1 (
  echo.
  echo   [ERROR] PM2 failed to start CloudPipe!
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

pm2 list 2>nul | findstr "online" >nul
if errorlevel 1 (
  echo.
  echo   [ERROR] No services started!
  echo   Check logs with: pm2 logs
  pause
  exit /b 1
)

echo   All services running!
echo.
echo [4/4] Starting tunnel...
echo   Press Ctrl+C to stop tunnel
echo.

REM Read cloudflared path from config.json dynamically
FOR /F "delims=" %%i IN ('node -e "console.log(require('./config.json').cloudflared?.path||'cloudflared')" 2^>nul') DO SET CF_CMD=%%i
if "%CF_CMD%"=="" set CF_CMD=cloudflared
"%CF_CMD%" tunnel --config cloudflared.yml run cloudpipe

echo.
echo Tunnel stopped.
pause
exit /b 0

REM ============================================================
REM  Refresh PATH from registry (no terminal restart needed)
REM ============================================================
:REFRESH_PATH
for /f "tokens=2*" %%a in ('reg query "HKLM\System\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SysPath=%%b"
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "UserPath=%%b"
set "PATH=%SysPath%;%UserPath%"
exit /b 0
