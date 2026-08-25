# JDXpert Accessible HTML Converter: Project Context

## Purpose

The converter transforms saved JDXpert job-description HTML into simplified, more accessible HTML.

The intended users are primarily nondevelopers. The distributed Windows executable must work without requiring Node.js, npm, or a development environment.

## Current distribution model

- Source application: Node.js
- HTML parsing: Cheerio
- Bundling: esbuild
- Executable packaging: Node.js Single Executable Applications
- Primary user workflow: Drag one or more HTML files, or a folder, onto the Windows executable
- Command-line use remains available for development and testing

## Current version

Version is maintained in `package.json`.

`parse-jdx.js` imports the version using:

```javascript
const { version } = require("./package.json");
```

Esbuild incorporates the version into the bundled application so `--version` works when the executable is distributed without `package.json`.

## Input and output behavior

### Single-file conversion

Input:

```text
sample.html
```

Output:

```text
sample.accessible.html
```

The output is saved beside the input file.

### Batch conversion

Multiple selected files are written to an `accessible-output` subdirectory.

### Folder conversion

HTML files located directly in the selected folder are processed. Subfolders are not processed.

### Source-file protection

Before writing output, the converter resolves and compares the input and output paths.

If the paths match, conversion stops rather than overwriting the source file.

## Responsibilities extraction

The converter first attempts to extract bullet-formatted responsibilities from a recognized duties section.

Recognized section headings include:

- Duties and Responsibilities
- Duties & Responsibilities
- Job Duties and Responsibilities
- Essential Duties and Responsibilities
- Essential Functions

Extraction stops at the next recognized major heading.

If no responsibilities are found in the scoped section, the converter preserves compatibility by falling back to document-wide bullet-row detection.

## Content currently extracted

- Working title
- Classification title
- Position information
- Position summary
- Duties and responsibilities
- Additional Responsibilities (UIS)
- Minimum qualifications
- Specialty factors
- Preferred qualifications
- Knowledge, Skills and Abilities
- Physical demands
- Working conditions
- UIUC work schedule and related expectations
- Manager approval information

## Audit warnings

The converter currently warns when it cannot find:

- Working title
- Position summary
- Responsibilities
- Minimum qualifications
- Knowledge, Skills and Abilities
- Manager approval information

Warnings do not necessarily mean conversion failed. They indicate that the generated file requires closer review.

## Generated HTML

The generated document uses semantic HTML, including:

- A `main` region
- Hierarchical headings
- Sections
- Unordered lists
- Description lists
- Tables with captions and scoped headers
- Associated form labels and controls
- Print-specific styling

Source text is escaped before insertion into generated HTML.

## Acknowledgment fields

The generated document includes employee name, typed signature, and date fields.

Values entered into these fields are not saved back into the HTML file. Users must print or save the completed page during the same browser session if the entered information must be retained.

## Important design decisions

- Keep the tool lightweight.
- Avoid requiring installation or administrator rights for end users.
- Preserve source wording whenever practical.
- Prefer narrowly scoped extraction when a recognizable section exists.
- Retain previous behavior as a fallback when new parsing rules cannot identify content.
- Never overwrite the input file.
- Treat generated output as requiring human review.
- Avoid adding a large GUI framework unless the drag-and-drop workflow proves insufficient.

## Known limitations and future considerations

- Responsibility identification still depends on recognizable headings and bullet-row structure.
- The document-wide responsibility fallback may capture unrelated bullet rows.
- Position summaries may currently capture only the first applicable content row.
- Folder processing is not recursive.
- Existing output files may be replaced.
- Batch processing should eventually continue after an individual file fails.
- A formal argument parser may eventually replace the current positional argument handling.
- A `--help` option may be useful.
- Regression tests should cover both UIUC and UIC source formats.

## Regression tests

Test the following after parser, output-path, bundling, or executable changes:

1. Display the version from an isolated executable.
2. Convert one valid UIUC HTML file.
3. Convert one valid UIC HTML file.
4. Convert multiple files.
5. Convert a folder containing one HTML file.
6. Convert a folder containing multiple HTML files.
7. Confirm that source files are not overwritten.
8. Confirm that qualification bullets are not included as responsibilities.
9. Confirm that document-wide responsibility fallback still works.
10. Confirm expected warnings for missing sections.
11. Confirm that invalid file types are rejected.
12. Confirm that the executable window remains open for review.
13. Confirm that `--no-pause` works.
14. Confirm that `--debug` displays technical error details.