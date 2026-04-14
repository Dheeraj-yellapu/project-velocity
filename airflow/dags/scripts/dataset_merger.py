import json
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)

# ============================================================
# FIELD MAPPING TABLE
# Maps common field names from ANY dataset to your Solr schema.
# Airflow uses this to auto-rename fields — no manual renaming needed.
# ============================================================
FIELD_MAPPING = {
    # Solr field "url" <- any of these input field names
    "url":          ["url", "link", "href", "source_url", "article_url", "web_url", "uri"],
    # Solr field "title"
    "title":        ["title", "headline", "heading", "name", "article_title", "header"],
    # Solr field "type"
    "type":         ["type", "category", "section", "topic", "news_type", "media_type"],
    # Solr field "published_at" (pdate in Solr)
    "published_at": ["pub", "published_at", "date", "publishedAt", "publish_date",
                     "pubDate", "created_at", "publication_date", "timestamp",
                     "datePublished", "published", "time", "pub_date"],
    # Solr field "lang"
    "lang":         ["lang", "language", "locale", "iso_language"],
    # Solr field "summary"
    "summary":      ["sum", "summary", "description", "snippet", "abstract",
                     "excerpt", "short_description", "lead", "intro", "blurb"],
    # Solr field "body"
    "body":         ["body", "content", "text", "article_text", "full_text",
                     "articleBody", "article_body", "main_text", "story"],
}

# Build a reverse lookup: input_field_name -> solr_field_name
_REVERSE_MAP = {}
for solr_field, aliases in FIELD_MAPPING.items():
    for alias in aliases:
        _REVERSE_MAP[alias.lower()] = solr_field

# Solr schema fields (the output)
SOLR_FIELDS = list(FIELD_MAPPING.keys())

RAW_DATA_DIR = Path("/opt/airflow/data/raw")
PROCESSED_DATA_DIR = Path("/opt/airflow/data/processed")
OUTPUT_FILE = PROCESSED_DATA_DIR / "merged_dataset.json"


def normalize_date(value):
    """Normalize various date formats to ISO 8601 for Solr's pdate field."""
    if value is None or value == "":
        return None
    # Handle MongoDB-style {"$date": "..."} objects
    if isinstance(value, dict) and "$date" in value:
        date_value = value["$date"]
        if isinstance(date_value, str):
            return date_value.replace("+0000", "Z")
    if isinstance(value, str):
        # Already ISO format — just return it
        return value
    return str(value)


def extract_records(data):
    """Extract the record list from various JSON structures."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        # Try common wrapper keys
        for key in ["data", "items", "articles", "records", "results",
                     "docs", "entries", "news", "response", "stories"]:
            if key in data and isinstance(data[key], list):
                return data[key]
        # Single record wrapped in an object
        return [data]
    return []


def map_record_fields(record):
    """
    Map any input field names to Solr schema field names using the mapping table.
    This is the AUTOMATIC RENAMING — no hardcoding needed per dataset.
    """
    if not isinstance(record, dict):
        return None

    mapped = {}
    for input_key, input_value in record.items():
        solr_field = _REVERSE_MAP.get(input_key.lower())
        if solr_field and solr_field not in mapped:
            # First match wins (don't overwrite if already mapped)
            mapped[solr_field] = input_value

    return mapped


def validate_and_clean(record):
    """Validate a mapped record and fill defaults."""
    if not record:
        return None

    # Must have a URL for deduplication
    if not record.get("url"):
        return None

    # Normalize the date field
    record["published_at"] = normalize_date(record.get("published_at"))

    # Fill defaults for missing fields
    for field in SOLR_FIELDS:
        if field not in record or record[field] is None:
            if field == "lang":
                record[field] = "en"  # Default language
            elif field == "published_at":
                record[field] = None  # Solr handles null dates fine
            else:
                record[field] = ""

    # Only keep Solr fields (drop any extra mapped fields)
    return {field: record[field] for field in SOLR_FIELDS}


def merge_datasets():
    """
    Main ETL transform function called by Airflow.
    Reads all JSON files from data/raw/, maps fields, deduplicates, outputs merged JSON.
    """
    if not RAW_DATA_DIR.exists():
        logging.warning(f"Raw data directory {RAW_DATA_DIR} does not exist! Creating it.")
        RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
        return

    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Also load existing processed data to merge incrementally
    unique_records = {}
    if OUTPUT_FILE.exists():
        try:
            with OUTPUT_FILE.open("r", encoding="utf-8") as f:
                existing = json.load(f)
            for rec in existing:
                if rec.get("url"):
                    unique_records[rec["url"]] = rec
            logging.info(f"Loaded {len(unique_records)} existing records from {OUTPUT_FILE.name}")
        except Exception as e:
            logging.warning(f"Could not load existing merged data: {e}")

    raw_files = list(RAW_DATA_DIR.glob("*.json"))
    if not raw_files:
        logging.warning("No .json files found in data/raw/. Nothing to merge.")
        return

    for file_path in raw_files:
        logging.info(f"Processing dataset: {file_path.name}")

        try:
            with file_path.open("r", encoding="utf-8") as f:
                data = json.load(f)

            records = extract_records(data)
            count_added = 0

            for r in records:
                mapped = map_record_fields(r)
                cleaned = validate_and_clean(mapped)
                if cleaned and cleaned["url"] not in unique_records:
                    unique_records[cleaned["url"]] = cleaned
                    count_added += 1

            logging.info(f"  -> Extracted {count_added} new unique records from {file_path.name}")
            logging.info(f"  -> (Skipped {len(records) - count_added} duplicates/invalid)")

        except Exception as e:
            logging.error(f"Failed to process {file_path.name}: {e}")

    merged_list = list(unique_records.values())

    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(merged_list, f, ensure_ascii=False, indent=2)

    logging.info(f"Successfully merged {len(merged_list)} total unique records into {OUTPUT_FILE.name}")


if __name__ == "__main__":
    merge_datasets()
