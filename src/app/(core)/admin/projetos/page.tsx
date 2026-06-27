import { requireAuth } from '@/lib/requireAuth';
import { createUserClient } from '@/lib/supabaseUserClient';
import ProjetosManagerClient from './ProjetosManagerClient';

export default async function ProjetosManagerPage() {
  await requireAuth();
  const db = await createUserClient();

  // Buscar todos os projetos com detalhes do cliente
  const { data: projetos, error } = await db
    .from('projetos')
    .select('*, clientes(nome_artistico, nome_pessoal)')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('Erro ao carregar projetos: ' + error.message);
  }

  return (
    <div style={{ padding: '32px 36px', minHeight: '100vh' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 4 }}>
          <span className="gradient-text">Central de Projetos</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Gerenciamento completo de status de produção, pagamentos, prazos e entregas de todos os projetos.
        </p>
      </div>

      <ProjetosManagerClient inicialProjetos={projetos || []} />
    </div>
  );
}
