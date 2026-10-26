#!/usr/bin/env node
/**
 * Copies a curated subset of Material Icon Theme (MIT) into the renderer so the source control
 * tree can show the same per-file-type and per-folder icons as VS Code.
 *
 * Usage: node config/scripts/generate-material-icon-subset.mjs <path-to-material-icon-theme-package>
 * (the extracted npm package: it must contain dist/material-icons.json and icons/).
 *
 * Writes src/renderer/src/assets/material-icons/*.svg (+ LICENSE) and
 * src/renderer/src/lib/material-icon-associations.json. Only the associations listed below are
 * kept; anything else falls back to the theme's default file/folder icons.
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const packageDir = process.argv[2]
if (!packageDir) {
  console.error('usage: generate-material-icon-subset.mjs <material-icon-theme package dir>')
  process.exit(1)
}

const repoRoot = resolve(import.meta.dirname, '..', '..')
const iconOutDir = join(repoRoot, 'src/renderer/src/assets/material-icons')
const associationsOut = join(repoRoot, 'src/renderer/src/lib/material-icon-associations.json')
const manifest = JSON.parse(readFileSync(join(packageDir, 'dist/material-icons.json'), 'utf8'))
const packageVersion = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')).version

const EXTENSIONS =
  `ts tsx js jsx mjs cjs mts cts json jsonc json5 md mdx markdown html htm css scss sass less
styl vue svelte astro py pyi ipynb rb php go rs java kt kts swift c h cpp cc cxx hpp cs fs vb sql prisma graphql
gql yml yaml toml ini cfg conf env xml xsd svg png jpg jpeg gif webp ico bmp avif tiff mp4 mov webm mkv mp3 wav
ogg flac pdf zip gz tgz tar 7z rar txt log csv tsv xlsx xls docx doc pptx ppt sh bash zsh fish ps1 psm1 bat cmd
lock map wasm proto tf tfvars hcl lua dart r jl ex exs erl hs ml clj scala groovy gradle pl twig ejs hbs pug njk
liquid tex bib ttf otf woff woff2 eot pem crt key cert http rest diff patch drawio excalidraw sol vy nix zig odin
cmake mk dockerfile`.split(/\s+/)

// Compound extensions (service.ts, module.ts, d.ts, docker-compose.yml…) over these bases are all kept.
const COMPOUND_BASES = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'json',
  'yml',
  'yaml',
  'md',
  'vue',
  'html',
  'css',
  'scss'
])

const FILE_NAME_PATTERNS = [
  /^package(-lock)?\.json$/,
  /^(pnpm-lock|pnpm-workspace)\.yaml$/,
  /^yarn\.lock$/,
  /^bun\.lockb?$/,
  /^npm-shrinkwrap\.json$/,
  /^tsconfig.*\.json$/,
  /^jsconfig.*\.json$/,
  /^\.?eslint/,
  /^\.?prettier/,
  /^\.oxlintrc/,
  /^\.oxfmtrc/,
  /^\.editorconfig$/,
  /^(vite|vitest|jest|webpack|rollup|babel|postcss|tailwind|next|nuxt|svelte|astro|playwright|cypress)\.config\./,
  /^electron(-builder|\.vite)\./,
  /^(docker-compose|compose)\./,
  /^dockerfile/,
  /^\.dockerignore$/,
  /^makefile$/,
  /^readme/,
  /^license/,
  /^licence/,
  /^changelog/,
  /^contributing/,
  /^code_of_conduct/,
  /^security\.md$/,
  /^\.git(ignore|attributes|modules|keep)$/,
  /^\.env/,
  /^\.npmrc$/,
  /^\.nvmrc$/,
  /^\.node-version$/,
  /^\.husky/,
  /^nest-cli\.json$/,
  /^angular\.json$/,
  /^turbo\.json$/,
  /^nx\.json$/,
  /^lerna\.json$/,
  /^vercel\.json$/,
  /^netlify\.toml$/,
  /^composer\.(json|lock)$/,
  /^requirements.*\.txt$/,
  /^pyproject\.toml$/,
  /^setup\.py$/,
  /^go\.(mod|sum|work)$/,
  /^cargo\.(toml|lock)$/,
  /^gemfile(\.lock)?$/,
  /^\.babelrc/,
  /^favicon\.ico$/,
  /^robots\.txt$/,
  /^\.gitlab-ci\.yml$/,
  /^\.travis\.yml$/,
  /^jenkinsfile$/,
  /^procfile$/,
  /^\.vscode/,
  /^claude\.md$/,
  /^agents\.md$/,
  /^\.claude/
]

const FOLDER_NAMES =
  `src source lib libs dist build out output public static assets asset resources resource res images
image img imgs icons icon fonts font styles style css scss sass docs doc documentation test tests __tests__ spec specs
e2e config configs configuration scripts script tools tool utils util utilities helpers helper components component
pages page views view layouts layout hooks hook store stores state services service api apis controllers controller
models model entities entity schemas schema types typings interfaces interface routes route router routers middleware
middlewares modules module plugins plugin commands command queries query repositories repository migrations migration
seeds seeders database db prisma i18n locales locale lang langs translations node_modules .git .github .gitlab .vscode
.husky .idea .claude temp tmp logs log cache .cache vendor packages package apps app core shared common constants
constant enums enum guards guard pipes pipe decorators decorator dto dtos events event jobs job workers worker queue
queues mocks mock __mocks__ fixtures fixture templates template theme themes android ios docker kubernetes k8s deploy
deployment ci .circleci mail email emails security auth admin client server backend frontend web mobile desktop
electron main renderer preload src-tauri features feature contexts context providers provider stories .storybook
benchmarks benchmark examples example demo demos sample samples snippets content contents data datasets json audio
video videos media sounds animations svg python go rust java kotlin php ruby typescript javascript prd notes report
reports`.split(/\s+/)

// Why: VS Code falls back to the language id for extensions the theme does not list itself.
const LANGUAGE_BY_EXTENSION = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'typescriptreact',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascriptreact',
  json: 'json',
  jsonc: 'jsonc',
  md: 'markdown',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  py: 'python',
  rb: 'ruby',
  php: 'php',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  sh: 'shellscript',
  bash: 'shellscript',
  zsh: 'shellscript',
  ps1: 'powershell',
  bat: 'bat',
  cmd: 'bat',
  yml: 'yaml',
  yaml: 'yaml',
  xml: 'xml',
  sql: 'sql',
  swift: 'swift',
  lua: 'lua',
  r: 'r',
  dart: 'dart',
  ini: 'ini',
  dockerfile: 'dockerfile'
}

const fileExtensions = {}
for (const [ext, icon] of Object.entries(manifest.fileExtensions)) {
  const base = ext.split('.').pop()
  if (EXTENSIONS.includes(ext) || (ext.includes('.') && COMPOUND_BASES.has(base))) {
    fileExtensions[ext] = icon
  }
}
for (const ext of EXTENSIONS) {
  const languageIcon = manifest.languageIds[LANGUAGE_BY_EXTENSION[ext]]
  if (!fileExtensions[ext] && languageIcon) {
    fileExtensions[ext] = languageIcon
  }
}

const fileNames = {}
for (const [name, icon] of Object.entries(manifest.fileNames)) {
  if (FILE_NAME_PATTERNS.some((pattern) => pattern.test(name))) {
    fileNames[name] = icon
  }
}

const folderNames = {}
const folderNamesExpanded = {}
for (const name of FOLDER_NAMES) {
  if (manifest.folderNames[name]) {
    folderNames[name] = manifest.folderNames[name]
    folderNamesExpanded[name] =
      manifest.folderNamesExpanded[name] ?? `${manifest.folderNames[name]}-open`
  }
}

const associations = {
  source: `material-icon-theme@${packageVersion} (MIT)`,
  file: manifest.file,
  folder: manifest.folder,
  folderExpanded: manifest.folderExpanded,
  fileNames: sortKeys(fileNames),
  fileExtensions: sortKeys(fileExtensions),
  folderNames: sortKeys(folderNames),
  folderNamesExpanded: sortKeys(folderNamesExpanded)
}

const icons = new Set([
  associations.file,
  associations.folder,
  associations.folderExpanded,
  ...Object.values(fileNames),
  ...Object.values(fileExtensions),
  ...Object.values(folderNames),
  ...Object.values(folderNamesExpanded)
])
// Why iconDefinitions: recoloured variants ship as <name>.clone.svg, so the file name is not the icon id.
const available = new Set(readdirSync(join(packageDir, 'icons')))
const iconFile = (icon) => manifest.iconDefinitions[icon]?.iconPath.split('/').pop()
const missing = [...icons].filter((icon) => !available.has(iconFile(icon)))
if (missing.length > 0) {
  console.error(`icons referenced by the manifest but not shipped: ${missing.join(', ')}`)
  process.exit(1)
}

rmSync(iconOutDir, { recursive: true, force: true })
mkdirSync(iconOutDir, { recursive: true })
for (const icon of [...icons].sort()) {
  copyFileSync(join(packageDir, 'icons', iconFile(icon)), join(iconOutDir, `${icon}.svg`))
}
copyFileSync(join(packageDir, 'LICENSE'), join(iconOutDir, 'LICENSE'))
writeFileSync(associationsOut, `${JSON.stringify(associations, null, 2)}\n`)
console.log(
  `material icons: ${icons.size} icons, ${Object.keys(fileExtensions).length} extensions, ` +
    `${Object.keys(fileNames).length} file names, ${Object.keys(folderNames).length} folders`
)

function sortKeys(record) {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)))
}
