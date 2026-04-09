import "dotenv/config";
import { setupSolr } from "../services/solrAdminService.js";

function readArgValue(args, key) {
  for (const arg of args) {
    if (arg.startsWith(`${key}=`)) {
      return arg.slice(key.length + 1);
    }
  }
  return undefined;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const skipIndex = args.has("--skip-index");
  const startLocal = args.has("--start-local");
  const inputFile = readArgValue(args, "--input-file");
  const schemaFile = readArgValue(args, "--schema-file");

  const result = await setupSolr({ skipIndex, startLocal, inputFile, schemaFile });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("Failed to set up Solr:", error.message);
  process.exit(1);
});