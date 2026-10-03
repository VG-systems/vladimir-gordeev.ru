@echo off
title Python Web Server
chcp 65001 > nul

:: Переходим в директорию, где лежит сам батник
cd /d "%~dp0"

set PORT=8000

echo ========================================================
echo  Запуск локального сервера
echo  Папка: %CD%
echo  Адрес: http://localhost:%PORT%
echo ========================================================
echo.
echo Для остановки сервера нажмите Ctrl + C
echo.

:: Автоматически открываем страницу в браузере по умолчанию
start http://localhost:%PORT%

:: Запускаем сервер через python (или py, если python не прописан в alias)
python -m http.server %PORT%
if %errorlevel% neq 0 (
    py -m http.server %PORT%
)

:: Если запуск не удался (Python не установлен или не в PATH)
if %errorlevel% neq 0 (
    echo.
    echo [ОШИБКА] Python не найден!
    echo Убедитесь, что Python установлен и при установке была включена галочка "Add Python to PATH".
    echo.
    pause
)