const OpenAI = require('openai');
const logger = require('../../utils/logger');

/**
 * Bank Transaction Categorizer
 *
 * Two-layer categorization:
 *  1. Deterministic RULES (keyword/regex match on the description). Fast, free,
 *     predictable. Built from real Desi Chowrastha Bank of America statement data.
 *  2. LLM FALLBACK (OpenAI) for descriptions no rule matches. Optional — only
 *     runs if OPENAI_API_KEY is set. Constrained to the known category list.
 *
 * Person-to-person movements (Zelle / online transfers to a named person) are
 * mostly staff salary, so they default to "Wages (Direct/Zelle)". Nameless
 * internal account transfers (e.g. "Online transfer to CHK 9971" with no name)
 * are genuinely ambiguous and default to "Transfers / Owner Draws" for review.
 */

// Canonical category list (confirmed with the owner).
const CATEGORIES = [
    'Sales/Deposits',
    'Food Supplies',
    'Utilities',
    'Rent/Lease',
    'Payroll',
    'Payroll Taxes',
    'Taxes (Govt)',
    'Bank & Card Fees',
    'Credit Card / Loan Payment',
    'Software & Services',
    'Insurance',
    'Wages (Direct/Zelle)',
    'Cash Paid',
    'Catering Order',
    'Transfers / Owner Draws',
    'Capital Investment',
    'Other Income',
    'Uncategorized',
];

/**
 * Rules are evaluated in order; the FIRST match wins. Each rule has a `test`
 * (RegExp against the raw description, case-insensitive) and a `category`.
 * More specific rules must come before broader ones (e.g. TOAST fees before
 * TOAST deposits; vendor transfers before generic person transfers).
 */
const RULES = [
    // --- Toast POS: fees/chargebacks/end-of-month adjustments (specific first) ---
    { test: /TOAST\s+DES:CHB/i, category: 'Bank & Card Fees' },
    { test: /TOAST\s+DES:EOM/i, category: 'Bank & Card Fees' },
    { test: /Toast,?\s*Inc\s+DES:Toast/i, category: 'Software & Services' },
    // Toast deposits (sales settlement)
    { test: /TOAST\s+DES:DEP/i, category: 'Sales/Deposits' },

    // --- Third-party delivery payouts (income) ---
    { test: /DoorDash/i, category: 'Sales/Deposits' },
    { test: /GRUBHUB/i, category: 'Sales/Deposits' },
    { test: /UBER\s*EATS/i, category: 'Sales/Deposits' },

    // --- Other income ---
    { test: /Bank of America\s+DES:CASHREWARD/i, category: 'Other Income' },

    // --- Food / vendor supplies (MUST come before generic TRANSFER rule) ---
    { test: /Sysco/i, category: 'Food Supplies' },
    { test: /Restaurant\s*Depot/i, category: 'Food Supplies' },
    { test: /Emir\s*Halal/i, category: 'Food Supplies' },
    { test: /CINTAS/i, category: 'Food Supplies' },

    // --- Payroll processor & payroll taxes ---
    { test: /INTUIT\b.*DES:PAYROLL/i, category: 'Payroll' },
    { test: /INTUIT\b.*DES:TAX/i, category: 'Payroll Taxes' },
    { test: /\bGUSTO\b/i, category: 'Payroll' },

    // --- Government taxes ---
    { test: /NH\s+DEPT\s+REVENUE/i, category: 'Taxes (Govt)' },
    { test: /DEPT\s+REVENUE/i, category: 'Taxes (Govt)' },
    { test: /CITY\s+OF\s+NASHUA/i, category: 'Taxes (Govt)' },

    // --- Utilities ---
    { test: /EVERSOURCE/i, category: 'Utilities' },
    { test: /LIBERTY\s+UTILITIE/i, category: 'Utilities' },
    { test: /COMCAST|XFINITY/i, category: 'Utilities' },
    { test: /NASHUA\s+877/i, category: 'Utilities' },

    // --- Rent / lease ---
    { test: /Kimco\s+Income/i, category: 'Rent/Lease' },
    { test: /Pheasant\s+Run\s+DES:Rent/i, category: 'Rent/Lease' },
    { test: /EagleRock|Eagle\s*Rock/i, category: 'Rent/Lease' },
    { test: /HinchCrowley/i, category: 'Rent/Lease' },
    { test: /DES:Rent\b/i, category: 'Rent/Lease' },

    // --- Insurance ---
    { test: /RESIDENTINSURE|RENT\s+INSUR/i, category: 'Insurance' },
    { test: /INSURANCE|INSUR\b/i, category: 'Insurance' },

    // --- Software & services ---
    { test: /INTUIT\b.*QBooks/i, category: 'Software & Services' },
    { test: /TechMind\s+Softwa|Payments and Invoicing payment to TechMind/i, category: 'Software & Services' },

    // --- Bank / card / loan payments & fees ---
    { test: /External\s+transfer\s+fee/i, category: 'Bank & Card Fees' },
    { test: /\bDES:IC\s+PAYMENT|BKAMERICA/i, category: 'Credit Card / Loan Payment' },
    { test: /Online Banking payment to CRD/i, category: 'Credit Card / Loan Payment' },
    { test: /\bfee\b/i, category: 'Bank & Card Fees' },

    // --- Person-to-person payments: mostly staff salary -> Wages (Direct/Zelle) ---
    // Zelle to a named person.
    { test: /Zelle\s+payment\s+to\s+\S/i, category: 'Wages (Direct/Zelle)' },
    // Online transfer to an account that includes a person name after ';'
    // e.g. "Online transfer to CHK 1224 Confirmation# xxx; Towhidul Islam"
    { test: /Online\s+(Banking\s+)?transfer\s+to\s+CHK.*;\s*\S/i, category: 'Wages (Direct/Zelle)' },

    // --- Nameless internal transfers -> Transfers / Owner Draws (review in UI) ---
    // e.g. "Online Banking transfer to CHK 9971 Confirmation# XXXXX" (no name)
    { test: /Online\s+(Banking\s+)?transfer\s+to\s+CHK/i, category: 'Transfers / Owner Draws' },
    { test: /^TRANSFER\b|:\s*TRANSFER\b|\bTRANSFER\s+[A-Z]/i, category: 'Transfers / Owner Draws' },
    { test: /Payments and Invoicing payment to/i, category: 'Transfers / Owner Draws' },
];

/**
 * Apply the deterministic rules to a description.
 * @returns {string|null} category name, or null if no rule matched
 */
function categorizeByRules(description) {
    if (!description) return null;
    for (const rule of RULES) {
        if (rule.test.test(description)) {
            return rule.category;
        }
    }
    return null;
}

let _openai = null;
function getOpenAI() {
    if (_openai) return _openai;
    if (!process.env.OPENAI_API_KEY) return null;
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return _openai;
}

/**
 * LLM fallback: classify a single description into one of CATEGORIES.
 * Returns a valid category string, or 'Uncategorized' if it can't decide / errors.
 */
async function categorizeByLLM(description, amount) {
    const openai = getOpenAI();
    if (!openai) return 'Uncategorized';

    const sign = Number(amount) >= 0 ? 'credit (money in)' : 'debit (money out)';
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content:
                        'You categorize restaurant bank transactions. Respond with EXACTLY one ' +
                        'category from this list and nothing else:\n' + CATEGORIES.join('\n'),
                },
                {
                    role: 'user',
                    content: `Transaction (${sign}): "${description}". Category:`,
                },
            ],
            max_tokens: 12,
            temperature: 0,
        });
        const raw = (response.choices[0].message.content || '').trim();
        // Accept only exact matches from our list; otherwise Uncategorized.
        const match = CATEGORIES.find((c) => c.toLowerCase() === raw.toLowerCase());
        return match || 'Uncategorized';
    } catch (error) {
        logger.error(`[BankCategorizer] LLM fallback failed: ${error.message}`);
        return 'Uncategorized';
    }
}

/**
 * Categorize a list of normalized transactions.
 * Adds `category` and `categorySource` ('rule' | 'llm' | 'none') to each.
 *
 * @param {Array<{date,description,amount,type}>} transactions
 * @param {{useLLM?: boolean}} [opts]
 */
async function categorizeTransactions(transactions, opts = {}) {
    const useLLM = opts.useLLM !== false; // default: use LLM fallback if key present
    const result = [];

    for (const txn of transactions) {
        const ruleCat = categorizeByRules(txn.description);
        if (ruleCat) {
            result.push({ ...txn, category: ruleCat, categorySource: 'rule' });
            continue;
        }
        if (useLLM && getOpenAI()) {
            const llmCat = await categorizeByLLM(txn.description, txn.amount);
            result.push({
                ...txn,
                category: llmCat,
                categorySource: llmCat === 'Uncategorized' ? 'none' : 'llm',
            });
            // Gentle rate limit for the LLM path
            await new Promise((r) => setTimeout(r, 300));
        } else {
            result.push({ ...txn, category: 'Uncategorized', categorySource: 'none' });
        }
    }

    return result;
}

/**
 * Summarize categorized transactions into per-category totals.
 * Splits credits and debits so income vs spend is clear.
 */
function summarize(categorizedTxns) {
    const summary = {};
    for (const t of categorizedTxns) {
        const cat = t.category || 'Uncategorized';
        if (!summary[cat]) summary[cat] = { category: cat, credits: 0, debits: 0, net: 0, count: 0 };
        // Prefer the owner-adjusted amount when present; else the parsed amount.
        const amt = (t.adjustAmount !== undefined && t.adjustAmount !== null && t.adjustAmount !== '')
            ? Number(t.adjustAmount) || 0
            : Number(t.amount) || 0;
        if (amt >= 0) summary[cat].credits += amt;
        else summary[cat].debits += amt;
        summary[cat].net += amt;
        summary[cat].count += 1;
    }
    // Round to cents
    return Object.values(summary).map((s) => ({
        ...s,
        credits: Math.round(s.credits * 100) / 100,
        debits: Math.round(s.debits * 100) / 100,
        net: Math.round(s.net * 100) / 100,
    }));
}

module.exports = {
    CATEGORIES,
    RULES,
    categorizeByRules,
    categorizeByLLM,
    categorizeTransactions,
    summarize,
};
