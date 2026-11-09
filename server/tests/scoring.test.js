import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.SYNCH_DB = ':memory:';
const { scoreBusiness, classifyPhone, fitModel, PRIOR, extractFeatures } = await import('../scoring.js');
const { buildApproach } = await import('../approach.js');

const base = { name: 'Odonto Sorriso', niche: 'dentista', sources: ['google'], rating: 4.8, reviews: 312, photos: 10, has_hours: 1, phone: '+55 19 99876-5432', competitor_share: 0.6 };

test('telefone: celular, fixo e ausente', () => {
  assert.equal(classifyPhone('+55 19 99876-5432').kind, 'mobile');
  assert.equal(classifyPhone('(19) 3342-5050').kind, 'landline');
  assert.equal(classifyPhone('').kind, 'none');
  assert.equal(classifyPhone('19 99876 5432').digits, '5519998765432');
});

test('site fora do ar + boa reputação = lead quente', () => {
  const s = scoreBusiness({ ...base, audit: { kind: 'broken', issues: ['x'] } });
  assert.equal(s.temperature, 'quente');
  assert.ok(s.score >= 85, `nota ${s.score}`);
  assert.equal(s.pain.code, 'site_fora');
});

test('site bom pontua baixo', () => {
  const s = scoreBusiness({ ...base, audit: { kind: 'ok', flags: {} } });
  assert.equal(s.temperature, 'frio');
  assert.ok(s.score < 30, `nota ${s.score}`);
});

test('franquia cai para frio mesmo sem site', () => {
  const s = scoreBusiness({ ...base, chain: 1, audit: { kind: 'none' } });
  assert.equal(s.temperature, 'frio');
});

test('sem telefone derruba a nota', () => {
  const a = scoreBusiness({ ...base, audit: { kind: 'none' } });
  const b = scoreBusiness({ ...base, phone: null, audit: { kind: 'none' } });
  assert.ok(b.score < a.score - 20);
});

test('explicação soma exatamente a nota', () => {
  for (const kind of ['none', 'social', 'broken', 'weak', 'ok']) {
    const s = scoreBusiness({ ...base, audit: { kind, platform: 'Instagram', flags: { noMobile: true } } });
    const sum = s.base + s.explanation.reduce((t, p) => t + p.points, 0);
    assert.equal(sum, s.score, kind);
  }
});

test('aprendizado move os pesos na direção dos resultados', () => {
  const win = extractFeatures({ ...base, audit: { kind: 'social', platform: 'Instagram' } });
  const loss = extractFeatures({ ...base, audit: { kind: 'none' } });
  const ex = [...Array(8)].map(() => ({ x: win, y: 1 })).concat([...Array(8)].map(() => ({ x: loss, y: 0 })));
  const fit = fitModel(ex);
  assert.ok(fit.weights.p_social > PRIOR.p_social);
  assert.ok(fit.weights.p_none < PRIOR.p_none);
});

test('abordagem usa a dor e gera link de WhatsApp', () => {
  const a = buildApproach({ ...base, neighborhood: 'Cambuí', audit: { kind: 'social', platform: 'Instagram' } }, { seller: 'Victor' });
  assert.match(a.whatsappText, /Instagram/);
  assert.match(a.whatsappUrl, /^https:\/\/wa\.me\/5519998765432\?text=/);
});

test('base CNPJ: empresa nova, e-mail gratuito e sem site encontrado', () => {
  const opened = new Date(); opened.setMonth(opened.getMonth() - 4);
  const lead = { name: 'Clínica Nova', niche: 'dentista', sources: ['rfb'], phone: '11987654321', email: 'clinicanova@gmail.com', opened_at: opened.toISOString().slice(0, 10), porte: '03', audit: { kind: 'none', confirmed: false } };
  const s = scoreBusiness(lead);
  const keys = s.explanation.map((p) => p.key);
  assert.ok(keys.includes('p_unverified_none') && !keys.includes('p_none'));
  assert.ok(keys.includes('new_business') && keys.includes('free_email') && keys.includes('porte_plus'));
  assert.equal(s.pain.label, 'Sem site encontrado');
  assert.equal(s.base + s.explanation.reduce((t, p) => t + p.points, 0), s.score);
});

test('base CNPJ: domínio do e-mail sem site vira "Domínio sem site"', () => {
  const s = scoreBusiness({ ...base, sources: ['rfb'], website: 'https://x.com.br', audit: { kind: 'broken', derived: true, url: 'https://x.com.br' } });
  assert.equal(s.pain.label, 'Domínio sem site');
  const a = buildApproach({ ...base, sources: ['rfb'], audit: { kind: 'broken', derived: true, url: 'https://exemplo.com.br' } });
  assert.match(a.whatsappText, /exemplo\.com\.br/);
});

test('MEI e telefone de contador reduzem a nota', () => {
  const a = scoreBusiness({ ...base, sources: ['rfb'], audit: { kind: 'none' } });
  const b = scoreBusiness({ ...base, sources: ['rfb'], mei: 1, phone_shared: 1, audit: { kind: 'none' } });
  assert.ok(b.score < a.score);
});
