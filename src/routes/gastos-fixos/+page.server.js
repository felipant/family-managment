// gastos-fixos/+page.server.js

export async function load({ platform }) {
  const db = platform?.env?.DB;

  if (!db) {
    return { gastos_fixos: [], categorias: [], subcategorias: [], itens: [] };
  }

  const [fixosR, catsR, subcatsR, itensR] = await Promise.all([
    db.prepare(`
      SELECT gf.id, gf.valor, gf.tipo, gf.pagamento, gf.comentario,
             i.id as item_id, i.nome_item as item_nome,
             s.id as subcategoria_id, s.nome_subcategoria as subcategoria_nome,
             c.id as categoria_id, c.nome_categoria as categoria_nome
      FROM gastos_fixos gf
      LEFT JOIN itens i ON gf.id_item = i.id
      LEFT JOIN subcategorias s ON gf.id_subcategoria = s.id
      LEFT JOIN categorias c ON gf.id_categoria = c.id
      ORDER BY c.nome_categoria, s.nome_subcategoria, i.nome_item
    `).all(),
    db.prepare('SELECT id, nome_categoria as nome FROM categorias ORDER BY nome_categoria').all(),
    db.prepare(`
      SELECT s.id, s.id_categoria as categoria_id, s.nome_subcategoria as nome, c.nome_categoria as categoria_nome
      FROM subcategorias s JOIN categorias c ON s.id_categoria = c.id
      ORDER BY c.nome_categoria, s.nome_subcategoria
    `).all(),
    db.prepare(`
      SELECT i.id, i.nome_item as nome, i.id_subcategoria as subcategoria_id,
             s.nome_subcategoria as subcategoria_nome, s.id_categoria as categoria_id,
             c.nome_categoria as categoria_nome
      FROM itens i
      JOIN subcategorias s ON i.id_subcategoria = s.id
      JOIN categorias c ON s.id_categoria = c.id
      ORDER BY i.nome_item
    `).all()
  ]);

  return {
    gastos_fixos: fixosR.results,
    categorias: catsR.results,
    subcategorias: subcatsR.results,
    itens: itensR.results
  };
}

export const actions = {
  addGastoFixo: async ({ request, platform }) => {
    const db = platform?.env?.DB;
    if (!db) return { error: 'DB indisponível' };

    const fd = await request.formData();
    const item_id        = fd.get('item_id');
    const categoria_id   = fd.get('categoria_id');
    const subcategoria_id = fd.get('subcategoria_id');
    const valor          = parseFloat(fd.get('valor'));
    const tipo           = fd.get('tipo');
    const pagamento      = fd.get('pagamento');
    const comentario     = fd.get('comentario') || null;

    if (!item_id || !valor || !categoria_id || !subcategoria_id) {
      return { error: 'Preencha todos os campos obrigatórios.' };
    }

    await db.prepare(
      'INSERT INTO gastos_fixos (id_item, id_categoria, id_subcategoria, valor, tipo, pagamento, comentario) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(item_id, categoria_id, subcategoria_id, valor, tipo, pagamento, comentario).run();

    return { success: true };
  },

  deleteGastoFixo: async ({ request, platform }) => {
    const db = platform?.env?.DB;
    if (!db) return { error: 'DB indisponível' };
    const fd = await request.formData();
    await db.prepare('DELETE FROM gastos_fixos WHERE id = ?').bind(fd.get('id')).run();
    return { success: true };
  },

  updateGastoFixo: async ({ request, platform }) => {
    const db = platform?.env?.DB;
    if (!db) return { error: 'DB indisponível' };
    const fd = await request.formData();
    await db.prepare(
      'UPDATE gastos_fixos SET id_item=?, id_categoria=?, id_subcategoria=?, valor=?, tipo=?, pagamento=?, comentario=? WHERE id=?'
    ).bind(
      fd.get('item_id'),
      fd.get('categoria_id'),
      fd.get('subcategoria_id'),
      parseFloat(fd.get('valor')),
      fd.get('tipo'),
      fd.get('pagamento'),
      fd.get('comentario') || null,
      fd.get('id')
    ).run();
    return { success: true };
  },

  lancarGastosFixos: async ({ request, platform }) => {
    const db = platform?.env?.DB;
    if (!db) return { error: 'DB indisponível' };

    const fd    = await request.formData();
    const mes   = fd.get('mes').toString().padStart(2, '0');
    const ano   = fd.get('ano');
    const data  = `${ano}-${mes}-01`;

    // Get all fixed expenses
    const fixosR = await db.prepare(
      'SELECT id, id_item, id_categoria, id_subcategoria, valor, tipo, pagamento, comentario FROM gastos_fixos'
    ).all();

    if (!fixosR.results.length) return { error: 'Nenhum gasto fixo cadastrado.' };

    // Get next compra_id
    const maxRow = await db.prepare('SELECT MAX(compra_id) as mx FROM gastos').first();
    const compraId = ((maxRow?.mx) || 0) + 1;

    const stmts = fixosR.results.map(f =>
      db.prepare(
        'INSERT INTO gastos (compra_id, data, parcelas, tipo, pagamento, id_item, id_categoria, id_subcategoria, valor, comentario) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(compraId, data, f.tipo, f.pagamento, f.id_item, f.id_categoria, f.id_subcategoria, f.valor, f.comentario)
    );

    await db.batch(stmts);
    return { success: true, count: fixosR.results.length, data };
  }
};