---
name: senior-manager-resume
description: Edit and regenerate the Senior Manager version of the resume PDF. Use when the user asks to change resume wording, skills, titles, or layout.
---

# Senior Manager resume

## Files
- Generator: `server/gen-cv-pdf-sm.js` (PDFKit). Output: `Saravanan-Natesan-Resume-SM.pdf` in the repo root.
- `server/gen-cv-pdf.js` is Version A (original). Do not edit it when changing the Senior Manager version.

## Layout
- One page, US Letter, two columns: sidebar on the left (Leadership & Delivery, Specialization, Skills, Education & Certifications), experience on the right.
- The target is Senior Manager roles in delivery leadership, with architecture as a strength. Role titles use the "Delivery Lead / Architect" style.

## Workflow for every edit
1. Edit `server/gen-cv-pdf-sm.js` with a targeted replacement. Read the file first.
2. Run `node gen-cv-pdf-sm.js` from `server/`.
3. Read the logged end positions. Both columns must end inside the bottom margin (about 764 of 792) and the page count must stay at 1.
4. If the right column overflows, tighten wording or the gap between roles. Do not remove content the user asked for without telling them.
5. The left-column section gap is the constant `SECTION_GAP`. It is tuned so both columns end level. Re-tune it after content changes.
6. Report what changed and the two end positions.

## Details to preserve
- The LinkedIn line: "LinkedIn:" is plain text, and only the name is the clickable link. It is placed manually because right-aligned text with a link causes an overlap bug in PDFKit. A link needs an explicit text width or PDFKit throws a NaN error.
- The AWS and PMP certification entries are clickable links.
