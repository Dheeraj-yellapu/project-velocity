import json
import os
from pathlib import Path

import requests

SOLR_URL = os.getenv("SOLR_URL", "http://10.145.245.107:8983/solr")
COLLECTION = os.getenv("COLLECTION", "global_news")
INPUT_FILE = Path(os.getenv("INPUT_FILE", "data/processed/merged_dataset.json"))
BATCH_SIZE = 500


def main() -> None:
    if not INPUT_FILE.exists():
        raise FileNotFoundError(f"Missing input file: {INPUT_FILE}")

    with INPUT_FILE.open("r", encoding="utf-8") as f:
        docs = json.load(f)

    print(f"Indexing {len(docs)} documents into {COLLECTION}...")

    # Index in batches
    url = f"{SOLR_URL}/{COLLECTION}/update?commit=true"
    total = 0

    for i in range(0, len(docs), BATCH_SIZE):
        batch = docs[i:i + BATCH_SIZE]
        res = requests.post(url, json=batch, timeout=120)
        res.raise_for_status()
        total += len(batch)
        print(f"  Batch {i // BATCH_SIZE + 1}: indexed {total}/{len(docs)} docs")

    print(f"Done! Indexed {total} documents into {COLLECTION}")


if __name__ == "__main__":
    main()
