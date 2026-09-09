@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Wildwood needs Node.js 22 or newer. Install it from https://nodejs.org
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo Preparing Wildwood for the first time...
  call npm.cmd install --no-audit --no-fund
  if errorlevel 1 goto failed
  call npm.cmd run build
  if errorlevel 1 goto failed
)
echo.
echo    W I L D W O O D
echo    A little wilderness. Endless possibility.
echo.
node server.mjs --open
if errorlevel 1 pause
exit /b
:failed
echo Setup failed. Check the error above and try again.
pause
