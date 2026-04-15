# project-velocity
High QPS Text Search Engine

## Project Overview

Project Velocity is a distributed, high-performance search engine built on Apache Solr with 1000+ QPS throughput capability. It features a 4-node SolrCloud cluster deployed across physical machines, three Docker-containerized Node.js backend servers with cluster mode, Nginx load balancing, and a 3-tier caching architecture (in-memory L1, Redis L2, Solr L3). The system achieves sub-200ms latency under normal load with advanced optimizations including connection pooling (500 concurrent sockets), request coalescing, and intelligent cache management. A React-based admin dashboard provides real-time analytics, performance metrics, and system monitoring capabilities for the entire search infrastructure.

