@echo off
set MY_IP=%1

if "%MY_IP%"=="" (
    echo [ERROR] You must provide your machine's IP address!
    echo Usage: setup_brain.bat [YOUR_IP_ADDRESS]
    echo Example: setup_brain.bat 192.168.1.100
    exit /b
)

echo ================================
echo Starting ZooKeeper "Brain"...
echo ================================
docker rm -f velocity_zk >nul 2>&1
docker run -d -p 2181:2181 --name velocity_zk -v velocity_zk_data:/data -v velocity_zk_datalog:/datalog zookeeper:3.8

echo Waiting for ZooKeeper to initialize...
timeout /t 5 >nul

echo ================================
echo Starting Solr Brain Node...
echo ================================
docker rm -f solr_velocity >nul 2>&1
REM SOLR_HOST is critical so other machines can route back to this node
docker run -d -p 8983:8983 --name solr_velocity -v velocity_solr_data:/var/solr -e ZK_HOST="%MY_IP%:2181" -e SOLR_HOST="%MY_IP%" solr:9 solr -c -f -m 2g

echo Waiting for Solr to boot...
timeout /t 10 >nul

echo ================================
echo Injecting Shared Configurations into ZooKeeper...
echo ================================
docker cp "..\server\solr\configsets\_default\conf\managed-schema.xml" solr_velocity:/tmp/managed-schema
docker cp "..\server\solr\configsets\_default\conf\solrconfig.xml" solr_velocity:/tmp/solrconfig.xml

REM Create a custom config dir, inject our files, and push to ZooKeeper
docker exec solr_velocity bash -c "mkdir -p /tmp/velocity_conf && cp -r /opt/solr/server/solr/configsets/_default/conf/* /tmp/velocity_conf/ && cp /tmp/managed-schema /tmp/velocity_conf/managed-schema && cp /tmp/solrconfig.xml /tmp/velocity_conf/solrconfig.xml && solr zk upconfig -z %MY_IP%:2181 -n shared_velocity_config -d /tmp/velocity_conf"

echo ================================
echo Setup Complete!
echo Tell your 3 friends to run their worker scripts pointing to: %MY_IP%
echo DO NOT create the collection until all 3 friends are connected!
echo ================================
pause