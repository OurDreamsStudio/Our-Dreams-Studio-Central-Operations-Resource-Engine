import fs from 'fs';
import path from 'path';

const filesToFix = [
  'src/app/admin/database/page.tsx',
  'src/app/admin/terceirizados/page.tsx',
  'src/app/admin/financeiro/page.tsx',
  'src/app/producao/page.tsx',
  'src/app/kanban/page.tsx',
  'src/app/p/[token]/page.tsx'
];

for (const filepath of filesToFix) {
  const fullPath = path.resolve(filepath);
  if (!fs.existsSync(fullPath)) continue;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // Add import if not exists
  if (!content.includes('handleSupabaseError')) {
    content = content.replace(/(import.*lucide-react';)/, "$1\nimport { handleSupabaseError, formatCurrency, formatDate } from '@/lib/utils';");
  }

  // Replace raw alert errors
  content = content.replace(/alert\('Erro(.*?):\s*'\s*\+\s*(error\.message|e\.message|error|err\.message|projectError\.message)\);/g, "alert('Erro$1: ' + handleSupabaseError($2));");
  content = content.replace(/alert\(\`Erro(.*?)\[\$\{.*?\}(\]|\})\:\s*\$\{(error|e)\.message\}\`\);/g, "alert(`Erro$1: ${handleSupabaseError($3)}`);");

  // Fix exact ones
  content = content.replace(/alert\('Erro ao solicitar revisão\. Tente novamente\.'\);/g, "alert('Erro ao solicitar revisão: ' + handleSupabaseError(error));");
  content = content.replace(/alert\('Erro ao aprovar projeto\. Tente novamente\.'\);/g, "alert('Erro ao aprovar projeto: ' + handleSupabaseError(error));");

  // Re-write to file
  fs.writeFileSync(fullPath, content);
  console.log(`✅ Refactored alerts in ${filepath}`);
}
