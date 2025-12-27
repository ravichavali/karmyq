@echo off
REM Quick batch wrapper for capturing Claude Code sessions
REM Usage: scripts\capture-claude-sessions.bat [days] [autocommit]

setlocal

REM Set UTF-8 encoding
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
chcp 65001 >nul 2>&1

REM Get days back parameter (default 7)
set DAYS=%1
if "%DAYS%"=="" set DAYS=7

REM Get autocommit flag
set AUTOCOMMIT=
if /i "%2"=="autocommit" set AUTOCOMMIT=-AutoCommit

REM Run PowerShell script
powershell -ExecutionPolicy Bypass -File "%~dp0capture-claude-sessions.ps1" -DaysBack %DAYS% %AUTOCOMMIT%

endlocal
