// +page.server.js

export async function load({ platform, url }) {
  const db = platform?.env?.DB;

  const dataInicio = url.searchParams.get('dataInicio') || '2025-01-01';
  const dataFim = url.searchParams.get('dataFim') || new Date().toISOString().split('T')[0];
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const search = url.searchParams.get('search') || '';

  if (!db) {
    return {
      gastos: [],
      categorias: [],
      subcategorias: [],
      itens: [],
      filters: { dataInicio, dataFim, limit, search }
    };
  }

  // Corrigido para os nomes corretos do schema: id_item, id_subcategoria, id_categoria, nome_item, etc.
  let q = `
    SELECT g.id, g.compra_id, g.data, g.parcelas, g.tipo, g.pagamento, g.valor, g.comentario,
           i.id as item_id, i.nome_item as item_nome,
           s.id as subcategoria_id, s.nome_subcategoria as subcategoria_nome,
           c.id as categoria_id, c.nome_categoria as categoria_nome
    FROM gastos g
    LEFT JOIN itens i ON g.id_item = i.id
    LEFT JOIN subcategorias s ON g.id_subcategoria = s.id
    LEFT JOIN categorias c ON g.id_categoria = c.id
    WHERE g.data BETWEEN ? AND ?
  `;
  const params = [dataInicio, dataFim];

  if (search) {
    q += ` AND (i.nome_item LIKE ? OR s.nome_subcategoria LIKE ? OR c.nome_categoria LIKE ? OR g.comentario LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  q += ` ORDER BY g.data DESC, g.id DESC LIMIT ?`;
  params.push(limit);

  // Consultas auxiliares adaptadas para mapear (alias) os nomes das colunas e manter a compatibilidade com o front-end Svelte
  const [gastosR, catsR, subcatsR, itensR] = await Promise.all([
    db.prepare(q).bind(...params).all(),
    db.prepare('SELECT id, nome_categoria as nome FROM categorias ORDER BY nome_categoria').all(),
    db.prepare(`
      SELECT s.id, s.id_categoria as categoria_id, s.nome_subcategoria as nome, c.nome_categoria as categoria_nome
      FROM subcategorias s
      JOIN categorias c ON s.id_categoria = c.id
      ORDER BY c.nome_categoria, s.nome_subcategoria
    `).all(),
    db.prepare(`
      SELECT i.id, i.nome_item as nome, i.id_subcategoria as subcategoria_id, s.nome_subcategoria as subcategoria_nome, s.id_categoria as categoria_id, c.nome_categoria as categoria_nome
      FROM itens i
      JOIN subcategorias s ON i.id_subcategoria = s.id
      JOIN categorias c ON s.id_categoria = c.id
      ORDER BY i.nome_item
    `).all()
  ]);

  return {
    gastos: gastosR.results,
    categorias: catsR.results,
    subcategorias: subcatsR.results,
    itens: itensR.results,
    filters: { dataInicio, dataFim, limit, search }
  };
}

export const actions = {
  addCompra: async ({ request, platform }) => {
    const db = platform?.env?.DB;
    if (!db) return { error: 'DB indisponível' };

    const fd = await request.formData();
    const data = fd.get('data');
    const parcelas = parseInt(fd.get('parcelas'));
    const tipo = fd.get('tipo');
    const pagamento = fd.get('pagamento');
    const itens = JSON.parse(fd.get('itens'));

    const maxRow = await db.prepare('SELECT MAX(compra_id) as mx FROM gastos').first();
    const compraId = ((maxRow?.mx) || 0) + 1;

    // Adicionada a validação para categoria e subcategoria, exigidos pelo banco (NOT NULL)
    const valid = itens.filter(i => i.item_id && i.valor && i.categoria_id && i.subcategoria_id);
    if (!valid.length) return { error: 'Nenhum item válido ou dados hierárquicos faltando' };

    const stmts = valid.map(i =>
      db.prepare(
        'INSERT INTO gastos (compra_id, data, parcelas, tipo, pagamento, id_item, id_categoria, id_subcategoria, valor, comentario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        compraId, data, parcelas, tipo, pagamento, 
        i.item_id, i.categoria_id, i.subcategoria_id, 
        parseFloat(i.valor), i.comentario || null
      )
    );

    await db.batch(stmts);
    return { success: true };
  },

  deleteGasto: async ({ request, platform }) => {
    const db = platform?.env?.DB;
    if (!db) return { error: 'DB indisponível' };
    const fd = await request.formData();
    await db.prepare('DELETE FROM gastos WHERE id = ?').bind(fd.get('id')).run();
    return { success: true };
  },

  updateGasto: async ({ request, platform }) => {
    const db = platform?.env?.DB;
    if (!db) return { error: 'DB indisponível' };
    const fd = await request.formData();
    await db.prepare(
      'UPDATE gastos SET data=?, parcelas=?, tipo=?, pagamento=?, id_item=?, id_categoria=?, id_subcategoria=?, valor=?, comentario=? WHERE id=?'
    ).bind(
      fd.get('data'),
      parseInt(fd.get('parcelas')),
      fd.get('tipo'),
      fd.get('pagamento'),
      fd.get('item_id'),
      fd.get('categoria_id'),
      fd.get('subcategoria_id'),
      parseFloat(fd.get('valor')),
      fd.get('comentario') || null,
      fd.get('id')
    ).run();
    return { success: true };
  },

  addCategoria: async ({ request, platform }) => {
    const db = platform?.env?.DB;
    if (!db) return { error: 'DB indisponível' };
    const fd = await request.formData();
    const nome = fd.get('nome')?.toString().trim();
    if (!nome) return { error: 'Nome obrigatório' };
    await db.prepare('INSERT INTO categorias (nome_categoria) VALUES (?)').bind(nome).run();
    return { success: true };
  },

  deleteCategoria: async ({ request, platform }) => {
    const db = platform?.env?.DB;
    if (!db) return { error: 'DB indisponível' };
    const fd = await request.formData();
    await db.prepare('DELETE FROM categorias WHERE id = ?').bind(fd.get('id')).run();
    return { success: true };
  },

  addSubcategoria: async ({ request, platform }) => {
    const db = platform?.env?.DB;
    if (!db) return { error: 'DB indisponível' };
    const fd = await request.formData();
    const nome = fd.get('nome')?.toString().trim();
    if (!nome) return { error: 'Nome obrigatório' };
    await db.prepare('INSERT INTO subcategorias (nome_subcategoria, id_categoria) VALUES (?, ?)').bind(nome, fd.get('categoria_id')).run();
    return { success: true };
  },

  deleteSubcategoria: async ({ request, platform }) => {
    const db = platform?.env?.DB;
    if (!db) return { error: 'DB indisponível' };
    const fd = await request.formData();
    await db.prepare('DELETE FROM subcategorias WHERE id = ?').bind(fd.get('id')).run();
    return { success: true };
  },

  addItem: async ({ request, platform }) => {
    const db = platform?.env?.DB;
    if (!db) return { error: 'DB indisponível' };
    const fd = await request.formData();
    const nome = fd.get('nome')?.toString().trim();
    if (!nome) return { error: 'Nome obrigatório' };
    await db.prepare('INSERT INTO itens (nome_item, id_subcategoria) VALUES (?, ?)').bind(nome, fd.get('subcategoria_id')).run();
    return { success: true };
  },

  deleteItem: async ({ request, platform }) => {
    const db = platform?.env?.DB;
    if (!db) return { error: 'DB indisponível' };
    const fd = await request.formData();
    await db.prepare('DELETE FROM itens WHERE id = ?').bind(fd.get('id')).run();
    return { success: true };
  }
};