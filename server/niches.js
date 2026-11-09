// Catálogo de segmentos (nichos) que a Synch prospecta.
//
// tier: capacidade de pagar + dependência de busca online.
//   A = ticket alto e cliente pesquisa no Google antes de ir (clínicas, advocacia, imobiliária…)
//   B = ticket médio, site ajuda mas não é decisivo (salão, pet shop, restaurante…)
//   C = ticket baixo ou compra por impulso/passagem (lanchonete, bar, mercadinho…)
// google: termos usados na Text Search do Google Places (um por consulta).
// osm: filtros Overpass (cada string vira uma linha nwr[...]).
// best: janela sugerida para abordar (dias úteis), por rotina típica do segmento.

export const NICHES = [
  // Saúde
  { id: 'dentista', cnae: ['8630504'], label: 'Dentistas', group: 'Saúde', tier: 'A', google: ['dentista', 'clínica odontológica'], osm: ['"amenity"="dentist"', '"healthcare"="dentist"'], best: 'ter–qui, 9h–11h ou 14h–16h' },
  { id: 'clinica', cnae: ['8630501', '8630502', '8630503'], label: 'Clínicas médicas', group: 'Saúde', tier: 'A', google: ['clínica médica', 'consultório médico'], osm: ['"amenity"="clinic"', '"amenity"="doctors"', '"healthcare"="clinic"', '"healthcare"="doctor"'], best: 'ter–qui, 9h–11h' },
  { id: 'estetica', cnae: ['9602502'], label: 'Estética', group: 'Saúde', tier: 'A', google: ['clínica de estética', 'estética facial'], osm: ['"shop"="beauty"'], best: 'ter–sex, 10h–12h' },
  { id: 'fisioterapia', cnae: ['8650004'], label: 'Fisioterapia e pilates', group: 'Saúde', tier: 'A', google: ['fisioterapia', 'studio de pilates'], osm: ['"healthcare"="physiotherapist"', '"sport"="pilates"'], best: 'ter–qui, 10h–12h' },
  { id: 'psicologia', cnae: ['8650003'], label: 'Psicologia', group: 'Saúde', tier: 'A', google: ['psicólogo', 'clínica de psicologia'], osm: ['"healthcare"="psychotherapist"', '"office"="psychologist"'], best: 'seg–qui, 12h–14h' },
  { id: 'nutricao', cnae: ['8650002'], label: 'Nutricionistas', group: 'Saúde', tier: 'A', google: ['nutricionista'], osm: ['"healthcare"="nutrition_counselling"'], best: 'ter–qui, 12h–14h' },
  { id: 'veterinario', cnae: ['7500100'], label: 'Veterinários', group: 'Saúde', tier: 'A', google: ['clínica veterinária'], osm: ['"amenity"="veterinary"'], best: 'ter–qui, 10h–12h' },
  { id: 'otica', cnae: ['4774100'], label: 'Óticas', group: 'Saúde', tier: 'B', google: ['ótica'], osm: ['"shop"="optician"'], best: 'ter–qui, 10h–12h' },

  // Serviços profissionais
  { id: 'advocacia', cnae: ['6911701'], label: 'Advocacia', group: 'Serviços profissionais', tier: 'A', google: ['escritório de advocacia', 'advogado'], osm: ['"office"="lawyer"'], best: 'ter–qui, 10h–12h ou 15h–17h' },
  { id: 'contabilidade', cnae: ['6920601', '6920602'], label: 'Contabilidade', group: 'Serviços profissionais', tier: 'A', google: ['escritório de contabilidade'], osm: ['"office"="accountant"', '"office"="tax_advisor"'], best: 'fora do dia 1–10 do mês, 9h–11h' },
  { id: 'imobiliaria', cnae: ['6821801', '6821802', '6822600'], label: 'Imobiliárias', group: 'Serviços profissionais', tier: 'A', google: ['imobiliária'], osm: ['"office"="estate_agent"', '"shop"="estate_agent"'], best: 'seg–sex, 9h–11h' },
  { id: 'arquitetura', cnae: ['7111100', '7410202'], label: 'Arquitetura e interiores', group: 'Serviços profissionais', tier: 'A', google: ['escritório de arquitetura', 'design de interiores'], osm: ['"office"="architect"'], best: 'ter–qui, 10h–12h' },
  { id: 'seguros', cnae: ['6622300'], label: 'Corretoras de seguros', group: 'Serviços profissionais', tier: 'A', google: ['corretora de seguros'], osm: ['"office"="insurance"'], best: 'ter–qui, 9h–11h' },
  { id: 'fotografia', cnae: ['7420001', '7420004'], label: 'Fotógrafos', group: 'Serviços profissionais', tier: 'A', google: ['estúdio de fotografia', 'fotógrafo'], osm: ['"craft"="photographer"', '"shop"="photo"'], best: 'seg–qua, 10h–12h' },

  // Beleza
  { id: 'salao', cnae: ['9602501'], label: 'Salões de beleza', group: 'Beleza', tier: 'B', google: ['salão de beleza'], osm: ['"shop"="hairdresser"'], best: 'ter–qua, 9h–10h30' },
  { id: 'barbearia', cnae: ['9602501'], label: 'Barbearias', group: 'Beleza', tier: 'B', google: ['barbearia'], osm: ['"shop"="hairdresser"]["name"~"barb",i'], best: 'ter–qua, 9h–11h' },
  { id: 'unhas', cnae: ['9602501'], label: 'Esmalterias e sobrancelhas', group: 'Beleza', tier: 'B', google: ['esmalteria', 'design de sobrancelhas'], osm: ['"beauty"="nails"', '"shop"="beauty"]["beauty"~"nails|eyebrow"'], best: 'ter–qua, 9h–11h' },

  // Fitness e educação
  { id: 'academia', cnae: ['9313100'], label: 'Academias e estúdios', group: 'Fitness e educação', tier: 'A', google: ['academia', 'crossfit'], osm: ['"leisure"="fitness_centre"'], best: 'seg–qui, 10h–12h ou 14h–16h' },
  { id: 'idiomas', cnae: ['8593700'], label: 'Escolas de idiomas', group: 'Fitness e educação', tier: 'A', google: ['escola de inglês', 'escola de idiomas'], osm: ['"amenity"="language_school"'], best: 'seg–qui, 14h–16h' },
  { id: 'escola', cnae: ['8511200', '8512100', '8513900', '8520100'], label: 'Escolas e berçários', group: 'Fitness e educação', tier: 'A', google: ['escola particular', 'escola infantil'], osm: ['"amenity"="kindergarten"', '"amenity"="school"]["operator:type"="private"'], best: 'seg–qui, 9h–11h' },
  { id: 'autoescola', cnae: ['8599601'], label: 'Autoescolas', group: 'Fitness e educação', tier: 'B', google: ['autoescola'], osm: ['"amenity"="driving_school"'], best: 'seg–qui, 10h–12h' },
  { id: 'cursos', cnae: ['8599699', '8599604', '8599605'], label: 'Cursos e reforço', group: 'Fitness e educação', tier: 'B', google: ['curso profissionalizante', 'aulas de reforço'], osm: ['"amenity"="training"', '"amenity"="prep_school"'], best: 'seg–qui, 14h–16h' },

  // Automotivo
  { id: 'oficina', cnae: ['4520001', '4520002', '4520003', '4520004'], label: 'Oficinas mecânicas', group: 'Automotivo', tier: 'A', google: ['oficina mecânica', 'auto center'], osm: ['"shop"="car_repair"'], best: 'ter–qui, 8h–10h' },
  { id: 'autopecas', cnae: ['4530703'], label: 'Autopeças', group: 'Automotivo', tier: 'B', google: ['autopeças'], osm: ['"shop"="car_parts"'], best: 'ter–qui, 9h–11h' },
  { id: 'estetica_auto', cnae: ['4520005'], label: 'Lava-rápido e estética automotiva', group: 'Automotivo', tier: 'B', google: ['estética automotiva', 'lava rápido'], osm: ['"amenity"="car_wash"'], best: 'ter–qua, 9h–11h' },

  // Casa e construção
  { id: 'moveis', cnae: ['4754701', '3101200'], label: 'Móveis e planejados', group: 'Casa e construção', tier: 'A', google: ['móveis planejados', 'loja de móveis'], osm: ['"shop"="furniture"', '"shop"="kitchen"'], best: 'ter–qui, 10h–12h' },
  { id: 'construcao', cnae: ['4744099', '4744001', '4744005'], label: 'Material de construção', group: 'Casa e construção', tier: 'B', google: ['material de construção'], osm: ['"shop"="hardware"', '"shop"="doityourself"', '"shop"="trade"'], best: 'ter–qui, 9h–11h' },
  { id: 'marmoraria', cnae: ['2391503', '4743100'], label: 'Marmorarias e vidraçarias', group: 'Casa e construção', tier: 'A', google: ['marmoraria', 'vidraçaria'], osm: ['"craft"="stonemason"', '"craft"="glaziery"', '"shop"="glaziery"'], best: 'ter–qui, 8h–10h' },
  { id: 'reformas', cnae: ['4330499', '4399103', '4321500', '4322301', '2512800', '4120400'], label: 'Reformas e serviços', group: 'Casa e construção', tier: 'A', google: ['empresa de reformas', 'serralheria', 'energia solar'], osm: ['"craft"="metal_construction"', '"craft"="builder"', '"craft"="electrician"', '"craft"="plumber"'], best: 'seg–qui, 8h–10h' },
  { id: 'dedetizacao', cnae: ['8122200', '8121400'], label: 'Dedetização e limpeza', group: 'Casa e construção', tier: 'A', google: ['dedetizadora', 'limpeza de estofados'], osm: ['"craft"="pest_control"', '"shop"="dry_cleaning"'], best: 'seg–qui, 9h–11h' },

  // Alimentação
  { id: 'restaurante', cnae: ['5611201'], label: 'Restaurantes', group: 'Alimentação', tier: 'B', google: ['restaurante'], osm: ['"amenity"="restaurant"'], best: 'ter–qui, 15h–17h (fora do almoço)' },
  { id: 'pizzaria', cnae: ['5611201'], label: 'Pizzarias', group: 'Alimentação', tier: 'B', google: ['pizzaria'], osm: ['"cuisine"~"pizza"'], best: 'ter–qui, 14h–16h' },
  { id: 'confeitaria', cnae: ['1091102', '4721104'], label: 'Confeitarias e doces', group: 'Alimentação', tier: 'B', google: ['confeitaria', 'bolos sob encomenda'], osm: ['"shop"="confectionery"', '"shop"="pastry"'], best: 'ter–qui, 14h–16h' },
  { id: 'padaria', cnae: ['4721102', '1091102'], label: 'Padarias', group: 'Alimentação', tier: 'C', google: ['padaria'], osm: ['"shop"="bakery"'], best: 'ter–qui, 14h–16h' },
  { id: 'lanchonete', cnae: ['5611203'], label: 'Lanchonetes e cafés', group: 'Alimentação', tier: 'C', google: ['lanchonete', 'cafeteria'], osm: ['"amenity"="fast_food"', '"amenity"="cafe"'], best: 'ter–qui, 15h–17h' },
  { id: 'bar', cnae: ['5611204', '5611205'], label: 'Bares', group: 'Alimentação', tier: 'C', google: ['bar'], osm: ['"amenity"="bar"', '"amenity"="pub"'], best: 'ter–qua, 14h–16h' },

  // Comércio
  { id: 'petshop', cnae: ['4789004', '9609208'], label: 'Pet shops', group: 'Comércio', tier: 'B', google: ['pet shop', 'banho e tosa'], osm: ['"shop"="pet"', '"shop"="pet_grooming"'], best: 'ter–qui, 10h–12h' },
  { id: 'moda', cnae: ['4781400', '4782201'], label: 'Moda e calçados', group: 'Comércio', tier: 'B', google: ['loja de roupas', 'boutique'], osm: ['"shop"="clothes"', '"shop"="shoes"', '"shop"="boutique"'], best: 'ter–qui, 10h–12h' },
  { id: 'joalheria', cnae: ['4783101'], label: 'Joalherias', group: 'Comércio', tier: 'A', google: ['joalheria'], osm: ['"shop"="jewelry"'], best: 'ter–qui, 10h–12h' },
  { id: 'floricultura', cnae: ['4789002'], label: 'Floriculturas', group: 'Comércio', tier: 'B', google: ['floricultura'], osm: ['"shop"="florist"', '"shop"="garden_centre"'], best: 'ter–qua, 9h–11h' },
  { id: 'tecnologia', cnae: ['4751201', '9511800', '9512600', '4752100'], label: 'Informática e celulares', group: 'Comércio', tier: 'B', google: ['assistência técnica celular', 'loja de informática'], osm: ['"shop"="computer"', '"shop"="mobile_phone"', '"shop"="electronics"'], best: 'ter–qui, 10h–12h' },
  { id: 'grafica', cnae: ['1813001', '1813099', '8219901'], label: 'Gráficas', group: 'Comércio', tier: 'B', google: ['gráfica'], osm: ['"shop"="copyshop"', '"craft"="printer"'], best: 'ter–qui, 9h–11h' },
  { id: 'mercado', cnae: ['4712100', '4724500'], label: 'Mercados e empórios', group: 'Comércio', tier: 'C', google: ['empório', 'mercadinho'], osm: ['"shop"="convenience"', '"shop"="deli"', '"shop"="greengrocer"'], best: 'ter–qui, 14h–16h' },

  // Hospedagem e eventos
  { id: 'hospedagem', cnae: ['5510801', '5510802', '5590601', '5590699', '5590603'], label: 'Pousadas e hotéis', group: 'Hospedagem e eventos', tier: 'A', google: ['pousada', 'hotel'], osm: ['"tourism"="guest_house"', '"tourism"="hotel"', '"tourism"="hostel"'], best: 'seg–qui, 10h–12h' },
  { id: 'eventos', cnae: ['8230001', '8230002', '5620102'], label: 'Buffets e eventos', group: 'Hospedagem e eventos', tier: 'A', google: ['buffet infantil', 'espaço para eventos'], osm: ['"amenity"="events_venue"'], best: 'ter–qui, 10h–12h' },
];

export const NICHE_BY_ID = Object.fromEntries(NICHES.map((n) => [n.id, n]));

// Liga um tipo do Google Places a um nicho (quando a busca não diz qual nicho originou o resultado).
export function nicheFromGoogleTypes(types = []) {
  const t = new Set(types);
  if (t.has('dentist') || t.has('dental_clinic')) return 'dentista';
  if (t.has('veterinary_care')) return 'veterinario';
  if (t.has('physiotherapist')) return 'fisioterapia';
  if (t.has('lawyer')) return 'advocacia';
  if (t.has('accounting')) return 'contabilidade';
  if (t.has('real_estate_agency')) return 'imobiliaria';
  if (t.has('beauty_salon') || t.has('hair_salon')) return 'salao';
  if (t.has('barber_shop')) return 'barbearia';
  if (t.has('gym') || t.has('fitness_center')) return 'academia';
  if (t.has('car_repair')) return 'oficina';
  if (t.has('restaurant')) return 'restaurante';
  if (t.has('bakery')) return 'padaria';
  if (t.has('pet_store')) return 'petshop';
  return null;
}

// ---- Base CNPJ (Receita Federal): CNAE principal -> segmento ----
// Alguns CNAEs cobrem mais de um segmento (ex.: 9602-5/01 = cabeleireiro, barbearia e manicure).
// O nome fantasia decide; sem pista no nome, vale o primeiro segmento da lista.
const NAME_HINTS = {
  barbearia: /barb/i,
  unhas: /unha|nail|esmalt|sobrancelh|c[ií]lio|lash/i,
  pizzaria: /pizz/i,
  confeitaria: /confeit|doce|bolo|cake|brigadeir|chocolat/i,
};
export const CNAE_TO_NICHES = {};
for (const n of NICHES) for (const c of n.cnae || []) (CNAE_TO_NICHES[c] ||= []).push(n.id);

export function nicheForCnae(cnae, name = '') {
  const list = CNAE_TO_NICHES[cnae];
  if (!list) return null;
  if (list.length === 1) return list[0];
  for (const id of list) if (NAME_HINTS[id]?.test(name)) return id;
  return list.find((id) => !NAME_HINTS[id]) || list[0];
}
