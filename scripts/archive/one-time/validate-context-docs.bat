@echo off
REM Validate CONTEXT.md completeness (Windows version)
REM Usage: scripts\validate-context-docs.bat [service-name]
REM        scripts\validate-context-docs.bat --all

setlocal enabledelayedexpansion

set "REQUIRED_SECTIONS=Last Updated;Version:;Port:;Quick Start;## 1. Overview;## 2. Architecture;## 3. API Reference;## 4. Events;## 5. Key Patterns;## 6. Dependencies;## 7. Testing;## 8. Configuration;## 9. Monitoring;## 10. Troubleshooting;## 11. Future Enhancements;## 12. Related Documentation"

set "CRITICAL_SERVICES=request-service;auth-service;community-service"

echo ========================================
echo CONTEXT.md Validation Report
echo ========================================
echo.

if "%1"=="--all" goto check_all
if "%1"=="" goto check_all
goto check_one

:check_all
for /d %%d in (services\*) do (
    if exist "%%d\CONTEXT.md" (
        call :check_file "%%d\CONTEXT.md"
    )
)
goto summary

:check_one
set "context_file=services\%1\CONTEXT.md"
if not exist "%context_file%" (
    echo Error: CONTEXT.md not found for %1
    exit /b 1
)
call :check_file "%context_file%"
goto end

:check_file
set "file=%~1"
for %%f in ("%file%") do set "service_name=%%~dpf"
for %%f in ("%service_name:~0,-1%") do set "service_name=%%~nxf"

echo Checking: %service_name%

set missing_count=0
set total_sections=16

for %%s in (%REQUIRED_SECTIONS%) do (
    findstr /C:"%%s" "%file%" >nul 2>&1
    if errorlevel 1 (
        echo   X Missing: %%s
        set /a missing_count+=1
    )
)

set /a present_count=total_sections-missing_count
set /a compliance_percent=present_count*100/total_sections

if %missing_count%==0 (
    echo   √ 100%% Complete ^(%total_sections%/%total_sections% sections^)
) else (
    echo   ⚠ %compliance_percent%%% Complete ^(%present_count%/%total_sections% sections^)

    REM Check if critical
    echo %CRITICAL_SERVICES% | findstr /C:"%service_name%" >nul 2>&1
    if not errorlevel 1 (
        echo   ⚠ CRITICAL SERVICE - Must be 100%% complete
        set EXIT_CODE=1
    )
)
echo.
goto :eof

:summary
echo ========================================
echo Summary
echo ========================================
echo.
echo Critical services ^(must be 100%%^):
for %%s in (%CRITICAL_SERVICES%) do (
    echo   - %%s
)
echo.

if defined EXIT_CODE (
    echo X Some critical services are incomplete
    exit /b 1
) else (
    echo √ All critical services are compliant
)
goto end

:end
endlocal
