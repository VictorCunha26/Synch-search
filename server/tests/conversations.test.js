import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
process.env.SYNCH_DB = ':memory:';
process.env.SYNCH_WA_AUTH = join(mkdtempSync(join(tmpdir(), 'synch-wa-')), 'auth');
const { db } = await import('../db.js');
const { _onIncoming, listMessages, setAi } = await import('../conversations.js');

const add = (o) => Number(db.prepare(`INSERT INTO businesses(name, phone, status, ai_enabled) VALUES(?,?,?,?)`).run(o.name, o.phone, o.status, o.ai || 0).lastInsertRowid);

test('mensagem de um lead abordado entra na conversa, mesmo sem o 9º dígito no WhatsApp', async () => {
  const id = add({ name: 'Odonto Sorriso', phone: '(31) 99876-5432', status: 'contatado' });
  await _onIncoming({ id: 'A1', fromMe: false, jid: '553198765432@s.whatsapp.net', pnJid: '553198765432@s.whatsapp.net', text: 'Oi, quanto custa?' });
  const msgs = listMessages(id);
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].direction, 'in');
  const row = db.prepare('SELECT status, wa_jid FROM businesses WHERE id = ?').get(id);
  assert.equal(row.status, 'respondeu');
  assert.equal(row.wa_jid, '553198765432@s.whatsapp.net');
  // a mesma mensagem entregue duas vezes não duplica
  await _onIncoming({ id: 'A1', fromMe: false, jid: '553198765432@s.whatsapp.net', pnJid: '553198765432@s.whatsapp.net', text: 'Oi, quanto custa?' });
  assert.equal(listMessages(id).length, 1);
});

test('conversas pessoais (números que não são leads abordados) são ignoradas', async () => {
  const id = add({ name: 'Padaria Nova', phone: '(11) 98888-7777', status: 'novo' });
  await _onIncoming({ id: 'B1', fromMe: false, jid: '5511988887777@s.whatsapp.net', pnJid: '5511988887777@s.whatsapp.net', text: 'oi mãe' });
  await _onIncoming({ id: 'B2', fromMe: false, jid: '5521911112222@s.whatsapp.net', pnJid: '5521911112222@s.whatsapp.net', text: 'oi' });
  assert.equal(listMessages(id).length, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM messages').get().n, 1);
});

test('vendedor respondendo pelo celular pausa a IA daquele lead', async () => {
  const id = add({ name: 'Pet Shop Amigo', phone: '(19) 99111-2222', status: 'respondeu', ai: 1 });
  db.prepare('UPDATE businesses SET wa_jid = ? WHERE id = ?').run('5519991112222@s.whatsapp.net', id);
  await _onIncoming({ id: 'C1', fromMe: true, jid: '5519991112222@s.whatsapp.net', pnJid: '5519991112222@s.whatsapp.net', text: 'Oi! Aqui é o Victor' });
  const row = db.prepare('SELECT ai_enabled, ai_state FROM businesses WHERE id = ?').get(id);
  assert.equal(row.ai_enabled, 0);
  assert.match(row.ai_state, /pausou/);
  assert.throws(() => setAi(add({ name: 'Sem celular', phone: '(19) 3333-4444', status: 'novo' }), true, 'Victor'), /celular/);
});

test('modo "atender todos": número novo vira contato com IA; lista de ignorados e desligamento manual são respeitados', async () => {
  const { setSetting } = await import('../db.js');
  setSetting('aiAnswerAll', true);
  setSetting('aiIgnore', ['11977776666']);
  await _onIncoming({ id: 'D1', fromMe: false, jid: '5511955554444@s.whatsapp.net', pnJid: '5511955554444@s.whatsapp.net', text: 'Oi, vocês fazem site?', pushName: 'Maria Doces' });
  const novo = db.prepare("SELECT * FROM businesses WHERE name = 'Maria Doces'").get();
  assert.ok(novo, 'criou o contato');
  assert.equal(novo.ai_enabled, 1);
  assert.equal(novo.inbound, 1);
  assert.equal(novo.status, 'respondeu');
  assert.equal(listMessages(novo.id).length, 1);

  const antes = db.prepare('SELECT COUNT(*) n FROM businesses').get().n;
  await _onIncoming({ id: 'D2', fromMe: false, jid: '5511977776666@s.whatsapp.net', pnJid: '5511977776666@s.whatsapp.net', text: 'oi filho' });
  assert.equal(db.prepare('SELECT COUNT(*) n FROM businesses').get().n, antes, 'número ignorado não vira contato');

  const off = add({ name: 'Desligada', phone: '(11) 93333-2222', status: 'contatado' });
  setAi(off, false, 'Victor');
  await _onIncoming({ id: 'D3', fromMe: false, jid: '5511933332222@s.whatsapp.net', pnJid: '5511933332222@s.whatsapp.net', text: 'oi' });
  assert.equal(db.prepare('SELECT ai_enabled FROM businesses WHERE id = ?').get(off).ai_enabled, 0, 'quem desligou à mão continua desligado');
  setSetting('aiAnswerAll', false);
});
