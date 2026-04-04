import json
from pathlib import Path

# Keep only these fields in each article object
KEEP_FIELDS = ["url", "title", "type", "pub", "lang", "sum", "body"]

INPUT_FILE = Path("relevant_articles_cleaned.json")
OUTPUT_FILE = Path("relevant_articles_selected_fields.json")


def normalize_pub(value):
    if isinstance(value, dict) and "$date" in value:
        date_value = value["$date"]
        if isinstance(date_value, str):
            return date_value.replace("+0000", "Z")
    return value


def project_record(record):
    if not isinstance(record, dict):
        return record
    projected = {field: record.get(field) for field in KEEP_FIELDS}
    projected["pub"] = normalize_pub(projected.get("pub"))
    return projected


def extract_records(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ["data", "items", "articles", "records", "results"]:
            if key in data and isinstance(data[key], list):
                return data[key]
        return [data]
    raise ValueError("Unsupported JSON format. Expected list or object.")


def main():
    with INPUT_FILE.open("r", encoding="utf-8") as f:
        data = json.load(f)

    records = extract_records(data)
    filtered = [project_record(r) for r in records]

    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(filtered, f, ensure_ascii=False, indent=2)

    print(f"Created: {OUTPUT_FILE}")
    print(f"Total records written: {len(filtered)}")


if __name__ == "__main__":
    main()
