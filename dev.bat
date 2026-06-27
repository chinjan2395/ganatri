@echo off
REM Ganatri Development Server Startup Script (Windows)
REM Starts: Server (port 3000), Web (port 5173), Storybook (port 6006)

setlocal enabledelayedexpansion

echo.
echo ====================================================
echo Starting Ganatri Development Environment (Windows)
echo ====================================================
echo.

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if !errorlevel! neq 0 (
        echo Failed to install dependencies
        exit /b 1
    )
)

echo [1/3] Starting Server on http://localhost:3000...
start cmd /k "cd packages/server && npm run dev"
timeout /t 2 /nobreak

echo [2/3] Starting Web App on http://localhost:5173...
start cmd /k "cd packages/web && npm run dev"
timeout /t 2 /nobreak

echo [3/3] Starting Storybook on http://localhost:6006...
start cmd /k "cd packages/ds && npm run storybook"
timeout /t 2 /nobreak

echo.
echo ====================================================
echo All services started successfully!
echo ====================================================
echo.
echo   Server:    http://localhost:3000
echo   Web App:   http://localhost:5173
echo   Storybook: http://localhost:6006
echo.
echo Close individual windows to stop services
echo.
pause
