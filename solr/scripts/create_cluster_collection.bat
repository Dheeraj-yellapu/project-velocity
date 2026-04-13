@echo off
set BRAIN_IP=%1

if "%BRAIN_IP%"=="" (
    echo Usage: create_cluster_collection.bat [BRAIN_IP]
    echo Example: create_cluster_collection.bat 192.168.1.100
    exit /b
)

echo ================================
echo Creating 4-Node Distributed Cluster...
echo ================================

docker exec solr_velocity solr create -c global_news -n shared_velocity_config -s 1 -rf 4

echo Collection created! You can now run your indexer script.
pause