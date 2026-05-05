// dashboard/+page.server.js
export async function load({ platform, url }) {
  const db = platform?.env?.DB;

  // Parse filter params
  const now = new Date();
  const currentYear = now.getFullYear();
  const anoParam = parseInt(url.searchParams.get('ano') || String(currentYear));
  const mesInicioParam = parseInt(url.searchParams.get('mesInicio') || '1');
  const mesFimParam = parseInt(url.searchParams.get('mesFim') || '12');
  const estratificacao = url.searchParams.get('estratificacao') || 'categoria';

  if (!db) {
    return {
      gastos: [],
      categorias: [],
      subcategorias: [],
      filters: { ano: anoParam, mesInicio: mesInicioParam, mesFim: mesFimParam, estratificacao },
      anosDisponiveis: [currentYear]
    };
  }

  // Build date range
  const dataInicio = `${anoParam}-${String(mesInicioParam).padStart(2, '0')}-01`;
  const mesFimLast = new Date(anoParam, mesFimParam, 0).getDate();
  const dataFim = `${anoParam}-${String(mesFimParam).padStart(2, '0')}-${String(mesFimLast).padStart(2, '0')}`;

  // Fetch all gastos in date range with full hierarchy
  const [gastosR, catsR, subcatsR, anosR] = await Promise.all([
    db.prepare(`
      SELECT g.id, g.data, g.valor, g.tipo, g.pagamento,
             i.nome_item as item_nome,
             s.id as subcategoria_id, s.nome_subcategoria as subcategoria_nome,
             c.id as categoria_id, c.nome_categoria as categoria_nome
      FROM gastos g
      LEFT JOIN itens i ON g.id_item = i.id
      LEFT JOIN subcategorias s ON g.id_subcategoria = s.id
      LEFT JOIN categorias c ON g.id_categoria = c.id
      WHERE g.data BETWEEN ? AND ?
      ORDER BY g.data ASC
    `).bind(dataInicio, dataFim).all(),
    db.prepare('SELECT id, nome_categoria as nome FROM categorias ORDER BY nome_categoria').all(),
    db.prepare(`
      SELECT s.id, s.nome_subcategoria as nome, s.id_categoria as categoria_id, c.nome_categoria as categoria_nome
      FROM subcategorias s
      JOIN categorias c ON s.id_categoria = c.id
      ORDER BY c.nome_categoria, s.nome_subcategoria
    `).all(),
    db.prepare(`
      SELECT DISTINCT CAST(strftime('%Y', data) AS INTEGER) as ano
      FROM gastos
      ORDER BY ano DESC
    `).all()
  ]);

  // Also fetch all gastos from the last 12 months for averages
  const now12 = new Date();
  now12.setMonth(now12.getMonth() - 12);
  const data12Inicio = now12.toISOString().split('T')[0];
  const data12Fim = new Date().toISOString().split('T')[0];

  const gastosAvgR = await db.prepare(`
    SELECT g.data, g.valor,
           s.id as subcategoria_id, s.nome_subcategoria as subcategoria_nome,
           c.id as categoria_id, c.nome_categoria as categoria_nome
    FROM gastos g
    LEFT JOIN subcategorias s ON g.id_subcategoria = s.id
    LEFT JOIN categorias c ON g.id_categoria = c.id
    WHERE g.data BETWEEN ? AND ?
    ORDER BY g.data ASC
  `).bind(data12Inicio, data12Fim).all();

  const anosDisponiveis = anosR.results.map(r => r.ano);
  if (!anosDisponiveis.includes(currentYear)) anosDisponiveis.unshift(currentYear);

  return {
    gastos: gastosR.results,
    gastosAvg: gastosAvgR.results,
    categorias: catsR.results,
    subcategorias: subcatsR.results,
    filters: { ano: anoParam, mesInicio: mesInicioParam, mesFim: mesFimParam, estratificacao },
    anosDisponiveis
  };
}
