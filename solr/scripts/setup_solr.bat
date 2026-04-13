@echo off
set BRAIN_IP=%1

if "%BRAIN_IP%"=="" (
    echo Usage: setup_solr.bat [BRAIN_IP]
    echo Example: setup_solr.bat 192.168.1.100
    exit /b
)

echo ================================
echo Deleting old collection to force schema reload...
echo ================================
curl "http://%BRAIN_IP%:8983/solr/admin/collections?action=DELETE&name=global_news"
echo.

echo ================================
echo Creating 4-Node Distributed Cluster...
echo ================================

REM Bypassing the buggy Docker 'solr create' script by using the bulletproof Solr HTTP API
curl "http://%BRAIN_IP%:8983/solr/admin/collections?action=CREATE&name=global_news&numShards=1&replicationFactor=4&collection.configName=shared_velocity_config"
echo.

echo ================================
echo Waiting for collection to fully initialize...
echo ================================
timeout /t 5 >nul

echo ================================
echo Checking if data is already indexed on the cluster...
echo ================================

curl -s "http://%BRAIN_IP%:8983/solr/global_news/select?q=*:*&rows=0" | findstr /C:"\"numFound\":0" >nul
if %errorlevel% equ 0 (
    echo Index is empty. Indexing data across all 4 nodes...
    curl -H "Content-Type: application/json" "http://%BRAIN_IP%:8983/solr/global_news/update?commit=true&f.sum.dest=summary&f.pub.dest=published_at" --data-binary @"E:\DBMS Term Project\archive (1)\relevant_articles_selected_fields.json"
) else (
    echo Data is already indexed. Skipping indexing to avoid duplicates.
)
echo ================================
echo Cluster Setup and Indexing Complete 🚀
echo ================================
pause