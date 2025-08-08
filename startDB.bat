@echo off
title PostgreSQL

REM Переходим в каталог с PostgreSQL (флаг /D для смены диска при необходимости)
cd /D "C:\Program Files\PostgreSQL\17\bin"

REM Запуск сервера
pg_ctl.exe start -D "C:\Program Files\PostgreSQL\17\data"

REM Проверка статуса сервера
pg_ctl.exe status -D "C:\Program Files\PostgreSQL\17\data"

pause
