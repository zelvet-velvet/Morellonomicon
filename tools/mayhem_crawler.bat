@echo off
rem Opens the Mayhem crawler menu (tools/fetch_lcu.py) in WSL. Double-click to run.
title Mayhem crawler
wsl.exe --cd "%~dp0.." python3 -I tools/fetch_lcu.py
pause
