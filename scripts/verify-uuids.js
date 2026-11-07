const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'supabase', 'migrations', '20261101000000_init_legal_property_pwa.sql'),
  path.join(__dirname, '..', 'src', 'lib', 'initialData.ts'),
];

const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

let totalChecked = 0;
let errors = 0;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  // Find all quoted strings that look like IDs with dashes
  const stringLiterals = content.match(/['"][^'"]+['"]/g) || [];
  
  for (const literal of stringLiterals) {
    const raw = literal.slice(1, -1);
    // If it has hyphens and is around 36 chars, check if it's meant to be a UUID
    if (raw.includes('-') && raw.length === 36) {
      totalChecked++;
      if (!uuidRegex.test(raw)) {
        console.error(`Invalid UUID in ${path.basename(file)}: "${raw}"`);
        errors++;
      }
    }
  }
}

if (errors === 0) {
  console.log(`PASS: All ${totalChecked} UUID literals across SQL migration & initialData.ts are valid hexadecimal PostgreSQL UUIDs!`);
  process.exit(0);
} else {
  console.error(`FAIL: Found ${errors} invalid UUIDs.`);
  process.exit(1);
}
