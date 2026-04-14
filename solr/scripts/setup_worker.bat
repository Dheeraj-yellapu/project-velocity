@echo off
set BRAIN_IP=%1
set MY_IP=%2

if "%MY_IP%"=="" (
    echo [ERROR] You must provide the Zookeeper IP and YOUR IP!
    echo Usage: setup_worker.bat [BRAIN_IP_ADDRESS] [YOUR_IP_ADDRESS]
    echo Example: setup_worker.bat 192.168.1.100 192.168.1.102
    exit /b
)

echo ================================
echo Starting Solr Worker Node...
echo ================================
echo Connected to Brain: %BRAIN_IP%
echo My IP is: %MY_IP%

docker rm -f solr_velocity >nul 2>&1

REM SOLR_HOST is critical so the Brain knows how to route traffic back to you!
docker run -d -p 8983:8983 --name solr_velocity -v velocity_solr_data:/var/solr -e ZK_HOST="%BRAIN_IP%:2181" -e SOLR_HOST="%MY_IP%" solr:9 solr -c -f -m 2g

echo ================================
echo Waiting for connection to establish...
timeout /t 10 >nul
echo Worker Node is running! Wait for the Brain admin to create the collection.
echo ================================
pause