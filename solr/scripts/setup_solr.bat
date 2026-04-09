@echo off

echo ================================
echo Starting Solr Setup...
echo ================================

REM Step 1: Kill old processes
echo Killing old Solr instances...
taskkill /F /IM java.exe >nul 2>&1

REM Step 2: Start Solr
echo Starting Solr...
call solr start -c -Dsolr.jetty.host=0.0.0.0

REM Wait for Solr to boot
timeout /t 10 >nul

REM Step 3: Create collection (ignore if exists)
echo Creating collection...
call solr create -c global_news -s 1 -rf 1 >nul 2>&1

REM Step 4: Add schema
echo Adding schema...
curl -X POST -H "Content-type: application/json" "http://localhost:8983/solr/global_news/schema" --data-binary @schema.json

REM Step 5: Index data
echo Indexing data...
curl -H "Content-Type: application/json" "http://localhost:8983/solr/global_news/update?commit=true&f.sum.dest=summary&f.pub.dest=published_at" --data-binary @"E:\DBMS Term Project\archive (1)\relevant_articles_selected_fields.json"

echo ================================
echo Setup Complete 🚀
echo ================================

pause