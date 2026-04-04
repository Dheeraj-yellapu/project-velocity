import json
import os
from pathlib import Path

import requests

SOLR_URL = os.getenv("SOLR_URL", "http://localhost:8983/solr")
COLLECTION = os.getenv("COLLECTION", "news")
INPUT_FILE = Path("data/processed/news.json")


def main() -> None:
    if not INPUT_FILE.exists():
        raise FileNotFoundError(f"Missing input file: {INPUT_FILE}")

    with INPUT_FILE.open("r", encoding="utf-8") as f:
        docs = json.load(f)

    url = f"{SOLR_URL}/{COLLECTION}/update?commit=true"
    res = requests.post(url, json=docs, timeout=60)
    res.raise_for_status()
    print(f"Indexed {len(docs)} documents into {COLLECTION}")


if __name__ == "__main__":
    main()
