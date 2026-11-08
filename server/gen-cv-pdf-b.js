// One-off (kept during edits): my own one-page resume design for Saravanan
// Natesan (Version B), single-column with a dark header band.
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'Saravanan-Natesan-Resume-B.pdf');

const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
doc.pipe(fs.createWriteStream(OUT));

const PAGE_W = doc.page.width;
const PAGE_H = doc.page.height;
const M = 44;
const CW = PAGE_W - M * 2; // content width

const DARK = '#12303f';   // header band
const ACCENT = '#1f8a70'; // teal accent
const INK = '#20262b';
const MUTED = '#5b6672';
const LINE = '#d9dee3';

// ── Header band ──
const HEADER_H = 96;
doc.rect(0, 0, PAGE_W, HEADER_H).fill(DARK);
doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24).text('SARAVANAN NATESAN', M, 24, { characterSpacing: 1 });
doc.fillColor('#bfe9dd').font('Helvetica').fontSize(11.5)
    .text('Principal Cloud & GenAI Solutions Architect', M, 54);
const LINKEDIN_URL = 'https://www.linkedin.com/in/saravanan-natesan-2643aa24/';
doc.fillColor('#d7e4ea').font('Helvetica').fontSize(8.6)
    .text('Mobile: 603-892-2665   |   Email: saravanan.natesan@gmail.com   |   LinkedIn: ', M, 74, { continued: true })
    .fillColor('#9fd8ff').text('Saravanan Natesan', { link: LINKEDIN_URL, underline: true });
doc.fillColor('#d7e4ea');

let y = HEADER_H + 18;

function heading(title) {
    doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(10.5).text(title.toUpperCase(), M, y, { characterSpacing: 1 });
    y = doc.y + 2;
    doc.strokeColor(ACCENT).lineWidth(1.4).moveTo(M, y).lineTo(M + 26, y).stroke();        // short accent underline
    doc.strokeColor(LINE).lineWidth(0.6).moveTo(M + 26, y).lineTo(M + CW, y).stroke();
    y += 7;
}

// ── Summary ──
heading('Summary');
doc.fillColor(INK).font('Helvetica').fontSize(8.8).lineGap(1.2).text(
    'Technology architect with 20+ years delivering enterprise solutions across Healthcare, Public Sector, Insurance, '
    + 'Telecom, Banking, and Manufacturing. Expert in cloud-native architecture, monolith-to-cloud migration, application '
    + 'modernization, SOA governance, enterprise integration, and full-stack engineering\u2014from cloud adoption strategy and '
    + 'architecture roadmaps through hands-on delivery\u2014while leading onshore and offshore teams.',
    M, y, { width: CW }
);
y = doc.y + 9;

// ── Core Skills (grid) ──
heading('Core Skills');
const skills = [
    ['AI / GenAI', 'OpenAI GPT-4o (vision & text), prompt engineering, LLM document extraction & classification, image generation (gpt-image-1), Amazon Bedrock, GitHub Copilot'],
    ['Cloud / DevOps', 'AWS, Azure, GCP, OpenShift, Docker, Kubernetes, Terraform, CloudFormation, Jenkins, CI/CD'],
    ['Languages', 'Java/JEE, .NET, Node.js, JavaScript/TypeScript, Python, COBOL/CICS, SQL'],
    ['Web / UI', 'Angular, ReactJS, GWT, JSF/JSP, HTML5, CSS3, jQuery'],
    ['Integration', 'REST, GraphQL, SOA, Microservices, EJB, RMI, WebSocket, Kafka, ActiveMQ, APIGEE, OAuth/OpenID, KeyCloak'],
    ['Data', 'Oracle, Postgres, DB2, SQL Server, MySQL, MongoDB, Cassandra, HBase, Elasticsearch'],
    ['Servers', 'JBoss, WebLogic, WebSphere, Tomcat, Jetty, IIS, Apache, Undertow'],
];
doc.fontSize(8.5);
for (const [k, v] of skills) {
    const ry = y;
    doc.fillColor(ACCENT).font('Helvetica-Bold').text(k, M, ry, { width: 92 });
    doc.fillColor(INK).font('Helvetica').text(v, M + 100, ry, { width: CW - 100, lineGap: 0.5 });
    y = Math.max(doc.y, ry) + 3;
}
y += 5;

// ── Experience ──
heading('Professional Experience');
function exp(role, org, dates, text) {
    const ry = y;
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(9).text(role, M, ry, { width: CW - 118 });
    doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(dates, M + CW - 118, ry, { width: 118, align: 'right' });
    doc.fillColor(ACCENT).font('Helvetica-Oblique').fontSize(8.2).text(org, M, doc.y + 0.5, { width: CW });
    doc.fillColor('#333333').font('Helvetica').fontSize(8.3).text(text, M, doc.y + 1.5, { width: CW, lineGap: 0.6 });
    y = doc.y + 4.5;
}

exp('Technology Architect', 'Accenture \u2014 TIAA, RKT-Transformation', '2026 \u2013 2027',
    'Design and deliver technology architecture for platform/product engagements; define solutions for performance, capability, and scalability. Serve as SME across teams, drive key decisions, and mentor engineers on Java full-stack delivery.');
exp('Integration Architect', 'Accenture \u2014 Sanofi, Dupixent Health Cloud', '2024 \u2013 2026',
    'Designed and built integration solutions on Amazon API Gateway and AWS Step Functions with source-to-target mapping; developed integrations in Python and provisioned infrastructure via Terraform; guided the offshore team through delivery.');
exp('Application Architect', 'Accenture \u2014 Kemper Insurance, App Modernization & Cloud Roadmap', '2022 \u2013 2023',
    'Reviewed and re-architected applications for AWS migration and produced the cloud adoption roadmap and best-practice guidelines.');
exp('Scrum Master / Technical Lead', 'Accenture \u2014 Liberty Mutual, AO Renewals', '2022 \u2013 2023',
    'Led microservices and API development on AWS Lambda and CDK; facilitated Agile ceremonies and progress metrics across onshore/offshore teams, balancing technical and managerial responsibilities.');
exp('Application Architect', 'Accenture \u2014 Fannie Mae, Journey to Cloud', '2020 \u2013 2022',
    'Architected, deployed, and supported production microservices (Java, Spring Boot, REST) on AWS (Lambda, S3, Kinesis, ECS, RDS); built Angular/React front ends with Selenium/Cucumber/ATDD automated testing.');
exp('Sr. Cloud Architect', 'Accenture \u2014 Anthem, Cloud Strategy & Architecture', '2019 \u2013 2020',
    'Architected and delivered the DevOps platform within Anthem\u2019s Cloud Strategy & Architecture program; standardized and automated CI/CD pipelines for enterprise services (FTP, user accounts) using Terraform and AWS managed services (Kinesis, SFTP, S3, IAM).');
exp('Technology Architect', 'Ericsson \u2014 Telecom OSS/BSS', '2013 \u2013 2019',
    'Re-architected monolithic JEE products into microservices with CI/CD; enabled REST/SSO/multi-tenant SaaS on AWS and certification on RedHat/JBoss EAP; integrated Google Maps and ESRI ArcGIS and delivered major new features.');
exp('Application Architect', 'Deloitte \u2014 Health & Human Services', '2001 \u2013 2013',
    'Modernized legacy/client-server welfare systems into J2EE web applications; introduced SOA and a Document Management System; led development of large-scale welfare programs (Cash, Food Stamps, Child Care, Medicare and others).');

y += 4;

// ── Education & Certifications (two columns) ──
heading('Education & Certifications');
const cy = y;
doc.fillColor(INK).font('Helvetica-Bold').fontSize(8.6).text('Education', M, cy);
doc.fillColor('#333333').font('Helvetica').fontSize(8.4)
    .text('M.S., Computer Application', M, doc.y + 1, { width: CW / 2 - 12 })
    .text('B.S., Computer Science', M, doc.y, { width: CW / 2 - 12 });

const cx = M + CW / 2 + 12;
doc.fillColor(INK).font('Helvetica-Bold').fontSize(8.6).text('Certifications', cx, cy);
const AWS_CERT_URL = 'https://cp.certmetrics.com/amazon/en/public/verify/credential/6e51a08828de42f887a9d43014aaeec2';
doc.fillColor(ACCENT).font('Helvetica').fontSize(8.4)
    .text('AWS Certified Solutions Architect \u2013 Professional', cx, doc.y + 1, { width: CW / 2 - 12, link: AWS_CERT_URL, underline: true });
const PMP_URL = 'https://www.pmi.org/certifications/certification-resources/registry';
doc.fillColor(ACCENT)
    .text('PMP \u2013 PMI', cx, doc.y, { width: CW / 2 - 12, link: PMP_URL, underline: true, continued: true })
    .fillColor('#333333').text('   \u00b7   ITIL v3 Foundation', { link: null, underline: false });
doc.fillColor('#333333');

doc.end();
console.log('WROTE', OUT);
