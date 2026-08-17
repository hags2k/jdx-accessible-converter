# JDXpert Accessible HTML Converter

Current version: 0.3.0

The JDXpert Accessible HTML Converter transforms saved JDXpert job-description HTML into a simplified, more accessible HTML document.

The converter is designed to preserve extracted source wording while restructuring recognized content into more accessible HTML. Review each generated file for completeness, accuracy, and accessibility before use.

## Use the Windows executable

The executable does not require Node.js or other development software.

### Convert one file

1. Locate the saved JDXpert `.html` or `.htm` file.
2. Drag the file onto `JDX-Accessible-Converter.exe`.
3. Review the conversion results and any warnings displayed in the command window.
4. Press Enter to close the command window.

The converted file is saved beside the original file with `.accessible.html` added to its name.

Example:

- Input: `job-description.html`
- Output: `job-description.accessible.html`

### Convert multiple files

Drag multiple `.html` or `.htm` files onto the executable.

The converter creates an `accessible-output` folder beside the source files and saves the converted files in that folder.

### Convert a folder

Drag a folder onto the executable to process the `.html` and `.htm` files located directly in that folder.

Subfolders are not processed.

Converted files are saved in an `accessible-output` folder inside the source folder.

### Conversion warnings

A warning means the converted file was created, but the converter did not find expected content such as a job summary, responsibilities, qualifications, Knowledge, Skills and Abilities, or manager approval information.

Review all converted files before use, including files created without warnings.

### Existing output files

If an output file with the same name already exists, the converter replaces it.

### Acknowledgment fields

The generated HTML includes acknowledgment fields and a Print button. Information entered into these fields is not stored in the HTML file.

Print the completed page or save it as a PDF before closing the browser if the entered information needs to be retained.

## Command-line use

### Install dependencies

```powershell
npm install

## Run

```bash
npm install cheerio
node parse-jdx.js "sample.html" --output "accessible-job-description.html"
```

### Convert one file

```
node parse-jdx.js "sample.html"
```

### Specify an output file

```
node parse-jdx.js "sample.html" --output "accessible-job-description.html"
```

The `--output` option may only be used with one input file.

### Convert multiple files

```
node parse-jdx.js "file-one.html" "file-two.html"
```

### Convert a folder

```
node parse-jdx.js "path-to-folder"
```

### Display the installed version

```
node parse-jdx.js --version
```

### Display technical error details

```
node parse-jdx.js "sample.html" --debug
```

### Close without waiting for Enter

```
node parse-jdx.js "sample.html" --no-pause
```

## Build the Windows executable

```
npm run build:exe
```

This command bundles the converter and builds the Windows executable using the settings in `sea-config.json`.

Test the completed executable from a separate folder that does not contain the project source files or `package.json`.

## Version 0.3.5

- Fixed issue where output could overwrite input
  - temporarily removing ability to manually specify output path and filename

## Version 0.3.0

- Added the `--version` option.
- Added support for converting multiple HTML files.
- Added support for processing HTML files from a folder.
- Added `accessible-output` folders for batch conversions.
- Improved console results and warning messages.
- Preserved the pause prompt so users can review results before the command window closes.

## Version 0.2.0

- Recognized `PRIMARY POSITION FUNCTION/SUMMARY` as a summary heading.
- Used the UIUC `Title` value as the primary working title and document heading.
- Displayed the classification title below the working title and in Position Information.
- Extracted rows under Knowledge, Skills and Abilities into a list.
- Included UIUC manager approval fields and earlier field-name variants.
- Added warnings when Knowledge, Skills and Abilities or manager approval information are absent.

## Important review notice

This converter assists with restructuring saved JDXpert HTML. It does not guarantee that all content has been extracted or that every generated document fully meets accessibility requirements.

Review each generated document for:

- Correct working title and classification
- Complete position summary
- Complete duties and responsibilities
- Minimum and preferred qualifications
- Knowledge, Skills and Abilities
- Physical demands and working conditions
- Manager approval information
- Overall reading order and accessibility