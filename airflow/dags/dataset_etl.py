from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import sys
import os
import json
import logging
import requests

# Ensure the scripts directory is in the PYTHONPATH so we can import dataset_merger
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from scripts.dataset_merger import merge_datasets

# ============================================================
# CONFIG — These match your docker-compose and cluster setup
# ============================================================
SOLR_URL = os.getenv("SOLR_URL", "http://10.145.245.107:8983/solr")
COLLECTION = os.getenv("SOLR_COLLECTION", "global_news")
MERGED_FILE = "/opt/airflow/data/processed/merged_dataset.json"
BATCH_SIZE = 500  # Index in batches to avoid timeouts

default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}


def load_to_solr():
    """
    Load Phase: Read merged_dataset.json and POST to Solr for indexing.
    Solr + ZooKeeper will automatically replicate to all 4 nodes.
    """
    if not os.path.exists(MERGED_FILE):
        logging.error(f"Merged file not found: {MERGED_FILE}")
        raise FileNotFoundError(f"Missing: {MERGED_FILE}")

    with open(MERGED_FILE, "r", encoding="utf-8") as f:
        docs = json.load(f)

    if not docs:
        logging.warning("No documents to index. Skipping.")
        return

    logging.info(f"Indexing {len(docs)} documents to {SOLR_URL}/{COLLECTION}")

    # Step 1: Index in batches (Append Mode)
    update_url = f"{SOLR_URL}/{COLLECTION}/update?commit=true"
    total_indexed = 0

    for i in range(0, len(docs), BATCH_SIZE):
        batch = docs[i:i + BATCH_SIZE]
        try:
            res = requests.post(
                update_url,
                json=batch,
                headers={"Content-Type": "application/json"},
                timeout=120
            )
            res.raise_for_status()
            total_indexed += len(batch)
            logging.info(f"Indexed batch {i // BATCH_SIZE + 1}: {len(batch)} docs (total: {total_indexed}/{len(docs)})")
        except Exception as e:
            logging.error(f"Failed to index batch starting at {i}: {e}")
            raise

    logging.info(f"Successfully indexed {total_indexed} documents into {COLLECTION}")
    logging.info(f"ZooKeeper will now replicate to all 4 nodes automatically")


with DAG(
    'velocity_dataset_etl',
    default_args=default_args,
    description='ETL pipeline to merge datasets and index them into Solr',
    schedule_interval=timedelta(days=1),  # Run once a day
    start_date=datetime(2025, 1, 1),
    catchup=False,
    tags=['project-velocity', 'etl'],
) as dag:

    # 1. Extract: Verify raw datasets exist
    extract_datasets_task = BashOperator(
        task_id='extract_datasets',
        bash_command='''
            echo "=== EXTRACT PHASE ==="
            echo "Checking for datasets in /opt/airflow/data/raw/"
            ls -la /opt/airflow/data/raw/*.json 2>/dev/null || echo "WARNING: No .json files found in data/raw/"
            echo "Dataset count: $(ls /opt/airflow/data/raw/*.json 2>/dev/null | wc -l)"
        ''',
    )

    # 2. Transform: Merge all datasets with auto field-mapping
    transform_and_merge_task = PythonOperator(
        task_id='transform_and_merge',
        python_callable=merge_datasets,
    )

    # 3. Load: Index merged data into Solr (auto-replicates to 4 nodes)
    load_to_solr_task = PythonOperator(
        task_id='load_to_solr',
        python_callable=load_to_solr,
    )

    # Define Workflow Dependencies
    extract_datasets_task >> transform_and_merge_task >> load_to_solr_task
