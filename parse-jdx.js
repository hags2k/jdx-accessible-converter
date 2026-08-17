#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const cheerio = require("cheerio");
const { version } = require("./package.json");

async function main() {
  let exitCode = 0;

  try {
    // Handle --version flag
    if (process.argv.includes("--version") || process.argv.includes("-v")) {
      console.log(`JDXpert Accessible HTML Converter v${version}`);
      return;
    }

    const rawArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
    const inputPaths = collectInputFiles(rawArgs);

    if (!inputPaths.length) {
      throw new Error(
        "No valid input file was provided.\n\n" +
        "Drag one or more JDX HTML files or a folder onto JDX-Accessible-Converter.exe."
      );
    }

    const batchMode = inputPaths.length > 1;

    for (const inputPath of inputPaths) {
      const outputPath = batchMode
        ? defaultBatchOutputPath(inputPath)
        : defaultOutputPath(inputPath);

      const source = fs.readFileSync(inputPath, "utf8");
      const model = parseJdx(source);
      const output = renderAccessibleHtml(model);
      const warnings = audit(model);

      assertSafeOutputPath(inputPath, outputPath);
      fs.writeFileSync(outputPath, output, "utf8");

      console.log("");
      console.log(`✓ ${path.basename(inputPath)} → ${path.basename(outputPath)}`);
      console.log("");

      console.log(
        `  Working title: ${model.workingTitle || "(not found)"}`
      );
      console.log(
        `  Classification: ${model.classificationTitle || "(not found)"}`
      );

      if (warnings.length) {
        console.log("");
        console.warn(
          `The file was created with ${warnings.length} warning(s):`
        );

        for (const warning of warnings) {
          console.warn(`- ${warning}`);
        }

        console.log("");
        console.log(
          "Review the converted file to confirm that the expected content is present."
        );
      } else {
        console.log("");
        console.log("No conversion warnings were found.");
      }
    }

    if (batchMode) {
      console.log("");
      console.log(
        `Processed ${inputPaths.length} files.`
      );
      console.log(
        'Converted files were saved in "accessible-output" folders beside their source files.'
      );
    }
  } catch (error) {
    exitCode = 1;

    console.error("");
    console.error("The file could not be converted.");
    console.error("");
    console.error(error.message);

    /*
     * This provides more technical detail during development,
     * but does not overwhelm colleagues with a full stack trace.
     */
    if (process.argv.includes("--debug") && error.stack) {
      console.error("");
      console.error(error.stack);
    }
  } finally {
    await pauseBeforeExit();
    process.exitCode = exitCode;
  }
}

async function pauseBeforeExit() {
  /*
   * When launched from File Explorer, pause so the user can read
   * the result. If the program is used in an automated process with
   * redirected input, stdin will generally not be interactive and
   * the pause will be skipped.
   *
   * The --no-pause option also allows an advanced user or automated
   * process to explicitly suppress the prompt.
   */
  const shouldPause =
    process.platform === "win32" &&
    process.stdin.isTTY &&
    !process.argv.includes("--no-pause");

  if (!shouldPause) {
    return;
  }

  const prompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    console.log("");
    await prompt.question("Press Enter to close this window...");
  } finally {
    prompt.close();
  }
}

main().catch((error) => {
  console.error("");
  console.error("An unexpected application error occurred.");
  console.error(error);
  process.exitCode = 1;
});

function assertSafeOutputPath(inputPath, outputPath) {
  const input = path.resolve(inputPath).toLowerCase();
  const output = path.resolve(outputPath).toLowerCase();

  if (input === output) {
    throw new Error(
      "The output path matches the input path. " +
      "Conversion was stopped to prevent overwriting the source file."
    );
  }

  if (!output.toLowerCase().endsWith(".accessible.html")) {
    throw new Error(
      "The generated output filename does not end in .accessible.html. " +
      "Conversion was stopped to protect the source file."
    );
  }
}

function collectInputFiles(inputPaths) {
  const files = [];

  for (const inputPath of inputPaths) {
    if (!inputPath) continue;

    if (!fs.existsSync(inputPath)) {
      console.warn(`Skipping missing path: ${inputPath}`);
      continue;
    }

    const stat = fs.statSync(inputPath);

    if (stat.isDirectory()) {
      const entries = fs.readdirSync(inputPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isFile()) continue;

        const fullPath = path.join(inputPath, entry.name);
        const extension = path.extname(entry.name).toLowerCase();

        if (extension === ".html" || extension === ".htm") {
          files.push(fullPath);
        }
      }

      continue;
    }

    const extension = path.extname(inputPath).toLowerCase();

    if (extension === ".html" || extension === ".htm") {
      files.push(inputPath);
    }
  }

  return files;
}

function defaultOutputPath(file) {
  if (!file) return "accessible-job-description.html";
  const parsed = path.parse(file);
  return path.join(parsed.dir, `${parsed.name}.accessible.html`);
}

function defaultBatchOutputPath(file) {
  const parsed = path.parse(file);
  const batchDir = path.join(parsed.dir, "accessible-output");

  if (!fs.existsSync(batchDir)) {
    fs.mkdirSync(batchDir, { recursive: true });
  }

  return path.join(batchDir, `${parsed.name}.accessible.html`);
}

function clean(value = "") {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function rowCells($, row) {
  return $(row).children("th, td").map((_, cell) => clean($(cell).text())).get();
}

function normalizeHeading(value = "") {
  return clean(value).replace(/:$/, "").toUpperCase();
}

function parseJdx(html) {
  const $ = cheerio.load(html);
  const root = $("#TD_JDHtml").first().length ? $("#TD_JDHtml").first() : $("body");
  const rows = root.find("tr").toArray().map(row => rowCells($, row));
  const compactRows = rows.map(cells => cells.filter(Boolean));

  const model = {
    workingTitle: "",
    classificationTitle: "",
    positionInfo: [],
    summary: "",
    responsibilities: [],
    qualifications: [],
    preferredQualifications: [],
    knowledgeSkillsAbilities: [],
    physicalDemands: [],
    workingConditions: [],
    uiucPhysicalDemandsWorkingConditions: "",
    uiucWorkScheduleExpectations: "",
    managerApproval: []
  };

  const positionLabels = new Set([
    "System Job Code:", "Title:", "Classification Title:", "University:",
    "Job Location:", "Job Location or Region:", "Reports To Position:",
    "Position Number:", "Position Class Code:", "Organization Code:",
    "College/Administrative Unit:", "Organization Name:",
    "Employee Group:", "Employee Class:"
  ]);

  for (const cells of rows) {
    if (positionLabels.has(cells[0]) && cells[1]) {
      const label = cells[0].replace(/:$/, "");
      model.positionInfo.push([label, cells[1]]);
      if (label === "Title") model.workingTitle = cells[1];
      if (label === "Classification Title") model.classificationTitle = cells[1];
    }
  }

  // UIUC uses Title as the primary display title. UIC samples may not contain it.
  if (!model.workingTitle) {
    model.workingTitle = model.classificationTitle.replace(/^\s*\d+\s*-\s*/, "") ||
      clean($("#ddJDName option:selected").text()).replace(/\s+-\s+[^-]+$/, "") ||
      "Job Description";
  }

  const summaryIndex = findHeadingIndex(compactRows, [
    "BRIEF JOB SUMMARY", "POSITION SUMMARY", "JOB SUMMARY",
    "PRIMARY POSITION FUNCTION/SUMMARY"
  ]);
  model.summary = firstContentAfter(compactRows, summaryIndex);

  model.responsibilities =
    extractResponsibilitiesFromSection(rows);

  // Preserve the previous document-wide behavior as a fallback
  // when a recognizable duties section is not found or contains
  // no matching responsibility rows.
  if (!model.responsibilities.length) {
    if (process.argv.includes("--debug")) {
      console.warn(
        "No responsibilities were found within a recognized duties section. Using document-wide fallback."
      );
    }

    model.responsibilities =
      extractResponsibilitiesFromAllRows(rows);
  }

  // UIUC qualifications use label/value rows.
  extractLabeledValue(rows, "Minimum Qualifications", model.qualifications);
  extractLabeledValue(rows, "Specialty Factors", model.qualifications);
  extractLabeledValue(
    rows,
    "Preferred Qualifications",
    model.preferredQualifications
  );

  // UIC qualifications may use standalone sections spanning multiple rows.
  // Only use this fallback when the label/value extraction found nothing.
  if (!model.qualifications.length) {
    model.qualifications = extractSectionRows(
      compactRows,
      [
        "MINIMUM QUALIFICATIONS",
        "MINIMUM ACCEPTABLE QUALIFICATIONS"
      ],
      [
        "SPECIALTY FACTORS",
        "PREFERRED QUALIFICATIONS",
        "KNOWLEDGE, SKILLS AND ABILITIES",
        "PHYSICAL DEMANDS",
        "PHYSICAL DEMANDS/WORKING CONDITIONS",
        "WORKING ENVIRONMENT",
        "MANAGER APPROVAL"
      ]
    );
  }

  if (!model.preferredQualifications.length) {
    model.preferredQualifications = extractSectionRows(
      compactRows,
      [
        "PREFERRED QUALIFICATIONS"
      ],
      [
        "KNOWLEDGE, SKILLS AND ABILITIES",
        "PHYSICAL DEMANDS",
        "PHYSICAL DEMANDS/WORKING CONDITIONS",
        "WORKING ENVIRONMENT",
        "MANAGER APPROVAL"
      ]
    );
  }


  model.knowledgeSkillsAbilities = extractSectionRows(compactRows,
    ["KNOWLEDGE, SKILLS AND ABILITIES"],
    ["PHYSICAL DEMANDS/WORKING CONDITIONS", "PHYSICAL DEMANDS", "WORKING ENVIRONMENT", "MANAGER APPROVAL"],
    new Set(["KSAS"]));

  model.physicalDemands = extractFrequencyTable(rows, "Physical Demand");
  model.workingConditions = extractFrequencyTable(rows, "Working Condition");

  // UIUC uses label/value rows rather than the UIC frequency matrices.
  // Keep these values separate so the two campus formats do not interfere.
  model.uiucPhysicalDemandsWorkingConditions = getLabeledValue(
    rows,
    "Physical Demands/Working Conditions"
  );

  model.uiucWorkScheduleExpectations = getLabeledValue(
    rows,
    "Work Schedule, Travel, or Other Job Expectations"
  );

  const approvalLabels = new Set([
    "Manager Name", "Manager Approver", "Date Approved", "Date Approved/Finalized"
  ]);
  for (const cells of rows) {
    const label = (cells[0] || "").replace(/:$/, "");
    if (approvalLabels.has(label) && cells[1]) model.managerApproval.push([label, cells[1]]);
  }

  return model;
}

function findHeadingIndex(rows, headings) {
  const wanted = new Set(headings.map(normalizeHeading));
  return rows.findIndex(cells => wanted.has(normalizeHeading(cells[0])));
}

function firstContentAfter(rows, index) {
  if (index < 0) return "";
  for (let i = index + 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    if (looksLikeHeading(rows[i][0])) return "";
    return rows[i][0];
  }
  return "";
}

function looksLikeHeading(value) {
  const heading = normalizeHeading(value);
  return [
    "DUTIES AND RESPONSIBILITIES", "QUALIFICATIONS", "MINIMUM QUALIFICATIONS",
    "PREFERRED QUALIFICATIONS", "KNOWLEDGE, SKILLS AND ABILITIES",
    "PHYSICAL DEMANDS", "PHYSICAL DEMANDS/WORKING CONDITIONS",
    "WORKING ENVIRONMENT", "OSHA CATEGORIES", "EQUIPMENT AND TOOLS",
    "MANAGER APPROVAL"
  ].some(item => heading.includes(item));
}

function extractResponsibilitiesFromSection(rows) {
  const startHeadings = new Set([
    "DUTIES AND RESPONSIBILITIES",
    "DUTIES & RESPONSIBILITIES",
    "JOB DUTIES AND RESPONSIBILITIES",
    "ESSENTIAL DUTIES AND RESPONSIBILITIES",
    "ESSENTIAL FUNCTIONS"
  ]);

  let active = false;
  const responsibilities = [];

  for (const cells of rows) {
    /*
     * Most JDX heading rows use the first cell, but finding the
     * first nonempty cell makes this a little more tolerant of
     * empty formatting cells before the heading.
     */
    const firstContent = cells.find(Boolean) || "";
    const heading = normalizeHeading(firstContent);

    if (!active && startHeadings.has(heading)) {
      active = true;
      continue;
    }

    /*
     * Once the duties section has started, stop when another
     * recognized major heading is encountered.
     */
    if (active && looksLikeHeading(firstContent)) {
      break;
    }

    if (!active) {
      continue;
    }

    const responsibility = parseResponsibilityRow(cells);

    if (responsibility) {
      responsibilities.push(responsibility);
    }
  }

  return responsibilities;
}

function extractResponsibilitiesFromAllRows(rows) {
  const responsibilities = [];

  for (const cells of rows) {
    const responsibility = parseResponsibilityRow(cells);

    if (responsibility) {
      responsibilities.push(responsibility);
    }
  }

  return responsibilities;
}

function parseResponsibilityRow(cells) {
  const marker = cells[0] || "";
  const text = cells[1] || "";

  if ((marker !== "•" && marker !== "-") || !text) {
    return null;
  }

  return {
    text,
    percent: /^\d+(?:\.\d+)?%$/.test(cells[2] || "")
      ? cells[2]
      : ""
  };
}

function extractLabeledValue(rows, wantedLabel, target) {
  for (const cells of rows) {
    const label = (cells[0] || "").replace(/:$/, "");
    if (label !== wantedLabel || !cells[1]) continue;
    const value = cells[1];
    // Preserve separate source paragraphs if possible; a flattened value remains one item.
    const items = value.split(/\s+•\s+/).map(item => item.replace(/^•\s*/, "").trim()).filter(Boolean);
    target.push(...items);
  }
}

function getLabeledValue(rows, wantedLabel) {
  const normalizedWantedLabel = normalizeHeading(wantedLabel);

  for (const cells of rows) {
    const label = normalizeHeading(cells[0]);

    if (label === normalizedWantedLabel && cells[1]) {
      return cells[1];
    }
  }

  return "";
}

function extractSectionRows(rows, starts, stops, ignored = new Set()) {
  const startNames = new Set(starts.map(normalizeHeading));
  const stopNames = stops.map(normalizeHeading);
  let active = false;
  const results = [];
  for (const cells of rows) {
    const first = normalizeHeading(cells[0]);
    if (startNames.has(first)) { active = true; continue; }
    if (active && stopNames.some(stop => first.includes(stop))) break;
    if (!active || !cells[0] || ignored.has(first)) continue;
    results.push(cells.join(" "));
  }
  return results;
}

function extractFrequencyTable(rows, headerName) {
  const start = rows.findIndex(cells => cells[0] === headerName);
  if (start < 0) return [];
  const headers = rows[start].slice(1);
  const results = [];
  for (let i = start + 1; i < rows.length; i++) {
    const cells = rows[i];
    if (!cells[0] || cells.length < headers.length + 1) break;
    const selected = cells.slice(1).findIndex(value => value.toUpperCase() === "X");
    if (selected >= 0) results.push([cells[0], headers[selected]]);
  }
  return results;
}

function escapeHtml(value = "") {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
}

function renderList(items) {
  if (!items.length) return "";
  return `<ul>\n${items.map(item => `        <li>${escapeHtml(item)}</li>`).join("\n")}\n      </ul>`;
}

function renderFrequencyTable(caption, rows) {
  if (!rows.length) return "";
  return `<table>
        <caption>${escapeHtml(caption)}</caption>
        <thead><tr><th scope="col">Item</th><th scope="col">Frequency</th></tr></thead>
        <tbody>
${rows.map(([item, frequency]) => `          <tr><th scope="row">${escapeHtml(item)}</th><td>${escapeHtml(frequency)}</td></tr>`).join("\n")}
        </tbody>
      </table>`;
}

function renderUiucPhysicalDemands(job) {
  const items = [];

  if (job.uiucPhysicalDemandsWorkingConditions) {
    items.push([
      "Physical Demands/Working Conditions",
      job.uiucPhysicalDemandsWorkingConditions
    ]);
  }

  if (job.uiucWorkScheduleExpectations) {
    items.push([
      "Work Schedule, Travel, or Other Job Expectations",
      job.uiucWorkScheduleExpectations
    ]);
  }

  if (!items.length) {
    return "";
  }

  return `<dl>
${items
      .map(
        ([label, value]) =>
          `        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(value)}</dd>`
      )
      .join("\n")}
      </dl>`;
}

function section(title, body) {
  if (!body) return "";
  const id = slug(title);
  return `    <section aria-labelledby="${id}">\n      <h2 id="${id}">${escapeHtml(title)}</h2>\n      ${body}\n    </section>`;
}

function renderAccessibleHtml(job) {
  const info = job.positionInfo.length ? `<dl>\n${job.positionInfo.map(([key, value]) => `        <dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join("\n")}\n      </dl>` : "";
  const duties = job.responsibilities.length ? `<ul>\n${job.responsibilities.map(item => `        <li>${escapeHtml(item.text)}${item.percent ? ` <span class="duty-percent">(${escapeHtml(item.percent)} of time)</span>` : ""}</li>`).join("\n")}\n      </ul>` : "";
  const approval = job.managerApproval.length ? `<dl>\n${job.managerApproval.map(([key, value]) => `        <dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`).join("\n")}\n      </dl>` : "";
  const classification = job.classificationTitle && job.classificationTitle !== job.workingTitle
    ? `<p class="classification"><strong>Classification:</strong> ${escapeHtml(job.classificationTitle)}</p>` : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(job.workingTitle)} | Job Description</title>
  <style>
    body { max-width: 70rem; margin: 0 auto; padding: 1.5rem; font: 1rem/1.5 Arial, sans-serif; color: #111; }
    h1, h2 { line-height: 1.2; }
    h1 { margin-bottom: .35rem; }
    .classification { margin-top: 0; font-size: 1.1rem; color: #333; }
    section { margin-block: 2rem; }
    dt { font-weight: 700; margin-top: .75rem; }
    dd { margin-left: 0; }
    li { margin-block: .4rem; }
    table { border-collapse: collapse; width: 100%; }
    caption { font-weight: 700; text-align: left; margin-bottom: .5rem; }
    th, td { border: 1px solid #777; padding: .5rem; text-align: left; }
    label { display: block; font-weight: 700; margin-top: 1rem; }
    input { width: min(100%, 28rem); padding: .5rem; }
    .hint, .duty-percent { color: #444; }
    @media print { .page-actions { display: none; } body { max-width: none; padding: 0; } }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(job.workingTitle)}</h1>
    ${classification}
${section("Position Information", info)}
${section("Position Summary", job.summary ? `<p>${escapeHtml(job.summary)}</p>` : "")}
${section("Duties and Responsibilities", duties)}
${section("Minimum Qualifications", renderList(job.qualifications))}
${section("Preferred Qualifications", renderList(job.preferredQualifications))}
${section("Knowledge, Skills and Abilities", renderList(job.knowledgeSkillsAbilities))}
${section(
    "Physical Demands",
    renderFrequencyTable(
      "Physical demands and frequency",
      job.physicalDemands
    )
  )}
${section(
    "Working Environment",
    renderFrequencyTable(
      "Working conditions and frequency",
      job.workingConditions
    )
  )}
${section(
    "Physical Demands and Working Conditions",
    !job.physicalDemands.length && !job.workingConditions.length
      ? renderUiucPhysicalDemands(job)
      : ""
  )}
${section("Manager Approval", approval)}
    <section aria-labelledby="acknowledgment">
      <h2 id="acknowledgment">Job Description Acknowledgment</h2>
      <p>By signing below, I acknowledge that I have reviewed and received a copy of this job description.</p>
      <form>
        <label for="employee-name">Employee name</label>
        <input id="employee-name" name="employee-name" autocomplete="name">
        <label for="signature">Signature (type full name)</label>
        <input id="signature" name="signature" aria-describedby="signature-help">
        <p class="hint" id="signature-help">Enter your full name as your acknowledgment.</p>
        <label for="ack-date">Date</label>
        <input type="date" id="ack-date" name="ack-date">
      </form>
    </section>
    <div class="page-actions"><button type="button" onclick="window.print()">Print job description</button></div>
  </main>
</body>
</html>`;
}

function audit(model) {
  const warnings = [];
  if (!model.workingTitle) warnings.push("No working title or fallback title was found.");
  if (!model.summary) warnings.push("No job summary was found.");
  if (!model.responsibilities.length) warnings.push("No responsibilities were found.");
  if (!model.qualifications.length) { warnings.push("No minimum qualifications were found."); }
  if (!model.knowledgeSkillsAbilities.length) warnings.push("No Knowledge, Skills and Abilities entries were found.");
  if (!model.managerApproval.length) warnings.push("No manager approval information was found.");
  return warnings;
}
