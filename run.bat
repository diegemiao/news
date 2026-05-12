@echo off
cd /d C:\Users\win11\Desktop\news
node scripts\main.js
echo.
echo git push...
git stash
git pull --rebase origin master
git stash pop
git add data\archive.json docs\index.html
git commit -m "manual push: news update"
git push origin master
echo.
echo Done
pause
