import { pathToFileURL } from 'node:url';
import type { Db } from './db.js';
import { openDatabase } from './db.js';
import { dueAt } from './sla.js';
import type { Ticket, User } from '../../../packages/contracts/src/index.js';
export function seed(db: Db, now = new Date()) {
  const users: User[] = [
    { id: 'ana', name: 'Ana Souza', email: 'ana.souza@nexo.com.br', role: 'employee' },
    { id: 'carla', name: 'Carla Mendes', email: 'carla.mendes@nexo.com.br', role: 'employee' },
    { id: 'rafael', name: 'Rafael Lima', email: 'rafael.lima@nexo.com.br', role: 'analyst' },
    { id: 'bruno', name: 'Bruno Tavares', email: 'bruno.tavares@nexo.com.br', role: 'analyst' },
  ];
  for (const u of users) db.prepare('INSERT OR IGNORE INTO users VALUES(?,?,?,?)').run(u.id, u.name, u.email, u.role);
  const articles = [
    ['vpn-809', 'VPN com erro 809', 'Somente Windows 10: reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. No Windows 11, abra um chamado. Confirme a versão antes de orientar.'],
    ['horario', 'Horário do service desk', 'Segunda a sexta das 8h às 18h, America/Sao_Paulo. Chamados críticos têm plantão 24 horas.'],
    ['monitor', 'Solicitação de monitor', 'Solicite um monitor em uma requisição de Hardware. Informe a necessidade e quem será atendido.'],
    ['sap', 'Acesso ao SAP', 'Para solicitar acesso ao SAP, informe o perfil e a justificativa. Não compartilhe senhas no chat.'],
    ['email', 'Outlook não sincroniza', 'Confira a conexão e se o modo offline está ativo. Se persistir, informe a mensagem de erro ao suporte.'],
    ['phishing', 'E-mail suspeito', 'Não clique em links nem abra anexos suspeitos. Informe o incidente ao suporte de TI sem fornecer senhas.'],
  ];
  for (const a of articles) db.prepare('INSERT OR IGNORE INTO articles VALUES(?,?,?)').run(a[0]!, a[1]!, a[2]!);
  const ago = (days: number) => new Date(now.getTime() - days * 86400000).toISOString();
  const entries: Array<[string, string, string, Ticket['category'], Ticket['priority'], number, boolean]> = [
    ['INC-20311', 'ana', 'Notebook lento após atualização do Windows', 'Hardware', 'Média', 8, false],
    ['REQ-10442', 'ana', 'Segundo monitor para home office', 'Hardware', 'Baixa', 1, false],
    ['INC-20150', 'ana', 'Senha do SAP bloqueada', 'Acesso', 'Média', 4, true],
    ['INC-19877', 'ana', 'Outlook não sincroniza no celular', 'E-mail', 'Baixa', 12, true],
    ['INC-20998', 'carla', 'VPN desconecta no Windows 11', 'Rede e VPN', 'Alta', 1, false],
  ];
  for (const [id, ownerId, title, category, priority, days, resolved] of entries) {
    const at = ago(days);
    const ticket: Ticket = { id, ownerId, title, description: `${title}. Relatado pelo funcionário e aguardando acompanhamento do suporte.`, category, priority, type: id.startsWith('REQ') ? 'REQ' : 'INC', affected: 'individual', blocked: false, commitmentToday: false, workaround: true, status: resolved ? 'RESOLVED' : 'OPEN', createdAt: at, supportUpdatedAt: at, resolvedAt: resolved ? at : null, dueAt: dueAt(new Date(at), priority).toISOString(), overdue: false };
    db.prepare('INSERT OR IGNORE INTO tickets VALUES(?,?,?)').run(id, ownerId, JSON.stringify(ticket));
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { const db = openDatabase(); seed(db); db.close(); console.log('Seed concluído; dados existentes preservados.'); }
