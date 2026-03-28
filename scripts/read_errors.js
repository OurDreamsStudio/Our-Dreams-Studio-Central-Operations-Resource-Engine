const fs = require('fs');
const report = JSON.parse(fs.readFileSync('eslint_report.json', 'utf8'));

report.forEach(file => {
  if (file.errorCount > 0) {
    console.log(`\n=== ${file.filePath} (${file.errorCount} errors) ===`);
    file.messages.forEach(m => {
      if (m.severity === 2) {
         console.log(`Line ${m.line}: ${m.message}`);
      }
    });
  }
});
