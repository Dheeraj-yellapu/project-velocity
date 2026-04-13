#!/bin/bash

MY_IP=$1

if [ -z "$MY_IP" ]; then
    echo "[ERROR] You must provide your machine's IP address!"
    echo "Usage: ./setup_brain.sh [YOUR_IP_ADDRESS]"
    echo "Example: ./setup_brain.sh 192.168.1.100"
    exit 1
fi

echo "================================"
echo "Starting ZooKeeper \"Brain\"..."
echo "================================"
docker rm -f velocity_zk >/dev/null 2>&1
docker run -d -p 2181:2181 --name velocity_zk zookeeper:3.8

echo "Waiting for ZooKeeper to initialize..."
sleep 5

echo "================================"
echo "Starting Solr Brain Node..."
echo "================================"
docker rm -f solr_velocity >/dev/null 2>&1
# SOLR_HOST is critical so other machines can route back to this node. Using -z and --host explicitly!
docker run -d -p 8983:8983 --name solr_velocity -e SOLR_HOST="$MY_IP" solr:9 solr -c -z "$MY_IP:2181" --host "$MY_IP" -m 2g

echo "Waiting for Solr to boot..."
sleep 15

echo "================================"
echo "Injecting Shared Configurations into ZooKeeper..."
echo "================================"
# If running this from the solr/scripts folder:
docker cp "../schema/managed-schema" solr_velocity:/tmp/managed-schema
docker cp "../config/solrconfig.xml" solr_velocity:/tmp/solrconfig.xml

# Create a custom config dir, inject our files, and push to ZooKeeper
docker exec solr_velocity bash -c "mkdir -p /tmp/velocity_conf && cp -r /var/solr/data/configsets/_default/conf/* /tmp/velocity_conf/ 2>/dev/null || cp -r /opt/solr/server/solr/configsets/_default/conf/* /tmp/velocity_conf/ && cp /tmp/managed-schema /tmp/velocity_conf/managed-schema.xml && cp /tmp/solrconfig.xml /tmp/velocity_conf/solrconfig.xml && solr zk upconfig -z $MY_IP:2181 -n shared_velocity_config -d /tmp/velocity_conf"

echo "================================"
echo "Setup Complete!"
echo "Tell your 3 friends to run their worker scripts pointing to: $MY_IP"
echo "DO NOT create the collection until all 3 friends are connected!"
echo "================================"
