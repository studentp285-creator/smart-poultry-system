@echo off
echo Starting Smart Poultry Backend (Django)...
cd /d "%~dp0backend"
python manage.py runserver 8000
pause
