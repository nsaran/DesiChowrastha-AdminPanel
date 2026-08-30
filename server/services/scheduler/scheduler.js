const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');
const { executeJob } = require('./jobImplementations');

const CONFIG_PATH = path.join(__dirname, 'schedulerConfig.json');

// Store active cron jobs
const activeJobs = {};

/**
 * Load scheduler configuration from file
 */
function loadConfig() {
    try {
        const data = fs.readFileSync(CONFIG_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        logger.error(`[Scheduler] Failed to load config: ${error.message}`);
        return { jobs: [] };
    }
}

/**
 * Save scheduler configuration to file
 */
function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        logger.info('[Scheduler] Configuration saved');
    } catch (error) {
        logger.error(`[Scheduler] Failed to save config: ${error.message}`);
    }
}

/**
 * Get WhatsApp phone number ID based on location
 */
function getPhoneNumberId(location) {
    const locationKey = location.toUpperCase();
    if (locationKey === 'NASHUA') {
        return process.env.WA_PHONE_NUMBER_ID_NASHUA;
    }
    return process.env.WA_PHONE_NUMBER_ID_WESTBOROUGH || process.env.WA_PHONE_NUMBER_ID;
}

/**
 * Send WhatsApp template message to recipients
 */
async function sendWhatsAppMessage(job, templateParams) {
    const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;
    const phoneNumberId = getPhoneNumberId(job.location);
    const recipients = job.recipients.length > 0
        ? job.recipients
        : (process.env.OWNER_PHONE_NUMBER || '').split(',').map(n => n.trim()).filter(Boolean);

    if (!phoneNumberId || !WA_ACCESS_TOKEN || recipients.length === 0) {
        logger.error(`[Scheduler] WhatsApp not configured for job: ${job.id}`);
        return;
    }

    const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    for (const recipient of recipients) {
        try {
            const payload = {
                messaging_product: 'whatsapp',
                to: recipient,
                type: 'template',
                template: {
                    name: job.templateName,
                    language: { code: job.templateLanguage || process.env.WA_TEMPLATE_LANGUAGE || 'en' },
                    components: [
                        {
                            type: 'body',
                            parameters: templateParams.map(text => ({ type: 'text', text: String(text) }))
                        }
                    ]
                }
            };

            await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${WA_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            logger.info(`[Scheduler] ${job.id}: Message sent to ${recipient}`);
            // Delay between sends to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            const errorMsg = error.response?.data?.error?.message || error.message;
            logger.error(`[Scheduler] ${job.id}: Failed to send to ${recipient}: ${errorMsg}`);
        }
    }
}

/**
 * Run a specific job: execute implementation, then send WhatsApp
 */
async function runJob(job) {
    logger.info(`[Scheduler] Executing job: ${job.id} (${job.name}) for ${job.location}`);

    try {
        // Execute the job's business logic
        const templateParams = await executeJob(job.id, job);

        // A null result means the implementation already handled its own delivery
        // (e.g. sending a document/media message) and there is no text template to send.
        if (templateParams === null) {
            logger.info(`[Scheduler] Job ${job.id} handled its own delivery; skipping text send`);
            return;
        }

        if (!templateParams || !Array.isArray(templateParams)) {
            logger.error(`[Scheduler] Job ${job.id} returned invalid template params`);
            return;
        }

        // Send the result via WhatsApp
        await sendWhatsAppMessage(job, templateParams);

        logger.info(`[Scheduler] Job ${job.id} completed successfully`);
    } catch (error) {
        logger.error(`[Scheduler] Job ${job.id} failed: ${error.message}`);
    }
}

/**
 * Schedule a single job using its cron expression
 */
function scheduleJob(job) {
    if (!job.enabled) {
        logger.info(`[Scheduler] Job ${job.id} is disabled, skipping`);
        return;
    }

    if (!cron.validate(job.cronExpression)) {
        logger.error(`[Scheduler] Invalid cron expression for ${job.id}: ${job.cronExpression}`);
        return;
    }

    // Stop existing job if re-scheduling
    if (activeJobs[job.id]) {
        activeJobs[job.id].stop();
    }

    activeJobs[job.id] = cron.schedule(job.cronExpression, () => {
        runJob(job);
    }, {
        timezone: 'America/New_York'
    });

    logger.info(`[Scheduler] Scheduled: ${job.id} (${job.name}) - ${job.cronExpression} [${job.location}]`);
}

/**
 * Initialize all jobs from configuration
 */
function initializeScheduler() {
    const config = loadConfig();

    // Stop all existing jobs
    Object.values(activeJobs).forEach(job => job.stop());
    Object.keys(activeJobs).forEach(key => delete activeJobs[key]);

    // Schedule enabled jobs
    config.jobs.forEach(job => scheduleJob(job));

    logger.info(`[Scheduler] Initialized with ${config.jobs.filter(j => j.enabled).length} active jobs`);
}

/**
 * Get all jobs and their status
 */
function getJobs() {
    const config = loadConfig();
    return config.jobs.map(job => ({
        ...job,
        isRunning: !!activeJobs[job.id]
    }));
}

/**
 * Add or update a job
 */
function upsertJob(jobData) {
    const config = loadConfig();
    const existingIndex = config.jobs.findIndex(j => j.id === jobData.id);

    if (existingIndex >= 0) {
        config.jobs[existingIndex] = { ...config.jobs[existingIndex], ...jobData };
    } else {
        config.jobs.push(jobData);
    }

    saveConfig(config);

    // Re-schedule the job
    const job = config.jobs.find(j => j.id === jobData.id);
    if (job.enabled) {
        scheduleJob(job);
    } else if (activeJobs[job.id]) {
        activeJobs[job.id].stop();
        delete activeJobs[job.id];
    }

    return job;
}

/**
 * Delete a job
 */
function deleteJob(jobId) {
    const config = loadConfig();
    config.jobs = config.jobs.filter(j => j.id !== jobId);
    saveConfig(config);

    if (activeJobs[jobId]) {
        activeJobs[jobId].stop();
        delete activeJobs[jobId];
    }

    logger.info(`[Scheduler] Deleted job: ${jobId}`);
}

/**
 * Manually trigger a job (for testing)
 */
async function triggerJob(jobId) {
    const config = loadConfig();
    const job = config.jobs.find(j => j.id === jobId);

    if (!job) {
        throw new Error(`Job not found: ${jobId}`);
    }

    await runJob(job);
}

module.exports = {
    initializeScheduler,
    getJobs,
    upsertJob,
    deleteJob,
    triggerJob,
    runJob
};
