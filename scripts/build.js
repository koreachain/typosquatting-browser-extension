const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
// Configuration
const SOURCE_DIR = "./src";
const DIST_DIR = "./dist";
const CHROME_DIR = path.join(DIST_DIR, "chrome");
const FIREFOX_DIR = path.join(DIST_DIR, "firefox");
// Create distribution directories
function createDirectories() {
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR);
  }
  if (!fs.existsSync(CHROME_DIR)) {
    fs.mkdirSync(CHROME_DIR);
  }
  if (!fs.existsSync(FIREFOX_DIR)) {
    fs.mkdirSync(FIREFOX_DIR);
  }
}
// Copy shared files
function copySharedFiles() {
  const filesToCopy = [
    "popup.html",
    "popup.js",
    "content.js",
    "styles.css",
    "confirmation.html",
    "confirmation.js",
  ];
  const directoriesToCopy = ["images"];
  // Copy individual files
  filesToCopy.forEach((file) => {
    const sourcePath = path.join(SOURCE_DIR, file);
    const chromeDestPath = path.join(CHROME_DIR, file);
    const firefoxDestPath = path.join(FIREFOX_DIR, file);

    fs.copyFileSync(sourcePath, chromeDestPath);
    fs.copyFileSync(sourcePath, firefoxDestPath);
  });
  // Copy directories
  directoriesToCopy.forEach((dir) => {
    const sourceDir = path.join(SOURCE_DIR, dir);
    const chromeDestDir = path.join(CHROME_DIR, dir);
    const firefoxDestDir = path.join(FIREFOX_DIR, dir);

    // Create destination directories if they don't exist
    if (!fs.existsSync(chromeDestDir)) {
      fs.mkdirSync(chromeDestDir);
    }
    if (!fs.existsSync(firefoxDestDir)) {
      fs.mkdirSync(firefoxDestDir);
    }

    // Copy all files from the directory
    const files = fs.readdirSync(sourceDir);
    files.forEach((file) => {
      const sourcePath = path.join(sourceDir, file);
      const chromeDestPath = path.join(chromeDestDir, file);
      const firefoxDestPath = path.join(firefoxDestDir, file);

      fs.copyFileSync(sourcePath, chromeDestPath);
      fs.copyFileSync(sourcePath, firefoxDestPath);
    });
  });
}
// Copy browser-specific files
function copyBrowserSpecificFiles() {
  // Copy Chrome manifest
  fs.copyFileSync(
    path.join(SOURCE_DIR, "manifest.json"),
    path.join(CHROME_DIR, "manifest.json"),
  );

  // Copy Firefox manifest
  fs.copyFileSync(
    path.join(SOURCE_DIR, "manifest.firefox.json"),
    path.join(FIREFOX_DIR, "manifest.json"),
  );

  // Copy browser-polyfill.js to Firefox directory
  fs.copyFileSync(
    path.join(SOURCE_DIR, "browser-polyfill.js"),
    path.join(FIREFOX_DIR, "browser-polyfill.js"),
  );

  // Copy background script to Chrome directory
  fs.copyFileSync(
    path.join(SOURCE_DIR, "background.js"),
    path.join(CHROME_DIR, "background.js"),
  );

  // For Firefox, use the cross-browser background script
  fs.copyFileSync(
    path.join(SOURCE_DIR, "background.js"),
    path.join(FIREFOX_DIR, "background.js"),
  );
}
// Create ZIP archives for distribution
function createZipArchives() {
  const chromeZipCommand = `cd ${CHROME_DIR} && zip -r ../chrome-extension.zip *`;
  const firefoxZipCommand = `cd ${FIREFOX_DIR} && zip -r ../firefox-extension.zip *`;

  console.log("Creating Chrome extension ZIP...");
  execSync(chromeZipCommand);

  console.log("Creating Firefox extension ZIP...");
  execSync(firefoxZipCommand);
}
// Main build function
function build() {
  console.log("Building extensions for Chrome and Firefox...");

  console.log("Creating directories...");
  createDirectories();

  console.log("Copying shared files...");
  copySharedFiles();

  console.log("Copying browser-specific files...");
  copyBrowserSpecificFiles();

  console.log("Creating ZIP archives...");
  createZipArchives();

  console.log("Build complete!");
  console.log(
    `Chrome extension: ${path.join(DIST_DIR, "chrome-extension.zip")}`,
  );
  console.log(
    `Firefox extension: ${path.join(DIST_DIR, "firefox-extension.zip")}`,
  );
}

// Function to clean up previous builds
function clean() {
  console.log("Cleaning previous builds...");

  if (fs.existsSync(DIST_DIR)) {
    // Remove all files in the dist directory
    const files = fs.readdirSync(DIST_DIR);
    files.forEach((file) => {
      const filePath = path.join(DIST_DIR, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        // Remove all files in subdirectories
        const subFiles = fs.readdirSync(filePath);
        subFiles.forEach((subFile) => {
          fs.unlinkSync(path.join(filePath, subFile));
        });
        fs.rmdirSync(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    });
  }

  console.log("Clean complete!");
}

// Function to validate source files exist
function validateSource() {
  console.log("Validating source files...");

  const requiredFiles = [
    "manifest.json",
    "manifest.firefox.json",
    "popup.html",
    "popup.js",
    "content.js",
    "styles.css",
    "background.js",
    "browser-polyfill.js",
  ];

  let missing = false;

  requiredFiles.forEach((file) => {
    const filePath = path.join(SOURCE_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.error(`ERROR: Required file not found: ${filePath}`);
      missing = true;
    }
  });

  if (missing) {
    console.error(
      "Validation failed. Please ensure all required files exist in the source directory.",
    );
    process.exit(1);
  }

  console.log("Source validation complete!");
  return true;
}

// Command line argument handling
function main() {
  const arg = process.argv[2];

  switch (arg) {
    case "clean":
      clean();
      break;
    case "validate":
      validateSource();
      break;
    case "build":
      validateSource();
      build();
      break;
    default:
      console.log("Usage: node build.js [clean|validate|build]");
      console.log("  clean     - Remove previous builds");
      console.log("  validate  - Check that all required source files exist");
      console.log("  build     - Build extensions for Chrome and Firefox");
      break;
  }
}

// Execute main function
main();
