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

echo [0] Checking prerequisites...

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
REM  First-time setup: auto-run setup.js if no config.json
REM ============================================================

if not exist config.json (
  echo   ========================================
  echo   First-time setup detected!
  echo   ========================================
  echo.
  call node setup.js
  if errorlevel 1 (
    echo.
    echo   [ERROR] Setup failed!
    pause
    exit /b 1
  )
  echo.
  echo   Setup complete!
  echo.
)

REM ============================================================
REM  Start all services + tunnel via PM2
REM ============================================================

echo [1/3] Stopping old instances...
call pm2 delete all >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] Starting all services + tunnel...
call pm2 start ecosystem.config.js
if errorlevel 1 (
  echo.
  echo   [ERROR] PM2 failed to start!
  pause
  exit /b 1
)

REM Save process list for pm2 resurrect
call pm2 save >nul 2>&1

timeout /t 5 /nobreak >nul

echo.
echo [3/3] Service status:
echo.
call pm2 list

pm2 list 2>nul | findstr "online" >nul
if errorlevel 1 (
  echo.
  echo   [ERROR] No services started!
  echo   Check logs with: pm2 logs
  pause
  exit /b 1
)

echo.
echo   All services + tunnel running!
echo   Managed by PM2 (survives terminal close)
echo.
echo   Commands:
echo     pm2 list          - status
echo     pm2 logs          - live logs
echo     pm2 logs tunnel   - tunnel logs
echo     pm2 stop all      - stop everything
echo.
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
