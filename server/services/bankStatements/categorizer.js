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

// Canonical category list for the RESTAURANT entity (confirmed with the owner).
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

// Category list for the TECHMIND (IT consulting/development/training) entity.
const TECHMIND_CATEGORIES = [
    'Client Revenue',
    'Payroll/Contractors',
    'Payroll Taxes',
    'Software & SaaS',
    'Cloud/Hosting',
    'Hardware/Equipment',
    'Office/Rent',
    'Travel',
    'Professional Services (Legal/Accounting)',
    'Marketing',
    'Bank & Card Fees',
    'Taxes (Govt)',
    'Owner Draws/Distributions',
    'Transfers',
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
 * Deterministic rules for the TECHMIND entity. First match wins; specific
 * before general. Seeded for an IT consulting/development/training firm on
 * Bank of America. Client payments arrive by ACH/Zelle/wire/card processors;
 * payroll is ADP; cloud + SaaS are the main recurring spend.
 */
const TECHMIND_RULES = [
    // --- Payroll (ADP) & payroll taxes (specific tax variant before generic) ---
    { test: /ADP\b.*(TAX|DES:ADP\s*Tax)/i, category: 'Payroll Taxes' },
    { test: /ADP\b.*(PAYROLL|WAGE|DES:ADP|RUN)/i, category: 'Payroll/Contractors' },
    { test: /\bADP\b/i, category: 'Payroll/Contractors' },
    { test: /GUSTO/i, category: 'Payroll/Contractors' },
    { test: /Zelle\s+payment\s+to\s+\S/i, category: 'Payroll/Contractors' }, // contractor/staff payouts

    // --- Client revenue (inbound payments) ---
    { test: /STRIPE/i, category: 'Client Revenue' },
    { test: /\bPAYPAL\b.*(TRANSFER|DEP|DES:)/i, category: 'Client Revenue' },
    { test: /\bWIRE\s+(TYPE:)?.*(CREDIT|IN\b)|INCOMING\s+WIRE/i, category: 'Client Revenue' },
    { test: /Zelle\s+payment\s+from\s+\S/i, category: 'Client Revenue' },
    { test: /DES:(ACCTVERIFY|VENDORPYMT|PAYMENT).*(CREDIT)/i, category: 'Client Revenue' },

    // --- Cloud / hosting ---
    { test: /AMAZON\s+WEB\s+SERVICES|\bAWS\b|AMZN\s*AWS/i, category: 'Cloud/Hosting' },
    { test: /MICROSOFT\s*AZURE|\bAZURE\b/i, category: 'Cloud/Hosting' },
    { test: /GOOGLE\s*\*?\s*CLOUD|GCP\b/i, category: 'Cloud/Hosting' },
    { test: /DIGITALOCEAN|LINODE|HEROKU|NETLIFY|VERCEL|CLOUDFLARE/i, category: 'Cloud/Hosting' },
    { test: /GODADDY|NAMECHEAP/i, category: 'Cloud/Hosting' },

    // --- Software & SaaS ---
    { test: /GITHUB|GITLAB|ATLASSIAN|JIRA|BITBUCKET/i, category: 'Software & SaaS' },
    { test: /GOOGLE\s*\*?\s*(WORKSPACE|GSUITE)|MICROSOFT\s*365|OFFICE\s*365/i, category: 'Software & SaaS' },
    { test: /SLACK|ZOOM|NOTION|FIGMA|JETBRAINS|OPENAI|ANTHROPIC/i, category: 'Software & SaaS' },
    { test: /ADOBE|DOCKER|DATADOG|TWILIO|SENDGRID|MAILCHIMP|INTUIT\b.*QBooks|QUICKBOOKS/i, category: 'Software & SaaS' },

    // --- Hardware / equipment ---
    { test: /\bDELL\b|\bAPPLE\s+STORE|BEST\s*BUY|\bNEWEGG|\bMICROCENTER|B&H\s+PHOTO|\bLENOVO\b/i, category: 'Hardware/Equipment' },

    // --- Marketing ---
    { test: /GOOGLE\s*\*?\s*ADS|\bGOOGLE\s+ADWORDS|FACEBOOK\s*ADS|\bMETA\s+ADS|LINKEDIN|INDEED/i, category: 'Marketing' },

    // --- Professional services (legal / accounting) ---
    { test: /\bLLP\b|LEGAL|ATTORNEY|\bCPA\b|ACCOUNTING|BOOKKEEP/i, category: 'Professional Services (Legal/Accounting)' },

    // --- Insurance (map to professional services bucket is wrong; IT firm keeps it under prof. services? No — no insurance cat; treat as prof services) ---

    // --- Office / rent ---
    { test: /DES:Rent\b|\bRENT\b|WEWORK|REGUS|LANDLORD/i, category: 'Office/Rent' },
    { test: /COMCAST|XFINITY|VERIZON|\bATT\b|T-MOBILE|RCN\b/i, category: 'Office/Rent' }, // internet/phone for an office

    // --- Travel ---
    { test: /UNITED\s+AIR|DELTA\s+AIR|AMERICAN\s+AIR|SOUTHWEST|JETBLUE|\bUBER\b|\bLYFT\b|MARRIOTT|HILTON|HYATT|AIRBNB|EXPEDIA/i, category: 'Travel' },

    // --- Government taxes ---
    { test: /\bIRS\b|US\s+TREASURY|DEPT\s+REVENUE|DEPT\s+OF\s+REVENUE|FRANCHISE\s+TAX|SECRETARY\s+OF\s+STATE/i, category: 'Taxes (Govt)' },

    // --- Bank / card fees ---
    { test: /External\s+transfer\s+fee/i, category: 'Bank & Card Fees' },
    { test: /\bfee\b|SERVICE\s+CHARGE|WIRE\s+FEE|MONTHLY\s+MAINT/i, category: 'Bank & Card Fees' },

    // --- Owner draws / distributions (named transfers to a person) ---
    { test: /Online\s+(Banking\s+)?transfer\s+to\s+CHK.*;\s*\S/i, category: 'Owner Draws/Distributions' },

    // --- Nameless internal transfers ---
    { test: /Online\s+(Banking\s+)?transfer\s+to\s+CHK/i, category: 'Transfers' },
    { test: /^TRANSFER\b|:\s*TRANSFER\b|\bTRANSFER\s+[A-Z]/i, category: 'Transfers' },

    // --- Other income ---
    { test: /Bank of America\s+DES:CASHREWARD|INTEREST\s+EARNED/i, category: 'Other Income' },
];

/**
 * Entity registry: maps an entity key to its category list, ruleset, and the
 * Firestore root collection its monthly statements live under.
 */
const ENTITIES = {
    restaurant: {
        key: 'restaurant',
        categories: CATEGORIES,
        rules: RULES,
        rootCollection: 'restaurants',
    },
    techmind: {
        key: 'techmind',
        categories: TECHMIND_CATEGORIES,
        rules: TECHMIND_RULES,
        rootCollection: 'entities', // entities/TechMind/bankTransactions/{month}
    },
};

/**
 * Resolve an entity config from a loose entity string. Defaults to restaurant
 * so all existing callers are unchanged.
 */
function getEntity(entityType) {
    const key = (entityType || 'restaurant').toString().trim().toLowerCase();
    return ENTITIES[key] || ENTITIES.restaurant;
}

/**
 * Apply the deterministic rules to a description for a given entity.
 * @param {string} description
 * @param {object} [entity] resolved entity config (defaults to restaurant)
 * @returns {string|null} category name, or null if no rule matched
 */
function categorizeByRules(description, entity) {
    if (!description) return null;
    const rules = (entity && entity.rules) || RULES;
    for (const rule of rules) {
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
async function categorizeByLLM(description, amount, entity) {
    const openai = getOpenAI();
    if (!openai) return 'Uncategorized';

    const ent = entity || getEntity('restaurant');
    const categories = ent.categories || CATEGORIES;
    const businessNoun = ent.key === 'techmind'
        ? 'IT consulting/software company'
        : 'restaurant';

    const sign = Number(amount) >= 0 ? 'credit (money in)' : 'debit (money out)';
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content:
                        `You categorize ${businessNoun} bank transactions. Respond with EXACTLY one ` +
                        'category from this list and nothing else:\n' + categories.join('\n'),
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
        // Accept only exact matches from this entity's list; otherwise Uncategorized.
        const match = categories.find((c) => c.toLowerCase() === raw.toLowerCase());
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
    const entity = getEntity(opts.entityType);
    const result = [];

    for (const txn of transactions) {
        const ruleCat = categorizeByRules(txn.description, entity);
        if (ruleCat) {
            result.push({ ...txn, category: ruleCat, categorySource: 'rule' });
            continue;
        }
        if (useLLM && getOpenAI()) {
            const llmCat = await categorizeByLLM(txn.description, txn.amount, entity);
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
    TECHMIND_CATEGORIES,
    RULES,
    TECHMIND_RULES,
    ENTITIES,
    getEntity,
    categorizeByRules,
    categorizeByLLM,
    categorizeTransactions,
    summarize,
};
