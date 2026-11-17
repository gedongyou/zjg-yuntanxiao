@echo off
chcp 65001 >nul
title 云探校 · 内容后台
cd /d "%~dp0"

rem 已经在跑了就直接开页面，不用再起一个
netstat -ano | findstr /c:":7717" >nul 2>nul
if not errorlevel 1 (
  echo.
  echo   后台已经在运行，直接打开页面……
  start "" http://127.0.0.1:7717/admin/
  timeout /t 2 >nul
  exit /b 0
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   没有找到 Node.js。
  echo   到 https://nodejs.org 装一个 LTS 版本，装完再双击这个文件。
  echo.
  pause
  exit /b 1
)

echo.
echo   云探校 · 内容后台正在启动……
echo.
echo   前台  http://127.0.0.1:7717/
echo   后台  http://127.0.0.1:7717/admin/
echo   口令  首次为 admin123
echo.
echo   关掉这个黑窗口就等于关掉后台。
echo.

start /b "" node server.mjs
timeout /t 3 >nul
start "" http://127.0.0.1:7717/admin/

echo.
echo   后台在后台运行中，关掉本窗口即停止。
pause >nul
