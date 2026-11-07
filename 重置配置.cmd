@echo off
echo Reset pet profile. Only window position / zoom / caches are removed.
echo Lines, config.json and animations are NOT touched.
set "P=%APPDATA%\mesugaki-lite"
if exist "%P%" rmdir /s /q "%P%"
echo Done. Now run Start.cmd or the shortcut again.
pause