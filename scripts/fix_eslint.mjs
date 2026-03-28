import fs from 'fs';
import path from 'path';

function fixFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let original = content;

        // Imagem warnings
        content = content.replace(/(?<!\/\* eslint-disable-next-line @next\/next\/no-img-element \*\/\s*)<img /g, '/* eslint-disable-next-line @next/next/no-img-element */\n<img ');

        // Rollback UI hook states to any for v1.0.0-RC stability
        content = content.replace(/useState<Projeto\[\]>\(\s*\[\]\s*\)/g, 'useState<any[]>([])');
        content = content.replace(/useState<Cliente\[\]>\(\s*\[\]\s*\)/g, 'useState<any[]>([])');
        content = content.replace(/useState<Terceirizado\[\]>\(\s*\[\]\s*\)/g, 'useState<any[]>([])');
        content = content.replace(/useState<TarefaTerceirizado\[\]>\(\s*\[\]\s*\)/g, 'useState<any[]>([])');
        content = content.replace(/useState<Notificacao\[\]>\(\s*\[\]\s*\)/g, 'useState<any[]>([])');
        
        content = content.replace(/useState<Projeto\s*\|\s*null>\(\s*null\s*\)/g, 'useState<any | null>(null)');
        content = content.replace(/useState<ProjetoComCliente\s*\|\s*null>\(\s*null\s*\)/g, 'useState<any | null>(null)');
        content = content.replace(/useState<Cliente\s*\|\s*null>\(\s*null\s*\)/g, 'useState<any | null>(null)');
        content = content.replace(/useState<Terceirizado\s*\|\s*null>\(\s*null\s*\)/g, 'useState<any | null>(null)');
        content = content.replace(/useState<TarefaTerceirizado\s*\|\s*null>\(\s*null\s*\)/g, 'useState<any | null>(null)');
        
        // Function args remain typed appropriately for actions, except for ones handled incorrectly UI-side
        // keep args as typed.
        content = content.replace(/\(proj: any\)/g, '(proj: Projeto)');
        content = content.replace(/\(cliente: any\)/g, '(cliente: Cliente)');
        content = content.replace(/\(t: any\)/g, '(t: TarefaTerceirizado)');
        content = content.replace(/\(task: any\)/g, '(task: TarefaTerceirizado)');
        content = content.replace(/\(partner: any\)/g, '(partner: Terceirizado)');
        content = content.replace(/\(n: any\)/g, '(n: Notificacao)');
        content = content.replace(/projectData: any/g, 'projectData: Partial<Projeto>');
        content = content.replace(/clientData: any/g, 'clientData: Partial<Cliente>');
        content = content.replace(/taskData: any/g, 'taskData: Partial<TarefaTerceirizado>');
        content = content.replace(/partnerData: any/g, 'partnerData: Partial<Terceirizado>');

        // catch returns
        content = content.replace(/catch \(e: any\)/g, 'catch (e)');
        content = content.replace(/catch \(error: any\)/g, 'catch (error)');
        
        // Remove duplicate imports if already there
        if (content.includes("import { Projeto, Cliente } from '@/types';") && content.includes("import { Projeto, Cliente, Terceirizado, TarefaTerceirizado, Notificacao } from '@/types';")) {
             content = content.replace("import { Projeto, Cliente } from '@/types';\n", "");
        }

        // Add imports if types were added
        if (content !== original) {
            if (!content.includes('@/types') && 
                (content.includes('Projeto') || content.includes('Cliente') || content.includes('Terceirizado') || content.includes('Notificacao') || content.includes('TarefaTerceirizado'))
               ) {
                const importStatement = "import { Projeto, Cliente, Terceirizado, TarefaTerceirizado, Notificacao } from '@/types';\n";
                const tsxMatch = content.match(/import .* from .*;(\r?\n)/g);
                if (tsxMatch && tsxMatch.length > 0) {
                    const lastImport = tsxMatch[tsxMatch.length - 1];
                    content = content.replace(lastImport, lastImport + importStatement);
                } else {
                    content = importStatement + content;
                }
            }
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Fixed ${filePath}`);
        }
    } catch(err) {
        // ignore errors reading directories or non-js content
    }
}

function walkUrl(dir) {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            walkUrl(file);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            fixFile(file);
        }
    });
}

walkUrl('./src');
