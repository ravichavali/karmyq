@echo off
REM Quick batch wrapper for capturing Claude Code sessions
REM Usage:
REM   scripts\capture-claude-sessions.bat [days] [autocommit|auto]
REM
REM Examples:
REM   scripts\capture-claude-sessions.bat 1           - Interactive, last 1 day
REM   scripts\capture-claude-sessions.bat 7 auto      - Non-interactive, last 7 days
REM   scripts\capture-claude-sessions.bat 90 auto     - Initial capture (90 days)

setlocal

REM Set UTF-8 encoding
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
chcp 65001 >nul 2>&1

REM Get days back parameter (default 7)
set DAYS=%1
if "%DAYS%"=="" set DAYS=7

REM Get mode flag
set FLAGS=
if /i "%2"=="autocommit" set FLAGS=-AutoCommit
if /i "%2"=="auto" set FLAGS=-NonInteractive

REM Run PowerShell script (use v2 which supports both modes)
powershell -ExecutionPolicy Bypass -File "%~dp0capture-claude-sessions-v2.ps1" -DaysBack %DAYS% %FLAGS%

endlocal
