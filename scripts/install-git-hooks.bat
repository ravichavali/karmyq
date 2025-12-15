@echo off
REM Install Git Hooks for Karmyq (Windows)
REM Sets up pre-commit and pre-push hooks to enforce testing

echo Installing Git hooks for Karmyq...

REM Check if we're in a git repository
if not exist ".git" (
  echo Error: Not in a git repository
  exit /b 1
)

REM Create .git/hooks directory if it doesn't exist
if not exist ".git\hooks" mkdir ".git\hooks"

REM Copy hooks (Windows uses different path separators)
echo Copying pre-commit hook...
copy /Y scripts\git-hooks\pre-commit .git\hooks\pre-commit

echo Copying pre-push hook...
copy /Y scripts\git-hooks\pre-push .git\hooks\pre-push

echo.
echo Git hooks installed successfully!
echo.
echo The following hooks are now active:
echo   * pre-commit: TypeScript type check + integration tests
echo   * pre-push: Full test suite (integration + E2E)
echo.
echo To bypass hooks (not recommended):
echo   git commit --no-verify
echo   git push --no-verify
echo.
