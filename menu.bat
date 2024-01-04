@echo off
setlocal

:: Obtener la ruta completa del directorio donde se encuentra este script
set "APP_DIR=%~dp0"

:: Eliminar la última barra invertida de APP_DIR
set "APP_DIR=%APP_DIR:~0,-1%"

:: Ejecutar el script principal
node "%APP_DIR%\index.js"

endlocal
