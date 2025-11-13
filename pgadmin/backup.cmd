@echo off
setlocal enabledelayedexpansion

REM Configure pg_dump path (adjust version if needed)
set "PG_DUMP=pg_dump"
if exist "%ProgramFiles%\PostgreSQL\16\bin\pg_dump.exe" set "PG_DUMP=%ProgramFiles%\PostgreSQL\16\bin\pg_dump.exe"
if exist "%ProgramFiles% (x86)%\PostgreSQL\16\bin\pg_dump.exe" set "PG_DUMP=%ProgramFiles% (x86)%\PostgreSQL\16\bin\pg_dump.exe"

REM Read connection settings from environment variables
set "DB_HOST=%DB_HOST%"
set "DB_PORT=%DB_PORT%"
set "DB_USER=%DB_USER%"
set "DB_PASS=%DB_PASS%"
set "DB_NAME=%DB_NAME%"

if "%DB_HOST%"=="" set "DB_HOST=localhost"
if "%DB_PORT%"=="" set "DB_PORT=5432"

if "%DB_NAME%"=="" (
  echo [ERROR] DB_NAME is not set. Set DB_* env vars or edit this script.
  exit /b 1
)
if "%DB_USER%"=="" (
  echo [ERROR] DB_USER is not set. Set DB_* env vars or edit this script.
  exit /b 1
)
if "%DB_PASS%"=="" (
  echo [WARN] DB_PASS is empty. If your DB requires a password, set DB_PASS first.
)

REM Build timestamp safe for filenames (YYYYMMDD_HHMMSS)
set "t=%time: =0%"
set "ts=%date:~-4%%date:~4,2%%date:~7,2%_%t:~0,2%%t:~3,2%%t:~6,2%"

REM Output in current folder (pgadmin)
set "OUT_DIR=%~dp0"
set "OUT_FILE=%OUT_DIR%campuswell_%ts%.backup"

REM Run pg_dump with custom format (-F c)
set PGPASSWORD=%DB_PASS%
"%PG_DUMP%" -h "%DB_HOST" -p "%DB_PORT%" -U "%DB_USER%" -F c -b -v -f "%OUT_FILE%" "%DB_NAME%"
set ERR=%ERRORLEVEL%
set PGPASSWORD=

if %ERR% neq 0 (
  echo [ERROR] pg_dump failed with errorlevel %ERR%.
  exit /b %ERR%
)

echo [OK] Backup saved: %OUT_FILE%
exit /b 0
