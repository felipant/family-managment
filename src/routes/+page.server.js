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

    const stmts = [];
    for (const i of valid) {
      const valorTotal = parseFloat(i.valor);
      if (parcelas > 1) {
        const valorBase = Math.floor((valorTotal / parcelas) * 100) / 100;
        const valorUltima = Math.round((valorTotal - valorBase * (parcelas - 1)) * 100) / 100;
        for (let p = 0; p < parcelas; p++) {
          const d = new Date(data);
          d.setMonth(d.getMonth() + p);
          const dataStr = d.toISOString().split('T')[0];
          const valorParcela = p === parcelas - 1 ? valorUltima : valorBase;
          const comment = `${i.comentario ? i.comentario + ' ' : ''}(${p + 1}/${parcelas})`;
          stmts.push(
            db.prepare(
              'INSERT INTO gastos (compra_id, data, parcelas, tipo, pagamento, id_item, id_categoria, id_subcategoria, valor, comentario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(compraId, dataStr, parcelas, tipo, pagamento, i.item_id, i.categoria_id, i.subcategoria_id, valorParcela, comment)
          );
        }
      } else {
        stmts.push(
          db.prepare(
            'INSERT INTO gastos (compra_id, data, parcelas, tipo, pagamento, id_item, id_categoria, id_subcategoria, valor, comentario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(compraId, data, parcelas, tipo, pagamento, i.item_id, i.categoria_id, i.subcategoria_id, valorTotal, i.comentario || null)
        );
      }
    }

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
  },

  importCSV: async ({ request, platform }) => {
    const db = platform?.env?.DB;
    if (!db) return { error: 'DB indisponível' };

    const fd = await request.formData();
    const file = fd.get('csvFile');
    if (!file || typeof file === 'string') return { error: 'Arquivo CSV não enviado' };

    // Read file with encoding detection: try UTF-8 first, fallback to windows-1252 (common in Brazilian Excel CSVs)
    const rawBytes = await file.arrayBuffer();
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(rawBytes);
    } catch {
      // UTF-8 failed, try windows-1252 (covers Latin-1, common for PT-BR CSVs from Excel)
      text = new TextDecoder('windows-1252').decode(rawBytes);
    }
    text = text.replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { error: 'Arquivo CSV vazio ou sem dados' };

    // Parse header - normalize accented characters for column matching
    const normalizeCol = (s) => s.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const header = lines[0].split(',').map(normalizeCol);
    const colIdx = {
      data: header.indexOf('data'),
      valor: header.indexOf('valor'),
      parcelas: header.indexOf('parcelas'),
      categoria: header.indexOf('categoria'),
      subcategoria: header.indexOf('subcategoria'),
      item: header.indexOf('item'),
      tipo: header.indexOf('tipo'),
      comentario: header.indexOf('comentario'),
      pagamento: header.indexOf('pagamento')
    };

    // Validate required columns
    if (colIdx.categoria === -1 || colIdx.subcategoria === -1 || colIdx.item === -1) {
      return { error: 'CSV deve conter colunas: categoria, subcategoria, item' };
    }
    if (colIdx.data === -1 || colIdx.valor === -1) {
      return { error: 'CSV deve conter colunas: data, valor' };
    }

    // Normalize pagamento and tipo values
    const normalizePagamento = (val) => {
      if (!val) return 'Pix';
      const lower = val.trim().toLowerCase();
      const map = { 'credito': 'Crédito', 'crédito': 'Crédito', 'debito': 'Débito', 'débito': 'Débito', 'pix': 'Pix', 'dinheiro': 'Dinheiro' };
      return map[lower] || 'Pix';
    };

    const normalizeTipo = (val) => {
      if (!val) return 'variável';
      const lower = val.trim().toLowerCase();
      if (lower === 'fixo') return 'fixo';
      if (lower === 'variavel' || lower === 'variável') return 'variável';
      return 'variável';
    };

    // Parse date from DD/MM/YYYY to YYYY-MM-DD
    const parseDate = (val) => {
      if (!val) return new Date().toISOString().split('T')[0];
      const trimmed = val.trim();
      // Try DD/MM/YYYY
      const parts = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (parts) {
        return `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      }
      // Already YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      return new Date().toISOString().split('T')[0];
    };

    // Parse CSV value (handle commas inside quotes)
    const parseCSVLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    };

    // Cache for categories, subcategories, items to avoid duplicate lookups
    const catCache = {};    // nome -> id
    const subcatCache = {}; // `${catId}-${nome}` -> id
    const itemCache = {};   // `${subcatId}-${nome}` -> id

    // Pre-load existing data
    const existingCats = (await db.prepare('SELECT id, nome_categoria FROM categorias').all()).results;
    for (const c of existingCats) {
      catCache[c.nome_categoria.toLowerCase()] = c.id;
    }

    const existingSubs = (await db.prepare('SELECT id, nome_subcategoria, id_categoria FROM subcategorias').all()).results;
    for (const s of existingSubs) {
      subcatCache[`${s.id_categoria}-${s.nome_subcategoria.toLowerCase()}`] = s.id;
    }

    const existingItems = (await db.prepare('SELECT id, nome_item, id_subcategoria FROM itens').all()).results;
    for (const it of existingItems) {
      itemCache[`${it.id_subcategoria}-${it.nome_item.toLowerCase()}`] = it.id;
    }

    // Helper: get or create category
    async function getOrCreateCategoria(nome) {
      const key = nome.toLowerCase();
      if (catCache[key]) return catCache[key];
      await db.prepare('INSERT INTO categorias (nome_categoria) VALUES (?)').bind(nome).run();
      const row = await db.prepare('SELECT id FROM categorias WHERE nome_categoria = ?').bind(nome).first();
      catCache[key] = row.id;
      return row.id;
    }

    // Helper: get or create subcategoria
    async function getOrCreateSubcategoria(nome, categoriaId) {
      const key = `${categoriaId}-${nome.toLowerCase()}`;
      if (subcatCache[key]) return subcatCache[key];
      await db.prepare('INSERT INTO subcategorias (nome_subcategoria, id_categoria) VALUES (?, ?)').bind(nome, categoriaId).run();
      const row = await db.prepare('SELECT id FROM subcategorias WHERE nome_subcategoria = ? AND id_categoria = ?').bind(nome, categoriaId).first();
      subcatCache[key] = row.id;
      return row.id;
    }

    // Helper: get or create item
    async function getOrCreateItem(nome, subcategoriaId) {
      const key = `${subcategoriaId}-${nome.toLowerCase()}`;
      if (itemCache[key]) return itemCache[key];
      await db.prepare('INSERT INTO itens (nome_item, id_subcategoria) VALUES (?, ?)').bind(nome, subcategoriaId).run();
      const row = await db.prepare('SELECT id FROM itens WHERE nome_item = ? AND id_subcategoria = ?').bind(nome, subcategoriaId).first();
      itemCache[key] = row.id;
      return row.id;
    }

    // Get next compra_id
    const maxRow = await db.prepare('SELECT MAX(compra_id) as mx FROM gastos').first();
    let compraId = ((maxRow?.mx) || 0) + 1;

    let imported = 0;
    let errors = [];

    for (let i = 1; i < lines.length; i++) {
      try {
        const cols = parseCSVLine(lines[i]);
        const catNome = cols[colIdx.categoria]?.trim();
        const subcatNome = cols[colIdx.subcategoria]?.trim();
        const itemNome = cols[colIdx.item]?.trim();
        const valor = parseFloat(cols[colIdx.valor]?.replace(',', '.')) || 0;
        const data = parseDate(cols[colIdx.data]);
        const parcelas = parseInt(cols[colIdx.parcelas]) || 1;
        const tipo = normalizeTipo(cols[colIdx.tipo]);
        const pagamento = normalizePagamento(cols[colIdx.pagamento]);
        const comentario = colIdx.comentario !== -1 ? (cols[colIdx.comentario]?.trim() || null) : null;

        if (!catNome || !subcatNome || !itemNome || valor <= 0) {
          errors.push(`Linha ${i + 1}: dados incompletos`);
          continue;
        }

        // Get or create hierarchy
        const catId = await getOrCreateCategoria(catNome);
        const subcatId = await getOrCreateSubcategoria(subcatNome, catId);
        const itemId = await getOrCreateItem(itemNome, subcatId);

        // Insert gasto(s) with installment logic
        if (parcelas > 1) {
          const valorBase = Math.floor((valor / parcelas) * 100) / 100;
          const valorUltima = Math.round((valor - valorBase * (parcelas - 1)) * 100) / 100;
          for (let p = 0; p < parcelas; p++) {
            const d = new Date(data);
            d.setMonth(d.getMonth() + p);
            const dataStr = d.toISOString().split('T')[0];
            const valorParcela = p === parcelas - 1 ? valorUltima : valorBase;
            const comment = `${comentario ? comentario + ' ' : ''}(${p + 1}/${parcelas})`;
            await db.prepare(
              'INSERT INTO gastos (compra_id, data, parcelas, tipo, pagamento, id_item, id_categoria, id_subcategoria, valor, comentario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(compraId, dataStr, parcelas, tipo, pagamento, itemId, catId, subcatId, valorParcela, comment).run();
          }
        } else {
          await db.prepare(
            'INSERT INTO gastos (compra_id, data, parcelas, tipo, pagamento, id_item, id_categoria, id_subcategoria, valor, comentario) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(compraId, data, parcelas, tipo, pagamento, itemId, catId, subcatId, valor, comentario).run();
        }

        compraId++;
        imported++;
      } catch (err) {
        errors.push(`Linha ${i + 1}: ${err.message || 'erro desconhecido'}`);
      }
    }

    return {
      success: true,
      imported,
      total: lines.length - 1,
      errors: errors.length > 0 ? errors.slice(0, 10) : []
    };
  }
};