import json
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)

# Define canonical fields expected by your search engine
KEEP_FIELDS = ["url", "title", "type", "pub", "lang", "sum", "body"]

RAW_DATA_DIR = Path("/opt/airflow/data/raw")
PROCESSED_DATA_DIR = Path("/opt/airflow/data/processed")
OUTPUT_FILE = PROCESSED_DATA_DIR / "merged_dataset.json"


def normalize_pub(value):
    if isinstance(value, dict) and "$date" in value:
        date_value = value["$date"]
        if isinstance(date_value, str):
            return date_value.replace("+0000", "Z")
    return value

def extract_records(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ["data", "items", "articles", "records", "results"]:
            if key in data and isinstance(data[key], list):
                return data[key]
        return [data]
    return []

def project_record(record):
    if not isinstance(record, dict):
        return None
    
    projected = {field: record.get(field) for field in KEEP_FIELDS}
    projected["pub"] = normalize_pub(projected.get("pub"))
    
    # Basic validation: ensure a url exists to allow deduplication
    if not projected.get("url"):
        return None
        
    # Ensure missing strings are null/empty string instead of undefined
    for field in KEEP_FIELDS:
        if projected[field] is None:
            if field == "lang":
                projected[field] = "en"
            else:
                projected[field] = ""
                
    return projected

def merge_datasets():
    if not RAW_DATA_DIR.exists():
        logging.warning("Raw data directory does not exist! Creating it.")
        RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
        return
        
    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)

    unique_records = {} # mapping from URL -> record

    for file_path in RAW_DATA_DIR.glob("*.json"):
        logging.info(f"Processing dataset: {file_path.name}")
        
        try:
            with file_path.open("r", encoding="utf-8") as f:
                data = json.load(f)
                
            records = extract_records(data)
            count_added = 0
            
            for r in records:
                normalized = project_record(r)
                if normalized and normalized["url"] not in unique_records:
                    unique_records[normalized["url"]] = normalized
                    count_added += 1
                    
            logging.info(f"-> Extracted {count_added} new unique records from {file_path.name}")
            
        except Exception as e:
            logging.error(f"Failed to process {file_path.name}: {e}")

    merged_list = list(unique_records.values())
    
    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(merged_list, f, ensure_ascii=False, indent=2)

    logging.info(f"Successfully merged {len(merged_list)} total unique records into {OUTPUT_FILE.name}")

if __name__ == "__main__":
    merge_datasets()
