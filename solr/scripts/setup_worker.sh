#!/bin/bash

BRAIN_IP=$1
MY_IP=$2

if [ -z "$MY_IP" ]; then
    echo "[ERROR] You must provide the Zookeeper IP and YOUR IP!"
    echo "Usage: ./setup_worker.sh [BRAIN_IP_ADDRESS] [YOUR_IP_ADDRESS]"
    echo "Example: ./setup_worker.sh 192.168.1.100 192.168.1.102"
    exit 1
fi

echo "================================"
echo "Starting Solr Worker Node..."
echo "================================"
echo "Connected to Brain: $BRAIN_IP"
echo "My IP is: $MY_IP"

docker rm -f solr_velocity >/dev/null 2>&1

# Pass -z and --host explicitly, AND use -f so the container doesn't exit immediately!
# docker run -d -p 8983:8983 --name solr_velocity -e SOLR_HOST="$MY_IP" solr:9 solr -c -f -z "$BRAIN_IP:2181" --host "$MY_IP" -m 2g
docker run -d -p 8983:8983 --name solr_velocity -v velocity_solr_data:/var/solr -e ZK_HOST="$BRAIN_IP:2181" -e SOLR_HOST="$MY_IP" solr:9 solr -c -f -m 2g

echo "================================"
echo "Waiting for connection to establish..."
sleep 10
echo "Worker Node is running! Wait for the Brain admin to create the collection."
echo "================================"
