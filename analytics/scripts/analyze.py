from pathlib import Path

LOG_DIR = Path("analytics/logs")


def main() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    files = list(LOG_DIR.glob("*.log"))
    print(f"Found {len(files)} log files")


if __name__ == "__main__":
    main()
