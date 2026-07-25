@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0generar-vsix.ps1" %*
