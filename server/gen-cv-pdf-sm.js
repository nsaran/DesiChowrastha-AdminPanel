// Senior Manager-targeted resume for Saravanan Natesan.
// Layout mirrors Version A (gen-cv-pdf.js); content repositioned toward
// delivery leadership. Output: Saravanan-Natesan-Resume-SM.pdf
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'Saravanan-Natesan-Resume-SM.pdf');

const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
doc.pipe(fs.createWriteStream(OUT));

let pages = 1;
doc.on('pageAdded', () => { pages += 1; });

// Palette
const INK = '#222222';
const ACCENT = '#1f6feb';
const BAND = '#eceff3';
const SIDEBAR = '#f5f6f8';

const PAGE_W = doc.page.width;
const PAGE_H = doc.page.height;
const M = 28;

const COL_GAP = 16;
const LEFT_X = M;
const LEFT_W = 180;
const RIGHT_X = LEFT_X + LEFT_W + COL_GAP;
const RIGHT_W = PAGE_W - RIGHT_X - M;

// Header
let headerBottom;
{
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(22).text('Saravanan Natesan', LEFT_X, M);
    doc.fillColor(INK).font('Helvetica').fontSize(9.5).text(
        'Senior Technology Delivery Manager | Cloud, GenAI & Enterprise Architecture',
        LEFT_X, doc.y + 1, { width: 380 }
    );

    const cy = M + 4;
    doc.fillColor(INK).font('Helvetica').fontSize(8.5);
    doc.text('Mobile: 603-892-2665', RIGHT_X, cy, { width: RIGHT_W, align: 'right' });
    doc.text('Email: saravanan.natesan@gmail.com', RIGHT_X, doc.y, { width: RIGHT_W, align: 'right' });
    // "LinkedIn:" stays plain text; only the name is the clickable link.
    // Positioned manually (right-aligned) to avoid the align + continued overlap bug.
    const LINKEDIN_URL = 'https://www.linkedin.com/in/saravanan-natesan-2643aa24/';
    const liLabel = 'LinkedIn: ';
    const liName = 'Saravanan Natesan';
    const liLabelW = doc.widthOfString(liLabel);
    const liNameW = doc.widthOfString(liName);
    const liX = RIGHT_X + RIGHT_W - liLabelW - liNameW;
    const liY = doc.y;
    doc.fillColor(INK).text(liLabel, liX, liY, { lineBreak: false });
    doc.fillColor(ACCENT).text(liName, liX + liLabelW, liY, {
        width: liNameW + 2, lineBreak: false, link: LINKEDIN_URL, underline: true,
    });
    doc.fillColor(INK);

    headerBottom = Math.max(doc.y, 80) + 8;
    doc.strokeColor('#cfd6de').lineWidth(1).moveTo(M, headerBottom).lineTo(PAGE_W - M, headerBottom).stroke();
}

const BODY_TOP = headerBottom + 12;

// Sidebar background
doc.rect(LEFT_X - 8, BODY_TOP - 6, LEFT_W + 16, PAGE_H - BODY_TOP - M + 6).fill(SIDEBAR);

function bandHeader(x, w, y, title) {
    doc.rect(x - 6, y, w + 12, 16).fill(BAND);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5).text(title, x, y + 3.5, { width: w });
    return y + 20;
}
function bulletList(x, w, y, items, size = 8, gap = 2) {
    doc.fontSize(size);
    for (const it of items) {
        doc.fillColor(ACCENT).font('Helvetica-Bold').text('\u2022', x, y, { width: 8 });
        doc.fillColor(INK).font('Helvetica').text(it, x + 10, y, { width: w - 10, lineGap: 0.6 });
        y = doc.y + gap;
    }
    return y;
}

// LEFT COLUMN
// Gap between left-column sections. Tuned so the left column ends level with
// the right column (re-tune if content changes; compare the two end values logged below).
const SECTION_GAP = 14.5;
let ly = BODY_TOP;

ly = bandHeader(LEFT_X, LEFT_W, ly, 'Leadership & Delivery');
ly = bulletList(LEFT_X, LEFT_W, ly, [
    'Accountable for successful, on-time delivery of high-quality software products',
    'Build, mentor, and lead high-performing engineering teams onshore, offshore, and remote',
    'Hiring, budgeting, resource allocation, SOW and change-order management',
    'Own technical and product roadmaps, aligning delivery to business goals',
    'Large-scale, highly available, secure services on the cloud',
    'DevSecOps tooling: secure IaC and apps with CI/CD automation',
    'Cloud migrations, performance optimization, and system tuning',
    'Hands-on full-stack engineer and results-oriented leader',
]);

ly += SECTION_GAP;
ly = bandHeader(LEFT_X, LEFT_W, ly, 'Specialization');
ly = bulletList(LEFT_X, LEFT_W, ly, [
    'Microservices, reactive and lightweight application frameworks, domain-driven design, event-driven design, API development',
    'Cloud-native, serverless, and messaging applications; mobile and web application development',
    'Migrating on-prem applications and data to cloud platforms',
    'Application integration and security; data modelling',
]);

ly += SECTION_GAP;
ly = bandHeader(LEFT_X, LEFT_W, ly, 'Skills');
ly = bulletList(LEFT_X, LEFT_W, ly, [
    'AI/GenAI: OpenAI GPT-4o (vision & text), prompt engineering, LLM extraction/classification, gpt-image-1, Amazon Bedrock',
    'AWS, Docker, Kubernetes, Azure, PCF, GCP',
    'Terraform, CloudFormation, Jenkins, Git, GitLab, UCD',
    'Jira, Confluence, ServiceNow, SonarQube',
    'Lucidchart, Visio, draw.io, Mermaid, Figma',
    'Spring/Spring Boot, Java, Python, .NET',
    'RESTful, GraphQL, WebSocket, SOA, JMS, Kafka, APIGEE, ActiveMQ, Salesforce',
    'Angular, ReactJS, Next.js, Node.js, NestJS, TypeScript, JS',
    'Postgres, Oracle, MySQL, Cassandra, MongoDB, Redis, Memcached',
    'Tomcat, Jetty, JBoss, WebLogic, WebSphere, IIS',
]);

ly += SECTION_GAP;
ly = bandHeader(LEFT_X, LEFT_W, ly, 'Education & Certifications');
ly = bulletList(LEFT_X, LEFT_W, ly, [
    'MS - Computer Applications',
    'BS - Computer Science',
]);
const AWS_CERT_URL = 'https://cp.certmetrics.com/amazon/en/public/verify/credential/6e51a08828de42f887a9d43014aaeec2';
doc.fontSize(8);
doc.fillColor(ACCENT).font('Helvetica-Bold').text('\u2022', LEFT_X, ly, { width: 8 });
doc.fillColor(ACCENT).font('Helvetica').text('AWS Certified Solution Architect - Professional', LEFT_X + 10, ly, {
    width: LEFT_W - 10, lineGap: 0.6, link: AWS_CERT_URL, underline: true,
});
ly = doc.y + 2;
const PMP_URL = 'https://www.pmi.org/certifications/certification-resources/registry';
doc.fillColor(ACCENT).font('Helvetica-Bold').text('\u2022', LEFT_X, ly, { width: 8 });
doc.fillColor(ACCENT).font('Helvetica').text('Project Management Professional (PMP)', LEFT_X + 10, ly, {
    width: LEFT_W - 10, lineGap: 0.6, link: PMP_URL, underline: true,
});
ly = doc.y + 2;
doc.fillColor(INK);

// RIGHT COLUMN
let ry = BODY_TOP;

doc.fillColor(INK).font('Helvetica').fontSize(8.3).lineGap(1).text(
    'Experienced technology leader with 20+ years at top-tier consulting firms, managing the continuous delivery of secure, '
    + 'reliable, and scalable software products on cloud and on-prem. Extensive leadership experience building high-performing, '
    + 'diverse software teams from the ground up, backed by a PMP and an MS in Computer Applications. Provides technical leadership '
    + 'and oversight for application development teams across plan, design, develop, test, deploy, and sustain, following DevSecOps, '
    + 'security, and compliance best practices. Industries: finance, telecom, banking, DHHS, HR, and IT. '
    + 'Clients include TIAA, Sanofi, Liberty Mutual, Fannie Mae, and Anthem, with work performed while employed at Accenture, Ericsson, and Deloitte.',
    RIGHT_X, ry, { width: RIGHT_W }
);
ry = doc.y + 6;

ry = bandHeader(RIGHT_X, RIGHT_W, ry, 'Relevant Experience');

function exp(title, bullets) {
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(8.6).text(title, RIGHT_X, ry, { width: RIGHT_W, lineGap: 0.4 });
    ry = doc.y + 1;
    doc.fontSize(7.9);
    for (const b of bullets) {
        doc.fillColor(ACCENT).font('Helvetica-Bold').text('\u2022', RIGHT_X, ry, { width: 8 });
        doc.fillColor(INK).font('Helvetica').text(b, RIGHT_X + 10, ry, { width: RIGHT_W - 10, lineGap: 0.4 });
        ry = doc.y + 1;
    }
    ry += 2;
}

exp('Technology Delivery Lead / Architect (Accenture) \u2014 RKT Transformation, TIAA, Charlotte, NC  [Apr 2026 \u2013 Present]', [
    'Lead a 48-person team (8 onshore, 40 offshore) as the technical North Star, setting architecture direction on the shared canonical-data-model platform for Education & Advice.',
    'Engaged with client team to gather requirements on the app and across the multiple integration endpoints it depends on; architected the Contribution Planner app and secured architecture approval.',
    'Leverage AI to create architecture artifacts and accelerate feature and user-story development; run refinement, grooming, and story pointing with dev leads and QA; mentor dev and test teams. Development delivered on schedule with full acceptance-criteria test coverage.',
]);
exp('Integration Delivery Lead / Architect (Accenture) \u2014 iCare+, Sanofi, Boston, MA  [Mar 2024 \u2013 Feb 2026]', [
    'Led a 30-person team (2 onshore, 28 offshore) delivering the iCare+ integration platform for Sanofi on time, with 10+ endpoints (Eversana, AssistRx, Experian, Merkle, InTouch, McKesson, BrightInsight).',
    'Built APIs on AWS Lambda (Python) with Salesforce as the backend via Composite API.',
    'Delivered a custom e-fax solution: near-real-time intake from Retarus, TIF-to-PDF conversion and compression, then storage in Salesforce.',
]);
exp('Technical Delivery Lead / Project Manager (Accenture) \u2014 ERM Program, Liberty Mutual, NH  [May 2021 \u2013 Mar 2024]', [
    'Led a 20-person team (16 offshore, 4 client onshore) delivering the Electronic Records Management service that adds record deletion across 100+ high-risk U.S. applications to meet regulations such as CPRA and company policy; launched and executed the Deletion Playbook.',
    'Owned budgeting, resource allocation, recruitment, performance reviews, and SOW/change-order management; ran weekly leadership meetings with client and internal teams.',
    'Coached scrum teams; facilitated sprint planning, standups, reviews, PI planning, and retrospectives.',
]);
exp('Cloud Delivery Lead / AWS Architect (Accenture) \u2014 Cloud Acceleration Program, CADS, Fannie Mae, VA  [Mar 2020 \u2013 May 2021]', [
    'Led development of the CADS application on AWS with a 16-person team; architected a serverless solution with reminders, cached lookups, search with Excel export, and document handling via the CDX platform.',
    'Secured UI/API with FNMA SSO; integrated with the FNMA Mail Hub; built the API on FNMA\u2019s Chassis framework; created a reusable Lambda framework and Angular UI standards.',
    'Delivered a tool that migrated millions of documents from the database to S3, preserving links to decision and metrics records.',
]);
exp('Cloud DevOps Lead / Architect (Accenture) \u2014 Cloud Strategy & Architecture, Anthem, Atlanta  [Sep 2019 \u2013 Mar 2020]', [
    'Led an 18-person team architecting and delivering the DevOps platform; standardized and automated CI/CD pipelines for enterprise services using Terraform and AWS managed services (Kinesis, SFTP, S3, IAM).',
]);
exp('Technical Lead / Senior Software Architect (Ericsson) \u2014 EAI (OSS/BSS) Modernization, MA, USA  [Sep 2013 \u2013 Aug 2019]', [
    'Led a 16-person team modernizing the monolithic Ericsson Adaptive Inventory product into SaaS offerings, certifying it on an open-source platform used by telecom operators worldwide.',
    'Saved customers millions of dollars in licensing fees by supporting the product on that open-source platform.',
]);
exp('Solution Architect / Technical Lead (Deloitte Consulting) \u2014 DHHS, State Government, NH  [Apr 2001 \u2013 Aug 2013]', [
    'Led a 12-person team engineering and modernizing Welfare systems for the State of New Hampshire (Cash, Food Stamps, Child Care, Medicare, and others).',
]);

doc.end();
console.log('WROTE', OUT, 'pages:', pages, 'right ended y =', Math.round(ry), 'left ended y =', Math.round(ly), 'of', PAGE_H);
