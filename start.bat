@echo off
echo Starting PIMS Production Intelligence System...
echo.

cd /d "%~dp0"

echo Stopping old servers on ports 3000 and 5000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000 " ^| findstr LISTENING') do taskkill /F /PID %%a >nul 2>&1

timeout /t 2 /nobreak >nul

echo Starting backend on http://localhost:5000 ...
start "PIMS Backend" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting frontend on http://localhost:3000 ...
start "PIMS Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo   Open http://localhost:3000 in browser
echo   Login: admin@pmrs.com / admin123
echo ========================================
pause
