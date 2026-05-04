<script lang="ts">
  import { enhance } from '$app/forms';

  let { data } = $props();

  const todayDate = new Date().toISOString().split('T')[0];

  // ── Modal visibility ──────────────────────────────────────────────────────
  let showAddCompra = $state(false);
  let showManageCat = $state(false);
  let editGasto = $state<any>(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  let fDataInicio = $state(data.filters.dataInicio);
  let fDataFim    = $state(data.filters.dataFim);
  let fSearch     = $state(data.filters.search);
  let fLimit      = $state(data.filters.limit);

  // ── ADD COMPRA ────────────────────────────────────────────────────────────
  let cDate      = $state(todayDate);
  let cParcelas  = $state(1);
  let cTipo      = $state('variável');
  let cPagamento = $state('Crédito');

  // Adicionado propriedades de hierarquia categoria_id e subcategoria_id
  interface CItem {
    item_id: number | null;
    categoria_id: number | null;
    subcategoria_id: number | null;
    item_nome: string;
    valor: string;
    subcategoria_nome: string;
    categoria_nome: string;
    comentario: string;
    results: any[];
    open: boolean;
  }

  function newCI(): CItem {
    return {
      item_id: null, categoria_id: null, subcategoria_id: null, item_nome: '', valor: '',
      subcategoria_nome: '', categoria_nome: '',
      comentario: '', results: [], open: false
    };
  }

  let cItens = $state<CItem[]>([newCI()]);

  let totalCompra  = $derived(cItens.reduce((s, i) => s + (parseFloat(i.valor) || 0), 0));
  
  // Garantir envio dos ids de categoria e subcategoria pelo payload JSON
  let itensPayload = $derived(JSON.stringify(
    cItens.map(i => ({ 
      item_id: i.item_id, 
      categoria_id: i.categoria_id, 
      subcategoria_id: i.subcategoria_id, 
      valor: i.valor, 
      comentario: i.comentario 
    }))
  ));

  function searchCI(idx: number, q: string) {
    cItens[idx].item_nome = q;
    cItens[idx].item_id = null;
    cItens[idx].categoria_id = null;
    cItens[idx].subcategoria_id = null;
    cItens[idx].subcategoria_nome = '';
    cItens[idx].categoria_nome = '';
    if (!q.trim()) { cItens[idx].results = []; cItens[idx].open = false; return; }
    cItens[idx].results = (data.itens as any[])
      .filter(i => i.nome.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 30);
    cItens[idx].open = cItens[idx].results.length > 0;
  }

  function pickCI(idx: number, item: any) {
    cItens[idx].item_id = item.id;
    cItens[idx].categoria_id = item.categoria_id;
    cItens[idx].subcategoria_id = item.subcategoria_id;
    cItens[idx].item_nome = item.nome;
    cItens[idx].subcategoria_nome = item.subcategoria_nome;
    cItens[idx].categoria_nome = item.categoria_nome;
    cItens[idx].results = [];
    cItens[idx].open = false;
  }

  function addCompraItem() { cItens = [...cItens, newCI()]; }

  function removeCompraItem(idx: number) {
    cItens = cItens.filter((_, i) => i !== idx);
  }

  function resetCompra() {
    cDate = todayDate; cParcelas = 1; cTipo = 'variável'; cPagamento = 'Crédito';
    cItens = [newCI()];
    showAddCompra = false;
  }

  // ── EDIT GASTO ────────────────────────────────────────────────────────────
  let editItemSearch  = $state('');
  let editItemResults = $state<any[]>([]);
  let editItemOpen    = $state(false);

  function openEdit(g: any) {
    editGasto = { ...g };
    editItemSearch = g.item_nome || '';
    editItemOpen = false;
    editItemResults = [];
  }

  function searchEditItem(q: string) {
    editItemSearch = q;
    if (editGasto) {
      editGasto.item_id = null;
      editGasto.categoria_id = null;
      editGasto.subcategoria_id = null;
    }
    if (!q.trim()) { editItemResults = []; editItemOpen = false; return; }
    editItemResults = (data.itens as any[])
      .filter(i => i.nome.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 30);
    editItemOpen = editItemResults.length > 0;
  }

  function pickEditItem(item: any) {
    editItemSearch = item.nome;
    editItemOpen = false;
    editItemResults = [];
    if (editGasto) {
      editGasto.item_id = item.id;
      editGasto.categoria_id = item.categoria_id;
      editGasto.subcategoria_id = item.subcategoria_id;
      editGasto.item_nome = item.nome;
      editGasto.subcategoria_nome = item.subcategoria_nome;
      editGasto.categoria_nome = item.categoria_nome;
    }
  }

  // ── CATEGORY MANAGEMENT ───────────────────────────────────────────────────
  let catExpanded   = $state<Record<number, boolean>>({});
  let subcatExpanded = $state<Record<number, boolean>>({});
  let newCatName    = $state('');
  let newSubcatData = $state<Record<number, string>>({});
  let newItemData   = $state<Record<number, string>>({});

  let subcatsByCategoria = $derived(
    (data.categorias as any[]).reduce((acc: Record<number, any[]>, cat: any) => {
      acc[cat.id] = (data.subcategorias as any[]).filter(s => s.categoria_id === cat.id);
      return acc;
    }, {})
  );

  let itensBySubcat = $derived(
    (data.subcategorias as any[]).reduce((acc: Record<number, any[]>, sub: any) => {
      acc[sub.id] = (data.itens as any[]).filter(i => i.subcategoria_id === sub.id);
      return acc;
    }, {})
  );

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmt(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function fmtDate(d: string) {
    if (!d) return '—';
    const [y, m, dd] = d.split('-');
    return `${dd}/${m}/${y}`;
  }

  let gastosTotal = $derived((data.gastos as any[]).reduce((s: number, g: any) => s + (g.valor || 0), 0));

  const PARCELAS_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
  const TIPOS = ['variável', 'fixo', 'eventual'];
  const PAGAMENTOS = ['Crédito', 'Débito', 'Pix', 'Dinheiro'];
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap" rel="stylesheet" />
</svelte:head>

<div class="app">

  <!-- ══ HEADER ══════════════════════════════════════════════════════════════ -->
  <header class="header">
    <div class="header-inner">
      <div class="brand">
        <div class="brand-icon">₿</div>
        <div class="brand-text">
          <h1>Finanças</h1>
          <p>Controle familiar de gastos</p>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" onclick={() => showAddCompra = true}>
          <span class="btn-icon">+</span> Adicionar Compra
        </button>
        <button class="btn btn-outline" onclick={() => showManageCat = true}>
          <span class="btn-icon">⊞</span> Gerenciar Categorias
        </button>
      </div>
    </div>
  </header>

  <!-- ══ MAIN ════════════════════════════════════════════════════════════════ -->
  <main class="main">

    <!-- Filters bar -->
    <form method="get" class="filters-bar">
      <div class="filter-group">
        <label class="filter-label">De</label>
        <input class="filter-input" type="date" name="dataInicio" bind:value={fDataInicio} />
      </div>
      <div class="filter-group">
        <label class="filter-label">Até</label>
        <input class="filter-input" type="date" name="dataFim" bind:value={fDataFim} />
      </div>
      <div class="filter-group filter-search">
        <label class="filter-label">Pesquisar</label>
        <input class="filter-input" type="text" name="search" bind:value={fSearch} placeholder="categoria, item, comentário..." />
      </div>
      <div class="filter-group">
        <label class="filter-label">Linhas</label>
        <select class="filter-input" name="limit" bind:value={fLimit}>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
      </div>
      <button type="submit" class="btn btn-filter">Filtrar</button>
    </form>

    <!-- Table summary bar -->
    <div class="summary-bar">
      <span class="summary-count">{data.gastos.length} registros encontrados</span>
      <span class="summary-total">Total: <strong>{fmt(gastosTotal)}</strong></span>
    </div>

    <!-- Data table -->
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Item</th>
            <th>Subcategoria</th>
            <th>Categoria</th>
            <th class="right">Valor</th>
            <th>Tipo</th>
            <th>Pagamento</th>
            <th class="center">Parcelas</th>
            <th>Comentário</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each data.gastos as g (g.id)}
            <tr class="data-row" onclick={() => openEdit(g)}>
              <td class="date-cell">{fmtDate(g.data)}</td>
              <td class="item-cell">{g.item_nome || '—'}</td>
              <td class="muted-cell">{g.subcategoria_nome || '—'}</td>
              <td>
                {#if g.categoria_nome}
                  <span class="badge">{g.categoria_nome}</span>
                {:else}
                  <span class="muted-cell">—</span>
                {/if}
              </td>
              <td class="value-cell">{fmt(g.valor)}</td>
              <td><span class="tipo-pill tipo-{g.tipo}">{g.tipo}</span></td>
              <td class="muted-cell">{g.pagamento || '—'}</td>
              <td class="center">{g.parcelas}×</td>
              <td class="comment-cell">{g.comentario || '—'}</td>
              <td class="delete-cell">
                <form method="post" action="?/deleteGasto"
                  use:enhance={() => async ({ update }) => { await update(); }}>
                  <input type="hidden" name="id" value={g.id} />
                  <button type="submit" class="btn-delete"
                    onclick={(e) => {
                      e.stopPropagation();
                      if (!confirm(`Excluir "${g.item_nome}" (${fmt(g.valor)})?`)) e.preventDefault();
                    }}>✕</button>
                </form>
              </td>
            </tr>
          {:else}
            <tr>
              <td colspan="10" class="empty-row">
                Nenhum gasto encontrado para o período e filtros selecionados.
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </main>
</div>


<!-- ════════════════════════════════════════════════════════════════════════════
     MODAL: ADICIONAR COMPRA
     ════════════════════════════════════════════════════════════════════════════ -->
{#if showAddCompra}
  <div class="overlay" role="dialog" aria-modal="true" onclick={() => showAddCompra = false}>
    <div class="modal modal-xl" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title">Nova Compra</h2>
        <button class="modal-close" onclick={resetCompra}>✕</button>
      </div>

      <form method="post" action="?/addCompra"
        use:enhance={() => async ({ result, update }) => {
          if (result.type === 'success') { resetCompra(); }
          await update();
        }}>
        <input type="hidden" name="itens" value={itensPayload} />

        <div class="modal-body">
          <!-- Common fields row -->
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Data</label>
              <input class="form-input" type="date" name="data" bind:value={cDate} required />
            </div>
            <div class="form-group">
              <label class="form-label">Parcelas</label>
              <select class="form-input" name="parcelas" bind:value={cParcelas}>
                {#each PARCELAS_OPTIONS as n}
                  <option value={n}>{n}×</option>
                {/each}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tipo</label>
              <select class="form-input" name="tipo" bind:value={cTipo}>
                {#each TIPOS as t}<option>{t}</option>{/each}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Pagamento</label>
              <select class="form-input" name="pagamento" bind:value={cPagamento}>
                {#each PAGAMENTOS as p}<option>{p}</option>{/each}
              </select>
            </div>
          </div>

          <!-- Divider -->
          <div class="section-divider">
            <span>Itens da compra</span>
            <button type="button" class="btn-add-row" onclick={addCompraItem}>+ Adicionar linha</button>
          </div>

          <!-- Item rows -->
          <div class="items-grid">
            <div class="items-grid-header">
              <span style="flex:2">Item</span>
              <span style="flex:1">Valor (R$)</span>
              <span style="flex:1.2">Subcategoria</span>
              <span style="flex:1.2">Categoria</span>
              <span style="flex:1.5">Comentário</span>
              <span style="width:28px"></span>
            </div>

            {#each cItens as ci, idx}
              <div class="item-line">
                <!-- Item search -->
                <div class="item-field" style="flex:2; position:relative;">
                  <input
                    class="form-input"
                    type="text"
                    placeholder="Pesquisar item..."
                    value={ci.item_nome}
                    oninput={(e) => searchCI(idx, e.currentTarget.value)}
                    onblur={() => setTimeout(() => { cItens[idx].open = false; }, 180)}
                    autocomplete="off"
                  />
                  {#if ci.open && ci.results.length > 0}
                    <div class="dropdown">
                      {#each ci.results as r}
                        <button type="button" class="dropdown-item"
                          onmousedown={() => pickCI(idx, r)}>
                          <span class="di-nome">{r.nome}</span>
                          <span class="di-sub">{r.subcategoria_nome} › {r.categoria_nome}</span>
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>

                <!-- Valor -->
                <div class="item-field" style="flex:1">
                  <input class="form-input" type="number" step="0.01" min="0"
                    placeholder="0,00" bind:value={ci.valor} />
                </div>

                <!-- Subcategoria (auto) -->
                <div class="item-field" style="flex:1.2">
                  <input class="form-input readonly-input" type="text"
                    readonly value={ci.subcategoria_nome} placeholder="—" />
                </div>

                <!-- Categoria (auto) -->
                <div class="item-field" style="flex:1.2">
                  <input class="form-input readonly-input" type="text"
                    readonly value={ci.categoria_nome} placeholder="—" />
                </div>

                <!-- Comentário -->
                <div class="item-field" style="flex:1.5">
                  <input class="form-input" type="text"
                    placeholder="Opcional..." bind:value={ci.comentario} />
                </div>

                <!-- Remove -->
                <div style="display:flex;align-items:center;width:28px">
                  {#if cItens.length > 1}
                    <button type="button" class="btn-rm-line"
                      onclick={() => removeCompraItem(idx)}>✕</button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>

          <!-- Total -->
          <div class="compra-total">
            <span>Total da compra</span>
            <strong class="total-value">{fmt(totalCompra)}</strong>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" onclick={resetCompra}>Cancelar</button>
          <button type="submit" class="btn btn-primary"
            onclick={(e) => {
              const hasValid = cItens.some(i => i.item_id && parseFloat(i.valor) > 0);
              if (!hasValid) {
                e.preventDefault();
                alert('Adicione pelo menos um item com nome selecionado e valor preenchido.');
                return;
              }
              if (!confirm(`Confirmar lançamento de ${fmt(totalCompra)}?`)) e.preventDefault();
            }}>
            ✓ Confirmar Compra
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}


<!-- ════════════════════════════════════════════════════════════════════════════
     MODAL: GERENCIAR CATEGORIAS
     ════════════════════════════════════════════════════════════════════════════ -->
{#if showManageCat}
  <div class="overlay" role="dialog" aria-modal="true" onclick={() => showManageCat = false}>
    <div class="modal modal-cat" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title">Gerenciar Categorias</h2>
        <button class="modal-close" onclick={() => showManageCat = false}>✕</button>
      </div>
      <div class="modal-body cat-manager">

        {#each data.categorias as cat (cat.id)}
          <div class="cat-card">
            <!-- Categoria row -->
            <div class="cat-row">
              <button type="button" class="expand-toggle"
                onclick={() => catExpanded[cat.id] = !catExpanded[cat.id]}>
                <span class="expand-icon">{catExpanded[cat.id] ? '▾' : '▸'}</span>
                <span class="cat-name">{cat.nome}</span>
                <span class="cat-count">{(subcatsByCategoria[cat.id] || []).length} subcategorias</span>
              </button>
              <form method="post" action="?/deleteCategoria"
                use:enhance={() => async ({ update }) => { await update(); }}>
                <input type="hidden" name="id" value={cat.id} />
                <button type="submit" class="btn-delete-sm"
                  onclick={(e) => {
                    if (!confirm(`Excluir categoria "${cat.nome}"? Isso pode afetar subcategorias e itens vinculados.`))
                      e.preventDefault();
                  }}>✕</button>
              </form>
            </div>

            {#if catExpanded[cat.id]}
              <div class="cat-children">
                {#each (subcatsByCategoria[cat.id] || []) as sub (sub.id)}
                  <div class="subcat-card">
                    <div class="subcat-row">
                      <button type="button" class="expand-toggle expand-toggle-sm"
                        onclick={() => subcatExpanded[sub.id] = !subcatExpanded[sub.id]}>
                        <span class="expand-icon">{subcatExpanded[sub.id] ? '▾' : '▸'}</span>
                        <span class="subcat-name">{sub.nome}</span>
                        <span class="cat-count">{(itensBySubcat[sub.id] || []).length} itens</span>
                      </button>
                      <form method="post" action="?/deleteSubcategoria"
                        use:enhance={() => async ({ update }) => { await update(); }}>
                        <input type="hidden" name="id" value={sub.id} />
                        <button type="submit" class="btn-delete-sm"
                          onclick={(e) => {
                            if (!confirm(`Excluir subcategoria "${sub.nome}"?`)) e.preventDefault();
                          }}>✕</button>
                      </form>
                    </div>

                    {#if subcatExpanded[sub.id]}
                      <div class="items-chips">
                        {#each (itensBySubcat[sub.id] || []) as item (item.id)}
                          <div class="item-chip">
                            <span>{item.nome}</span>
                            <form method="post" action="?/deleteItem"
                              use:enhance={() => async ({ update }) => { await update(); }}>
                              <input type="hidden" name="id" value={item.id} />
                              <button type="submit" class="chip-delete"
                                onclick={(e) => {
                                  if (!confirm(`Excluir item "${item.nome}"?`)) e.preventDefault();
                                }}>✕</button>
                            </form>
                          </div>
                        {/each}
                        <!-- Add item -->
                        <form method="post" action="?/addItem" class="inline-form"
                          use:enhance={() => async ({ result, update }) => {
                            if (result.type === 'success') newItemData[sub.id] = '';
                            await update();
                          }}>
                          <input type="hidden" name="subcategoria_id" value={sub.id} />
                          <input class="inline-input" type="text" name="nome"
                            bind:value={newItemData[sub.id]} placeholder="Novo item..." required />
                          <button type="submit" class="btn-inline-add">+</button>
                        </form>
                      </div>
                    {/if}
                  </div>
                {/each}

                <!-- Add subcategoria -->
                <form method="post" action="?/addSubcategoria" class="add-subcat-form"
                  use:enhance={() => async ({ result, update }) => {
                    if (result.type === 'success') newSubcatData[cat.id] = '';
                    await update();
                  }}>
                  <input type="hidden" name="categoria_id" value={cat.id} />
                  <input class="inline-input" type="text" name="nome"
                    bind:value={newSubcatData[cat.id]} placeholder="Nova subcategoria..." required />
                  <button type="submit" class="btn-inline-add">+</button>
                </form>
              </div>
            {/if}
          </div>
        {:else}
          <p class="cat-empty">Nenhuma categoria cadastrada ainda.</p>
        {/each}

        <!-- Add categoria -->
        <form method="post" action="?/addCategoria" class="add-cat-form"
          use:enhance={() => async ({ result, update }) => {
            if (result.type === 'success') newCatName = '';
            await update();
          }}>
          <input class="form-input" type="text" name="nome"
            bind:value={newCatName} placeholder="Nome da nova categoria..." required />
          <button type="submit" class="btn btn-primary btn-sm">+ Categoria</button>
        </form>
      </div>
    </div>
  </div>
{/if}


<!-- ════════════════════════════════════════════════════════════════════════════
     MODAL: EDITAR GASTO
     ════════════════════════════════════════════════════════════════════════════ -->
{#if editGasto}
  <div class="overlay" role="dialog" aria-modal="true" onclick={() => editGasto = null}>
    <div class="modal modal-edit" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title">Editar Gasto</h2>
        <button class="modal-close" onclick={() => editGasto = null}>✕</button>
      </div>

      <form method="post" action="?/updateGasto"
        use:enhance={() => async ({ result, update }) => {
          if (result.type === 'success') editGasto = null;
          await update();
        }}>
        <input type="hidden" name="id" value={editGasto.id} />
        <!-- Campos hierárquicos necessários para o update -->
        <input type="hidden" name="item_id" value={editGasto.item_id} />
        <input type="hidden" name="categoria_id" value={editGasto.categoria_id} />
        <input type="hidden" name="subcategoria_id" value={editGasto.subcategoria_id} />

        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Data</label>
              <input class="form-input" type="date" name="data" bind:value={editGasto.data} required />
            </div>
            <div class="form-group">
              <label class="form-label">Parcelas</label>
              <select class="form-input" name="parcelas" bind:value={editGasto.parcelas}>
                {#each PARCELAS_OPTIONS as n}<option value={n}>{n}×</option>{/each}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tipo</label>
              <select class="form-input" name="tipo" bind:value={editGasto.tipo}>
                {#each TIPOS as t}<option>{t}</option>{/each}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Pagamento</label>
              <select class="form-input" name="pagamento" bind:value={editGasto.pagamento}>
                {#each PAGAMENTOS as p}<option>{p}</option>{/each}
              </select>
            </div>
          </div>

          <div class="form-row">
            <!-- Item search -->
            <div class="form-group" style="flex:2; position:relative;">
              <label class="form-label">Item</label>
              <input
                class="form-input"
                type="text"
                value={editItemSearch}
                oninput={(e) => searchEditItem(e.currentTarget.value)}
                onblur={() => setTimeout(() => editItemOpen = false, 180)}
                placeholder="Pesquisar item..."
                autocomplete="off"
              />
              {#if editItemOpen && editItemResults.length > 0}
                <div class="dropdown">
                  {#each editItemResults as r}
                    <button type="button" class="dropdown-item"
                      onmousedown={() => pickEditItem(r)}>
                      <span class="di-nome">{r.nome}</span>
                      <span class="di-sub">{r.subcategoria_nome} › {r.categoria_nome}</span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
            <div class="form-group">
              <label class="form-label">Subcategoria</label>
              <input class="form-input readonly-input" type="text"
                readonly value={editGasto.subcategoria_nome || ''} />
            </div>
            <div class="form-group">
              <label class="form-label">Categoria</label>
              <input class="form-input readonly-input" type="text"
                readonly value={editGasto.categoria_nome || ''} />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Valor (R$)</label>
              <input class="form-input" type="number" step="0.01" name="valor"
                bind:value={editGasto.valor} required />
            </div>
            <div class="form-group" style="flex:2">
              <label class="form-label">Comentário</label>
              <input class="form-input" type="text" name="comentario"
                bind:value={editGasto.comentario} placeholder="Opcional..." />
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" onclick={() => editGasto = null}>Cancelar</button>
          <button type="submit" class="btn btn-primary"
            onclick={(e) => {
              if (!editGasto?.item_id) {
                e.preventDefault();
                alert('Selecione um item válido na lista de pesquisa.');
              }
            }}>
            ✓ Salvar alterações
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}


<style>
  /* ── Reset & tokens ────────────────────────────────────────────────────── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :global(body) {
    font-family: 'DM Sans', sans-serif;
    background: #f0f2f7;
    color: #1a1f36;
    min-height: 100vh;
  }

  /* ── App shell ────────────────────────────────────────────────────────── */
  .app { min-height: 100vh; display: flex; flex-direction: column; }

  /* ── Header ───────────────────────────────────────────────────────────── */
  .header {
    background: linear-gradient(135deg, #0f1535 0%, #1a2550 100%);
    border-bottom: 1px solid rgba(255,255,255,0.07);
    box-shadow: 0 2px 24px rgba(0,0,0,0.25);
  }
  .header-inner {
    max-width: 1400px;
    margin: 0 auto;
    padding: 18px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand-icon {
    width: 44px; height: 44px;
    background: linear-gradient(135deg, #10b981, #059669);
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; color: #fff;
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    box-shadow: 0 4px 12px rgba(16,185,129,0.4);
  }
  .brand-text h1 {
    font-family: 'Syne', sans-serif;
    font-size: 22px;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.5px;
  }
  .brand-text p { font-size: 12px; color: rgba(255,255,255,0.45); margin-top: 1px; }
  .header-actions { display: flex; gap: 10px; flex-wrap: wrap; }

  /* ── Buttons ──────────────────────────────────────────────────────────── */
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 10px 20px;
    border: none; border-radius: 10px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px; font-weight: 500;
    cursor: pointer;
    transition: all 0.18s ease;
    white-space: nowrap;
  }
  .btn-icon { font-size: 16px; font-weight: 400; }
  .btn-primary {
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff;
    box-shadow: 0 4px 12px rgba(16,185,129,0.3);
  }
  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(16,185,129,0.4);
  }
  .btn-outline {
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.85);
    border: 1px solid rgba(255,255,255,0.18);
    backdrop-filter: blur(4px);
  }
  .btn-outline:hover { background: rgba(255,255,255,0.15); }
  .btn-ghost {
    background: transparent;
    color: #64748b;
    border: 1px solid #e2e8f0;
  }
  .btn-ghost:hover { background: #f8fafc; color: #334155; }
  .btn-filter {
    background: #1a2550;
    color: #fff;
    align-self: flex-end;
    padding: 10px 22px;
    border-radius: 10px;
    border: none;
    font-family: 'DM Sans', sans-serif;
    font-weight: 500;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.18s;
  }
  .btn-filter:hover { background: #0f1535; }
  .btn-sm { padding: 8px 16px; font-size: 13px; }

  /* ── Main ─────────────────────────────────────────────────────────────── */
  .main {
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px 28px 40px;
    width: 100%;
    flex: 1;
  }

  /* ── Filters ──────────────────────────────────────────────────────────── */
  .filters-bar {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    flex-wrap: wrap;
    background: #fff;
    padding: 16px 20px;
    border-radius: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.06);
    margin-bottom: 16px;
  }
  .filter-group { display: flex; flex-direction: column; gap: 4px; }
  .filter-search { flex: 1; min-width: 200px; }
  .filter-label { font-size: 11px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
  .filter-input {
    padding: 9px 12px;
    border: 1.5px solid #e2e8f0;
    border-radius: 8px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    color: #1a1f36;
    background: #f8fafc;
    transition: border-color 0.15s;
    outline: none;
    min-width: 120px;
  }
  .filter-input:focus { border-color: #10b981; background: #fff; }

  /* ── Summary bar ──────────────────────────────────────────────────────── */
  .summary-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 4px;
    margin-bottom: 10px;
  }
  .summary-count { font-size: 13px; color: #94a3b8; }
  .summary-total { font-size: 14px; color: #1a1f36; }
  .summary-total strong { font-size: 18px; color: #059669; font-family: 'Syne', sans-serif; }

  /* ── Table ────────────────────────────────────────────────────────────── */
  .table-wrapper {
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.06);
    overflow: hidden;
  }
  .data-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .data-table thead tr {
    background: #f8fafc;
    border-bottom: 2px solid #e2e8f0;
  }
  .data-table th {
    padding: 12px 14px;
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }
  .data-table th.right { text-align: right; }
  .data-table th.center { text-align: center; }
  .data-row {
    border-bottom: 1px solid #f1f5f9;
    cursor: pointer;
    transition: background 0.12s;
  }
  .data-row:hover { background: #f0fdf9; }
  .data-row td { padding: 11px 14px; vertical-align: middle; }
  .date-cell { white-space: nowrap; color: #64748b; font-size: 13px; }
  .item-cell { font-weight: 500; color: #1a1f36; }
  .muted-cell { color: #94a3b8; font-size: 13px; }
  .value-cell { text-align: right; font-weight: 600; color: #059669; font-family: 'Syne', sans-serif; white-space: nowrap; }
  .comment-cell { color: #94a3b8; font-size: 13px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .center { text-align: center; color: #64748b; }
  .delete-cell { width: 40px; text-align: center; }
  .empty-row { text-align: center; padding: 48px 20px; color: #94a3b8; font-size: 14px; }

  /* ── Badge & pills ────────────────────────────────────────────────────── */
  .badge {
    display: inline-block;
    padding: 3px 10px;
    background: #eff6ff;
    color: #3b82f6;
    border-radius: 20px;
    font-size: 11.5px;
    font-weight: 500;
    white-space: nowrap;
  }
  .tipo-pill {
    display: inline-block;
    padding: 3px 9px;
    border-radius: 20px;
    font-size: 11.5px;
    font-weight: 500;
    white-space: nowrap;
  }
  .tipo-variável { background: #fef3c7; color: #d97706; }
  .tipo-fixo     { background: #dbeafe; color: #2563eb; }
  .tipo-eventual { background: #fce7f3; color: #db2777; }

  /* ── Delete button ────────────────────────────────────────────────────── */
  .btn-delete {
    width: 28px; height: 28px;
    border-radius: 7px;
    border: none;
    background: transparent;
    color: #cbd5e1;
    font-size: 12px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
  }
  .btn-delete:hover { background: #fee2e2; color: #ef4444; }

  /* ── Overlay & modals ─────────────────────────────────────────────────── */
  .overlay {
    position: fixed; inset: 0;
    background: rgba(10, 15, 40, 0.6);
    backdrop-filter: blur(4px);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.18s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

  .modal {
    background: #fff;
    border-radius: 18px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.2);
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.22s ease;
    overflow: hidden;
  }
  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  .modal-xl   { max-width: 1100px; }
  .modal-cat  { max-width: 640px; }
  .modal-edit { max-width: 780px; }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 28px 18px;
    border-bottom: 1px solid #f1f5f9;
    flex-shrink: 0;
  }
  .modal-title {
    font-family: 'Syne', sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: #0f1535;
  }
  .modal-close {
    width: 34px; height: 34px;
    border-radius: 8px;
    border: none;
    background: #f1f5f9;
    color: #64748b;
    font-size: 14px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
  }
  .modal-close:hover { background: #fee2e2; color: #ef4444; }

  .modal-body {
    padding: 24px 28px;
    overflow-y: auto;
    flex: 1;
  }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 28px 20px;
    border-top: 1px solid #f1f5f9;
    flex-shrink: 0;
  }

  /* ── Forms ────────────────────────────────────────────────────────────── */
  .form-row {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    margin-bottom: 18px;
  }
  .form-group { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 120px; }
  .form-label { font-size: 11.5px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; }
  .form-input {
    padding: 10px 13px;
    border: 1.5px solid #e2e8f0;
    border-radius: 9px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    color: #1a1f36;
    background: #f8fafc;
    outline: none;
    transition: border-color 0.15s, background 0.15s;
    width: 100%;
  }
  .form-input:focus { border-color: #10b981; background: #fff; }
  .readonly-input { background: #f1f5f9; color: #94a3b8; cursor: default; }
  .readonly-input:focus { border-color: #e2e8f0; background: #f1f5f9; }

  /* ── Section divider ──────────────────────────────────────────────────── */
  .section-divider {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1.5px solid #f1f5f9;
    padding-top: 16px;
    margin-bottom: 14px;
  }
  .section-divider span {
    font-family: 'Syne', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: #475569;
  }
  .btn-add-row {
    padding: 7px 14px;
    background: #eff6ff;
    color: #3b82f6;
    border: 1.5px dashed #93c5fd;
    border-radius: 8px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-add-row:hover { background: #dbeafe; border-color: #3b82f6; }

  /* ── Items grid ───────────────────────────────────────────────────────── */
  .items-grid { display: flex; flex-direction: column; gap: 8px; }
  .items-grid-header {
    display: flex;
    gap: 8px;
    padding: 0 0 6px;
    border-bottom: 1.5px solid #f1f5f9;
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .item-line {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 10px;
    background: #f8fafc;
    border: 1.5px solid #e2e8f0;
    border-radius: 10px;
    transition: border-color 0.15s;
  }
  .item-line:hover { border-color: #cbd5e1; }
  .item-field { display: flex; flex-direction: column; }

  /* ── Dropdown ─────────────────────────────────────────────────────────── */
  .dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0; right: 0;
    background: #fff;
    border: 1.5px solid #e2e8f0;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    z-index: 200;
    max-height: 220px; /* shows ~4+ items */
    overflow-y: auto;
  }
  .dropdown-item {
    display: flex;
    flex-direction: column;
    gap: 1px;
    width: 100%;
    padding: 9px 12px;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    border-bottom: 1px solid #f8fafc;
    transition: background 0.1s;
  }
  .dropdown-item:hover { background: #f0fdf9; }
  .dropdown-item:last-child { border-bottom: none; }
  .di-nome { font-size: 13.5px; font-weight: 500; color: #1a1f36; }
  .di-sub  { font-size: 11.5px; color: #94a3b8; }

  /* ── Remove line ──────────────────────────────────────────────────────── */
  .btn-rm-line {
    width: 24px; height: 24px;
    border: none; border-radius: 6px;
    background: transparent; color: #cbd5e1;
    font-size: 11px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    margin-top: 28px;
    transition: all 0.15s;
  }
  .btn-rm-line:hover { background: #fee2e2; color: #ef4444; }

  /* ── Compra total ─────────────────────────────────────────────────────── */
  .compra-total {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 14px 16px;
    margin-top: 12px;
    background: linear-gradient(135deg, #f0fdf4, #dcfce7);
    border: 1.5px solid #86efac;
    border-radius: 10px;
  }
  .compra-total span { font-size: 14px; color: #166534; font-weight: 500; }
  .total-value { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; color: #15803d; }

  /* ── Category manager ─────────────────────────────────────────────────── */
  .cat-manager { display: flex; flex-direction: column; gap: 10px; }
  .cat-card {
    border: 1.5px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
    background: #fafbfc;
  }
  .cat-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    background: #fff;
  }
  .expand-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    padding: 0;
  }
  .expand-toggle-sm .cat-name { font-size: 13.5px; }
  .expand-icon { font-size: 12px; color: #94a3b8; width: 14px; }
  .cat-name { font-weight: 600; color: #1a1f36; font-size: 14.5px; }
  .cat-count { font-size: 11.5px; color: #94a3b8; margin-left: 4px; }
  .cat-children { padding: 8px 14px 12px 24px; display: flex; flex-direction: column; gap: 8px; }
  .subcat-card {
    border: 1.5px solid #e2e8f0;
    border-radius: 9px;
    background: #fff;
    overflow: hidden;
  }
  .subcat-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
  }
  .subcat-name { font-weight: 500; color: #334155; font-size: 13.5px; }
  .items-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 12px 10px 24px;
    border-top: 1px solid #f1f5f9;
  }
  .item-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px 4px 10px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 20px;
    font-size: 12.5px;
    color: #475569;
  }
  .chip-delete {
    width: 16px; height: 16px;
    border: none; background: transparent;
    color: #cbd5e1; font-size: 9px;
    cursor: pointer; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.12s;
    padding: 0;
  }
  .chip-delete:hover { background: #fee2e2; color: #ef4444; }
  .btn-delete-sm {
    width: 28px; height: 28px;
    border: none; border-radius: 7px;
    background: transparent; color: #cbd5e1;
    font-size: 11px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.14s;
    flex-shrink: 0;
  }
  .btn-delete-sm:hover { background: #fee2e2; color: #ef4444; }
  .inline-form {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .inline-input {
    padding: 5px 10px;
    border: 1.5px solid #e2e8f0;
    border-radius: 7px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    color: #1a1f36;
    background: #f8fafc;
    outline: none;
    width: 180px;
    transition: border-color 0.15s;
  }
  .inline-input:focus { border-color: #10b981; background: #fff; }
  .btn-inline-add {
    width: 28px; height: 28px;
    border: none; border-radius: 7px;
    background: #10b981; color: #fff;
    font-size: 18px; font-weight: 300;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
    flex-shrink: 0;
    line-height: 1;
  }
  .btn-inline-add:hover { background: #059669; }
  .add-subcat-form {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-top: 6px;
    border-top: 1px dashed #e2e8f0;
    margin-top: 2px;
  }
  .add-cat-form {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 14px 16px;
    background: #f8fafc;
    border: 1.5px dashed #cbd5e1;
    border-radius: 12px;
    margin-top: 4px;
  }
  .add-cat-form .form-input { flex: 1; }
  .cat-empty { color: #94a3b8; font-size: 13.5px; text-align: center; padding: 24px 0; }
</style>