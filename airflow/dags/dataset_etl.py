from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import sys
import os

# Ensure the scripts directory is in the PYTHONPATH so we can import dataset_merger
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from scripts.dataset_merger import merge_datasets

default_args = {
    'owner': 'airflow',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

with DAG(
    'velocity_dataset_etl',
    default_args=default_args,
    description='ETL pipeline to merge datasets and index them into Solr',
    schedule_interval=timedelta(days=1), # Run once a day
    start_date=datetime(2025, 1, 1),
    catchup=False,
    tags=['project-velocity', 'etl'],
) as dag:

    # 1. Dummy Task representing Extract. 
    # In reality, this could be downloading files from S3 or an API.
    extract_datasets_task = BashOperator(
        task_id='extract_datasets',
        bash_command='echo "Datasets should be placed in /opt/airflow/data/raw/"',
    )

    # 2. Transform Phase: Call our python logical merger script
    transform_and_merge_task = PythonOperator(
        task_id='transform_and_merge',
        python_callable=merge_datasets,
    )

    # 3. Load Phase: Call the local reindex script
    # We assume the airflow container maps the /opt/airflow/data directory and project root.
    # Adjust this path based on how we trigger the solr indexing from inside airflow.
    # Alternatively, you could use a SimpleHttpOperator if your backend exposes an indexing API.
    load_to_solr_task = BashOperator(
        task_id='load_to_solr',
        # NOTE: Make sure the script is accessible and Airflow has permissions.
        # This will just print a log in this basic setup to show how it fits.
        bash_command='echo "Simulating Solr ingestion for merged_dataset.json"',
    )

    # Define Workflow Dependencies
    extract_datasets_task >> transform_and_merge_task >> load_to_solr_task
