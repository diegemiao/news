@echo off
cd /d C:\Users\win11\Desktop\news
node scripts\main.js
echo.
echo Pushing to GitHub...
node scripts\push.js
echo Done
pause
