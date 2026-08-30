/**
 * Bank of America statement CSV parser.
 *
 * Handles the real BofA export quirks seen in Desi Chowrastha statements:
 *  - A preamble block (Description / Summary Amt. + beginning/ending balances)
 *    before the actual transaction table. We skip everything up to and including
 *    the "Date,Description,Amount,Running Bal." header row.
 *  - Amounts quoted with thousands separators, e.g. "19,161.51", "-36,585.23".
 *    Small amounts may be unquoted, e.g. -25, 503.71, -2.5.
 *  - Two date formats in the same file: MM-DD-YYYY (dashes) and MM/DD/YYYY (slashes).
 *  - A first data row that is the beginning-balance line with an EMPTY Amount —
 *    skipped because it has no amount.
 *
 * Sign convention: credits positive, debits negative (kept as-is).
 *
 * @param {string} csvText raw CSV file contents
 * @returns {Array<{date: string, description: string, amount: number, type: 'credit'|'debit', runningBalance: number|null}>}
 */
function parseBankCsv(csvText) {
    if (!csvText || typeof csvText !== 'string') return [];

    // Normalize line endings and split.
    const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    // Find the transaction header row.
    const headerIdx = lines.findIndex((l) => {
        const low = l.toLowerCase();
        return low.startsWith('date,') && low.includes('description') && low.includes('amount');
    });

    if (headerIdx === -1) {
        // No recognizable header — nothing we can safely parse.
        return [];
    }

    const tableLines = lines.slice(headerIdx).filter((l) => l.trim() !== '');
    if (tableLines.length === 0) return [];

    // First line is the header; map column names to indices.
    const headerCols = splitCsvLine(tableLines[0]).map((h) => h.trim());
    const colIndex = (name) => headerCols.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    const dateIdx = colIndex('Date');
    const descIdx = colIndex('Description');
    const amtIdx = colIndex('Amount');
    let balIdx = colIndex('Running Bal.');
    if (balIdx === -1) balIdx = colIndex('Running Bal');

    const transactions = [];
    for (let i = 1; i < tableLines.length; i++) {
        const fields = splitCsvLine(tableLines[i]);
        const rawDate = (dateIdx >= 0 ? fields[dateIdx] || '' : '').trim();
        const description = (descIdx >= 0 ? fields[descIdx] || '' : '').trim();
        const rawAmount = (amtIdx >= 0 ? fields[amtIdx] || '' : '').trim();
        const rawBal = (balIdx >= 0 ? fields[balIdx] || '' : '').trim();

        // Skip rows with no amount (e.g. the beginning-balance line).
        if (!rawAmount) continue;
        // Skip an accidental repeat of the header.
        if (rawDate.toLowerCase() === 'date') continue;

        const amount = parseAmount(rawAmount);
        if (amount === null) continue;

        const isoDate = normalizeDate(rawDate);

        transactions.push({
            date: isoDate,          // YYYY-MM-DD (or original if unparseable)
            description,
            amount,                 // signed number
            type: amount >= 0 ? 'credit' : 'debit',
            runningBalance: rawBal ? parseAmount(rawBal) : null,
        });
    }

    return transactions;
}

/**
 * Parse a money string that may contain thousands separators, currency symbols,
 * surrounding quotes, and a leading minus. Returns a signed number, or null if
 * it cannot be parsed.
 */
function parseAmount(raw) {
    if (raw === undefined || raw === null) return null;
    let s = String(raw).trim();
    if (s === '') return null;
    // Strip quotes, currency symbols, and thousands commas/spaces.
    s = s.replace(/["'$\s]/g, '').replace(/,/g, '');
    if (s === '' || s === '-' || s === '+') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

/**
 * Normalize MM-DD-YYYY or MM/DD/YYYY to YYYY-MM-DD.
 * Returns the original string if it doesn't match a known pattern.
 */
function normalizeDate(raw) {
    if (!raw) return raw;
    const m = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (!m) return raw;
    const mm = m[1].padStart(2, '0');
    const dd = m[2].padStart(2, '0');
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
}

/**
 * Split a single CSV line into fields, honoring double-quoted fields that may
 * contain commas and escaped quotes (""). Sufficient for BofA statement rows.
 */
function splitCsvLine(line) {
    const fields = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') { cur += '"'; i++; } // escaped quote
                else inQuotes = false;
            } else {
                cur += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            fields.push(cur);
            cur = '';
        } else {
            cur += ch;
        }
    }
    fields.push(cur);
    return fields;
}

module.exports = { parseBankCsv, parseAmount, normalizeDate, splitCsvLine };
