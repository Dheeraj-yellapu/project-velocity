import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store the log file at the root of the backend folder
const logFilePath = path.join(__dirname, '..', '..', 'audit.log');

// Create a non-blocking write stream (appends to the file)
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

/**
 * Persistently logs an audit entry to a local JSONL file via a non-blocking stream.
 * @param {Object} entry Record to log
 */
export function logAudit(entry) {
  // Convert entry to JSON string and append newline
  logStream.write(JSON.stringify(entry) + '\n');
}
