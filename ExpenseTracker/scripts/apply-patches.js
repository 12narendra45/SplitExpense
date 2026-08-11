const fs = require('fs');
const path = require('path');

function readFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function replaceExact(filePath, searchValue, replaceValue) {
  const content = readFile(filePath);
  if (!content) {
    console.warn('[apply-patches] File not found:', filePath);
    return;
  }
  if (content.includes(replaceValue)) {
    return;
  }
  if (!content.includes(searchValue)) {
    console.log('[apply-patches] No patch needed for', filePath);
    return;
  }
  writeFile(filePath, content.split(searchValue).join(replaceValue));
  console.log('[apply-patches] Patched', filePath);
}

function replaceRegex(filePath, searchRegex, replaceValue) {
  const content = readFile(filePath);
  if (!content) {
    console.warn('[apply-patches] File not found:', filePath);
    return;
  }
  if (!searchRegex.test(content)) {
    console.log('[apply-patches] No regex patch needed for', filePath);
    return;
  }
  writeFile(filePath, content.replace(searchRegex, replaceValue));
  console.log('[apply-patches] Regex patched', filePath);
}

function ensureImport(filePath, importLine) {
  const content = readFile(filePath);
  if (!content) {
    console.warn('[apply-patches] File not found:', filePath);
    return;
  }
  if (content.includes(importLine)) {
    return;
  }
  if (content.includes('import java.nio.file.Paths\n')) {
    writeFile(filePath, content.replace('import java.nio.file.Paths\n', 'import java.nio.file.Paths\n' + importLine + '\n'));
    console.log('[apply-patches] Added import to', filePath);
  }
}

function ensureBlockAfter(filePath, searchValue, block) {
  const content = readFile(filePath);
  if (!content) {
    console.warn('[apply-patches] File not found:', filePath);
    return;
  }
  if (content.includes(block)) {
    return;
  }
  if (!content.includes(searchValue)) {
    console.warn('[apply-patches] Cannot add block because search pattern is missing in', filePath);
    return;
  }
  writeFile(filePath, content.replace(searchValue, searchValue + block));
  console.log('[apply-patches] Inserted block into', filePath);
}

function ensureBlockBefore(filePath, searchValue, block) {
  const content = readFile(filePath);
  if (!content) {
    console.warn('[apply-patches] File not found:', filePath);
    return;
  }
  if (content.includes(block)) {
    return;
  }
  if (!content.includes(searchValue)) {
    console.warn('[apply-patches] Cannot add block because search pattern is missing in', filePath);
    return;
  }
  writeFile(filePath, content.replace(searchValue, block + searchValue));
  console.log('[apply-patches] Inserted block into', filePath);
}

const projectRoot = process.cwd();
const target = path.join(projectRoot, 'node_modules', 'expo-av', 'android', 'build.gradle');

replaceExact(target, "classifier = 'sources'", "archiveClassifier.set('sources')");
replaceRegex(target, /buildscript \{[\s\S]*?dependencies \{[\s\S]*?classpath.*?\}[\s\S]*?\n\}/, `buildscript {
  repositories {
    mavenCentral()
  }

  dependencies {
    def kotlinVersion = rootProject.ext.has("kotlinVersion") ? rootProject.ext.get("kotlinVersion") : "2.1.20"
    def kotlinGradlePluginDep = 'org.jetbrains.kotlin:kotlin-gradle-plugin:' + kotlinVersion
    classpath(kotlinGradlePluginDep)
    classpath "de.undercouch:gradle-download-task:5.3.0"
  }
}
`);
replaceExact(target, "compileOptions {\n    sourceCompatibility JavaVersion.VERSION_11\n    targetCompatibility JavaVersion.VERSION_11\n  }", "compileOptions {\n    sourceCompatibility JavaVersion.VERSION_17\n    targetCompatibility JavaVersion.VERSION_17\n  }\n");
replaceRegex(target, /kotlinOptions\s*\{\s*jvmTarget\s*=\s*JavaVersion\.VERSION_17\.majorVersion\s*\}/, "kotlinOptions {\n    jvmTarget = \"17\"\n  }");
replaceRegex(target, /kotlinOptions\s*\{\s*jvmTarget\s*=\s*\"?11\"?\s*\}/, "kotlinOptions {\n    jvmTarget = \"17\"\n  }");
ensureImport(target, 'import org.jetbrains.kotlin.gradle.tasks.KotlinCompile');
ensureImport(target, 'import org.jetbrains.kotlin.gradle.tasks.KotlinJvmCompile');
ensureBlockAfter(target, "apply plugin: \"de.undercouch.download\"\n", `\nkotlin {\n  jvmToolchain(17)\n}\n`);
ensureBlockAfter(target, "compileOptions {\n    sourceCompatibility JavaVersion.VERSION_17\n    targetCompatibility JavaVersion.VERSION_17\n  }\n", `\n  kotlinOptions {\n    jvmTarget = \"17\"\n  }\n`);
replaceExact(target, "kotlinOptions {\n    jvmTarget = \"17\"\n  }\n\n  defaultConfig {", "kotlinOptions {\n    jvmTarget = \"17\"\n  }\n\n  tasks.withType(KotlinCompile).configureEach {\n    kotlinOptions {\n      jvmTarget = \"17\"\n    }\n  }\n\n  tasks.withType(KotlinJvmCompile).configureEach {\n    kotlinOptions {\n      jvmTarget = \"17\"\n    }\n  }\n\n  defaultConfig {");
replaceRegex(target, /\n  tasks\.withType\(KotlinCompile\)\.configureEach \{[\s\S]*?tasks\.withType\(KotlinJvmCompile\)\.configureEach \{[\s\S]*?\}\n\n(?=dependencies \{)/, '\n');
replaceRegex(target, /tasks\.withType\(org\.jetbrains\.kotlin\.gradle\.tasks\.KotlinCompile\)/g, 'tasks.withType(KotlinCompile)');
replaceRegex(target, /tasks\.withType\(org\.jetbrains\.kotlin\.gradle\.tasks\.KotlinJvmCompile\)/g, 'tasks.withType(KotlinJvmCompile)');

console.log('[apply-patches] Done');
