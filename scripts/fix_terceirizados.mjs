import fs from 'fs';
import path from 'path';

const filepath = 'src/app/admin/terceirizados/page.tsx';
const fullPath = path.resolve(filepath);

if (fs.existsSync(fullPath)) {
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // 1. Fix generic catches
  content = content.replace(/catch\s*\(\s*error\s*\)/g, 'catch (error: any)');

  // 2. Fix setRoadmapSteps types
  content = content.replace(/setRoadmapSteps\(task\.roadmap_etapas \|\| \[''\]\);/g, "setRoadmapSteps((task.roadmap_etapas as string[]) || ['']);");

  // 3. Cast task to any in map access (e.g. task.projetos -> (task as any).projetos)
  content = content.replace(/task\.projetos\?/g, '(task as any).projetos?');
  content = content.replace(/task\.terceirizados\?/g, '(task as any).terceirizados?');
  
  // 4. Remove duplicate function at the end
  content = content.replace(/  function openEditPartner\([\s\S]*?\}\s*\}\s*$/g, '}');
  
  // Apply fix
  fs.writeFileSync(fullPath, content);
  console.log(`✅ Fixed TS Errors in ${filepath}`);
}
