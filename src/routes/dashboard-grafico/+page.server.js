// dashboard-grafico/+page.server.js
export async function load({ platform, url }) {
  const db = platform?.env?.DB;

  // Parse filter params
  const now = new Date();
  const currentYear = now.getFullYear();
  const anoParam = parseInt(url.searchParams.get('ano') || String(currentYear));
  const mesInicioParam = parseInt(url.searchParams.get('mesInicio') || '1');
  const mesFimParam = parseInt(url.searchParams.get('mesFim') || '12');

  if (!db) {
    return {
      porCategoria: [], porMes: [], porPagamento: [],
      filters: { ano: anoParam, mesInicio: mesInicioParam, mesFim: mesFimParam },
      anosDisponiveis: [currentYear]
    };
  }

  // Build date range
  const dataInicio = `${anoParam}-${String(mesInicioParam).padStart(2, '0')}-01`;
  const mesFimLast = new Date(anoParam, mesFimParam, 0).getDate();
  const dataFim = `${anoParam}-${String(mesFimParam).padStart(2, '0')}-${String(mesFimLast).padStart(2, '0')}`;

  const [porCatR, porMesR, porPagR, anosR] = await Promise.all([
    db.prepare(`
      SELECT c.nome_categoria as categoria, SUM(g.valor) as total, COUNT(*) as qtd
      FROM gastos g
      LEFT JOIN categorias c ON g.id_categoria = c.id
      WHERE g.data BETWEEN ? AND ?
      GROUP BY g.id_categoria
      ORDER BY total DESC
    `).bind(dataInicio, dataFim).all(),
    db.prepare(`
      SELECT strftime('%Y-%m', g.data) as mes, SUM(g.valor) as total
      FROM gastos g
      WHERE g.data BETWEEN ? AND ?
      GROUP BY strftime('%Y-%m', g.data)
      ORDER BY mes ASC
    `).bind(dataInicio, dataFim).all(),
    db.prepare(`
      SELECT g.pagamento, SUM(g.valor) as total, COUNT(*) as qtd
      FROM gastos g
      WHERE g.data BETWEEN ? AND ?
      GROUP BY g.pagamento
      ORDER BY total DESC
    `).bind(dataInicio, dataFim).all(),
    db.prepare(`
      SELECT DISTINCT CAST(strftime('%Y', data) AS INTEGER) as ano
      FROM gastos
      ORDER BY ano DESC
    `).all()
  ]);

  const anosDisponiveis = anosR.results.map(r => r.ano);
  if (!anosDisponiveis.includes(currentYear)) anosDisponiveis.unshift(currentYear);

  return {
    porCategoria: porCatR.results,
    porMes: porMesR.results,
    porPagamento: porPagR.results,
    filters: { ano: anoParam, mesInicio: mesInicioParam, mesFim: mesFimParam },
    anosDisponiveis
  };
}
