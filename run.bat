@echo off
cd /d C:\Users\win11\Desktop\news
node scripts\main.js
echo.
echo Pushing to GitHub...
for /f "delims=" %%i in ('"C:\Program Files\GitHub CLI\gh.exe" auth token') do set GH_TOKEN=%%i
set GH_TOKEN=%GH_TOKEN%
node scripts\push.js
echo Done
pause
