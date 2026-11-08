// One-off (kept during edits): one-page two-column resume for Saravanan
// Natesan (Version A), mirroring the attached layout.
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'Saravanan-Natesan-Resume.pdf');

const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
doc.pipe(fs.createWriteStream(OUT));

// ── Palette ──
const INK = '#222222';
const MUTED = '#666666';
const ACCENT = '#1f6feb';     // header name / links
const BAND = '#eceff3';       // section header band
const SIDEBAR = '#f5f6f8';    // left column background

const PAGE_W = doc.page.width;   // 612
const PAGE_H = doc.page.height;  // 792
const M = 28;                    // outer margin

// Columns
const COL_GAP = 16;
const LEFT_X = M;
const LEFT_W = 196;
const RIGHT_X = LEFT_X + LEFT_W + COL_GAP;
const RIGHT_W = PAGE_W - RIGHT_X - M;

// ── Header ──
let headerBottom;
{
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(22).text('Saravanan Natesan', LEFT_X, M);
    doc.fillColor(INK).font('Helvetica').fontSize(11).text('Principal Cloud & GenAI Solutions Architect', LEFT_X, doc.y + 1);

    // Contact line on the right of the header
    const cy = M + 4;
    doc.fillColor(INK).font('Helvetica').fontSize(8.5);
    const LINKEDIN_URL = 'https://www.linkedin.com/in/saravanan-natesan-2643aa24/';
    doc.text('Mobile: 603-892-2665', RIGHT_X, cy, { width: RIGHT_W, align: 'right' });
    doc.text('Email: saravanan.natesan@gmail.com', RIGHT_X, doc.y, { width: RIGHT_W, align: 'right' });
    // LinkedIn line as a single right-aligned clickable link (avoids the
    // right-align + continued overlap bug). The whole label+name is the link.
    doc.fillColor(ACCENT).text('LinkedIn: Saravanan Natesan', RIGHT_X, doc.y, {
        width: RIGHT_W, align: 'right', link: LINKEDIN_URL, underline: true,
    });
    doc.fillColor(INK);

    headerBottom = Math.max(doc.y, 92) + 8;
    doc.strokeColor('#cfd6de').lineWidth(1).moveTo(M, headerBottom).lineTo(PAGE_W - M, headerBottom).stroke();
}

const BODY_TOP = headerBottom + 12;

// ── Sidebar background ──
doc.rect(LEFT_X - 8, BODY_TOP - 6, LEFT_W + 16, PAGE_H - BODY_TOP - M + 6).fill(SIDEBAR);

// Section header band helper (scoped to a column).
function bandHeader(x, w, y, title) {
    doc.rect(x - 6, y, w + 12, 16).fill(BAND);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5).text(title, x, y + 3.5, { width: w });
    return y + 20;
}
function bulletList(x, w, y, items, size = 8.3, gap = 2) {
    doc.fontSize(size);
    for (const it of items) {
        doc.fillColor(ACCENT).font('Helvetica-Bold').text('\u2022', x, y, { width: 8 });
        doc.fillColor(INK).font('Helvetica').text(it, x + 10, y, { width: w - 10, lineGap: 0.8 });
        y = doc.y + gap;
    }
    return y;
}

// ══════════════ LEFT COLUMN ══════════════
let ly = BODY_TOP;

ly = bandHeader(LEFT_X, LEFT_W, ly, 'Skills');
ly = bulletList(LEFT_X, LEFT_W, ly, [
    'AI/GenAI: OpenAI GPT-4o (vision & text), prompt engineering, LLM extraction/classification, gpt-image-1, Amazon Bedrock',
    'AWS, Docker, Kubernetes, Azure, PCF, GCP',
    'Terraform, CloudFormation, Jenkins, Git, UCD',
    'Spring/Spring Boot, Java, Python, .NET',
    'RESTful, GraphQL, WebSocket, SOA, RMI, JMS, RPC, JSF',
    'Angular, ReactJS, Node.js, TypeScript, JS, GWT, jQry',
    'Tomcat, Jetty, JBoss, WebLogic, WebSphere',
    'Postgres, Oracle, MySQL, Cassandra, MongoDB',
    'Salesforce, Kafka, APIGEE, Memcached, ActiveMQ',
]);

ly += 8;
ly = bandHeader(LEFT_X, LEFT_W, ly, 'Background');
ly = bulletList(LEFT_X, LEFT_W, ly, [
    '20+ years of technology leadership in architecture, project management, and building highly scalable enterprise applications, collaborating with global teams in agile environments.',
    'Specialization includes Microservices, Containerization, Cloud-Native Applications, Cloud Infrastructure Development, Automation, DevOps, Product Development, Domain-driven Design, Event-driven Design, and Application Development.',
]);

ly += 8;
ly = bandHeader(LEFT_X, LEFT_W, ly, 'Education & Certifications');
ly = bulletList(LEFT_X, LEFT_W, ly, [
    'MS - Computer Applications',
    'BS - Computer Science',
]);
// AWS cert as its own bullet with a clickable verification link.
const AWS_CERT_URL = 'https://cp.certmetrics.com/amazon/en/public/verify/credential/6e51a08828de42f887a9d43014aaeec2';
doc.fontSize(8.3);
doc.fillColor(ACCENT).font('Helvetica-Bold').text('\u2022', LEFT_X, ly, { width: 8 });
doc.fillColor(ACCENT).font('Helvetica').text('AWS Certified Solution Architect - Professional', LEFT_X + 10, ly, {
    width: LEFT_W - 10, lineGap: 0.8, link: AWS_CERT_URL, underline: true,
});
ly = doc.y + 2;
doc.fillColor(INK);
// PMP cert as its own bullet with a clickable PMI registry link.
const PMP_URL = 'https://www.pmi.org/certifications/certification-resources/registry';
doc.fontSize(8.3);
doc.fillColor(ACCENT).font('Helvetica-Bold').text('\u2022', LEFT_X, ly, { width: 8 });
doc.fillColor(ACCENT).font('Helvetica').text('Project Management Professional (PMP)', LEFT_X + 10, ly, {
    width: LEFT_W - 10, lineGap: 0.8, link: PMP_URL, underline: true,
});
ly = doc.y + 2;
doc.fillColor(INK);

// ══════════════ RIGHT COLUMN ══════════════
let ry = BODY_TOP;

// Summary
doc.fillColor(INK).font('Helvetica').fontSize(8.6).lineGap(1.2).text(
    'A senior technology strategist and practitioner with decades of experience delivering enterprise technology '
    + 'programs across Finance, Telecom, Banking, DHHS, Human Resources, and IT for marquee clients including TIAA, Sanofi, '
    + 'Liberty Mutual, Fannie Mae, Anthem, FHL Bank, State Government, Ericsson, Accenture, and Deloitte.',
    RIGHT_X, ry, { width: RIGHT_W }
);
ry = doc.y + 8;

ry = bandHeader(RIGHT_X, RIGHT_W, ry, 'Relevant Experience');

// Experience entry: bold title line, then bullets.
function exp(title, bullets) {
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(9).text(title, RIGHT_X, ry, { width: RIGHT_W, lineGap: 0.5 });
    ry = doc.y + 1.5;
    doc.fontSize(8.3);
    for (const b of bullets) {
        doc.fillColor(ACCENT).font('Helvetica-Bold').text('\u2022', RIGHT_X, ry, { width: 8 });
        doc.fillColor(INK).font('Helvetica').text(b, RIGHT_X + 10, ry, { width: RIGHT_W - 10, lineGap: 0.6 });
        ry = doc.y + 1.5;
    }
    ry += 3;
}

exp('Technology Architect (Accenture) \u2014 RKT Transformation, TIAA, Charlotte, NC  [Apr 2026 \u2013 Present]', [
    'Design and deliver technology architecture for a platform, product, or engagement.',
    'Define solutions to meet performance, capability, and scalability needs; serve as SME, collaborating with and managing the team to perform effectively.',
]);
exp('Integration Architect (Accenture) \u2014 iCare+, Sanofi, Boston  [Mar 2024 \u2013 Feb 2026]', [
    'Architected and designed the API platform for the iCare+ service on AWS.',
    'Managed onshore and offshore teams; coached scrum teams and facilitated Agile ceremonies (sprint planning, standups, reviews, PI planning, retrospectives).',
]);
exp('Technical Project Manager (Accenture) \u2014 ERM Program, Liberty Mutual, NH  [May 2021 \u2013 May 2023]', [
    'Delivered, on time, the GRS sidecar service enforcing alignment with Liberty Mutual\u2019s record retention schedule.',
    'Led onshore/offshore teams and facilitated the full set of Agile ceremonies.',
]);
exp('AWS Lead (Accenture) \u2014 Cloud Acceleration Program, Fannie Mae, VA  [Mar 2020 \u2013 May 2021]', [
    'Delivered cloud migration/modernization programs for Multi-Family projects on time.',
    'Re-platformed, refactored, re-architected, and containerized on-prem web apps using AWS managed services; transformed legacy online/batch apps into cloud-native serverless applications.',
]);
exp('Sr. Cloud Architect (Accenture) \u2014 Cloud Strategy & Architecture, Anthem, Atlanta  [Sep 2019 \u2013 Mar 2020]', [
    'Architected and delivered the DevOps platform within Anthem\u2019s Cloud Strategy & Architecture program.',
    'Standardized and automated CI/CD pipelines for enterprise services (FTP, user accounts) with Terraform and AWS managed services (Kinesis, SFTP, S3, IAM).',
]);
exp('Sr. Software Architect (Ericsson) \u2014 EAI (OSS/BSS) Modernization, North America  [Sep 2013 \u2013 Aug 2019]', [
    'Modernized the legacy monolithic EAI (Ericsson Adaptive Inventory) product into SaaS market offerings; led initiatives to build and enhance features.',
    'Enabled clients to save millions in licensing fees by complementing JEE products with an open-source stack.',
]);
exp('Solution Architect (Deloitte Consulting) \u2014 DHHS, State Government, USA  [Apr 2001 \u2013 Aug 2013]', [
    'Engineered and modernized Welfare systems for the State of New Hampshire delivering state-sponsored programs (Cash, Food Stamps, Child Care, Medicare and others).',
]);

doc.end();
console.log('WROTE', OUT);
