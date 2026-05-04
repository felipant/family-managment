<script lang="ts">
  import { enhance } from '$app/forms';

  let { data } = $props();

  const todayDate = new Date().toISOString().split('T')[0];

  let showAddCompra = $state(false);
  let showManageCat = $state(false);
  let editGasto     = $state<any>(null);

  // Filters
  let fDataInicio = $state(data.filters.dataInicio);
  let fDataFim    = $state(data.filters.dataFim);
  let fSearch     = $state(data.filters.search);
  let fLimit      = $state(data.filters.limit);

  // Add compra
  let cDate      = $state(todayDate);
  let cParcelas  = $state(1);
  let cTipo      = $state('variável');
  let cPagamento = $state('Crédito');

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
    return { item_id:null, categoria_id:null, subcategoria_id:null, item_nome:'', valor:'',
             subcategoria_nome:'', categoria_nome:'', comentario:'', results:[], open:false };
  }

  let cItens = $state<CItem[]>([newCI()]);

  let totalCompra  = $derived(cItens.reduce((s,i) => s + (parseFloat(i.valor)||0), 0));
  let itensPayload = $derived(JSON.stringify(
    cItens.map(i => ({ item_id:i.item_id, categoria_id:i.categoria_id, subcategoria_id:i.subcategoria_id, valor:i.valor, comentario:i.comentario }))
  ));

  function searchCI(idx: number, q: string) {
    cItens[idx].item_nome = q;
    cItens[idx].item_id = null; cItens[idx].categoria_id = null; cItens[idx].subcategoria_id = null;
    cItens[idx].subcategoria_nome = ''; cItens[idx].categoria_nome = '';
    if (!q.trim()) { cItens[idx].results=[]; cItens[idx].open=false; return; }
    cItens[idx].results = (data.itens as any[]).filter(i => i.nome.toLowerCase().includes(q.toLowerCase())).slice(0,30);
    cItens[idx].open = cItens[idx].results.length > 0;
  }

  function pickCI(idx: number, item: any) {
    cItens[idx].item_id = item.id; cItens[idx].categoria_id = item.categoria_id; cItens[idx].subcategoria_id = item.subcategoria_id;
    cItens[idx].item_nome = item.nome; cItens[idx].subcategoria_nome = item.subcategoria_nome;
    cItens[idx].categoria_nome = item.categoria_nome; cItens[idx].results=[]; cItens[idx].open=false;
  }

  function addCompraItem() { cItens = [...cItens, newCI()]; }
  function removeCompraItem(idx: number) { cItens = cItens.filter((_,i) => i !== idx); }
  function resetCompra() { cDate=todayDate; cParcelas=1; cTipo='variável'; cPagamento='Crédito'; cItens=[newCI()]; showAddCompra=false; }

  // Edit gasto
  let editItemSearch  = $state('');
  let editItemResults = $state<any[]>([]);
  let editItemOpen    = $state(false);

  function openEdit(g: any) {
    editGasto = {...g}; editItemSearch = g.item_nome||''; editItemOpen=false; editItemResults=[];
  }
  function searchEditItem(q: string) {
    editItemSearch = q;
    if (editGasto) { editGasto.item_id=null; editGasto.categoria_id=null; editGasto.subcategoria_id=null; }
    if (!q.trim()) { editItemResults=[]; editItemOpen=false; return; }
    editItemResults = (data.itens as any[]).filter(i => i.nome.toLowerCase().includes(q.toLowerCase())).slice(0,30);
    editItemOpen = editItemResults.length > 0;
  }
  function pickEditItem(item: any) {
    editItemSearch=item.nome; editItemOpen=false; editItemResults=[];
    if (editGasto) {
      editGasto.item_id=item.id; editGasto.categoria_id=item.categoria_id;
      editGasto.subcategoria_id=item.subcategoria_id; editGasto.item_nome=item.nome;
      editGasto.subcategoria_nome=item.subcategoria_nome; editGasto.categoria_nome=item.categoria_nome;
    }
  }

  // Category management
  let catExpanded    = $state<Record<number,boolean>>({});
  let subcatExpanded = $state<Record<number,boolean>>({});
  let newCatName     = $state('');
  let newSubcatData  = $state<Record<number,string>>({});
  let newItemData    = $state<Record<number,string>>({});

  let subcatsByCategoria = $derived(
    (data.categorias as any[]).reduce((acc: Record<number,any[]>, cat: any) => {
      acc[cat.id] = (data.subcategorias as any[]).filter(s => s.categoria_id === cat.id);
      return acc;
    }, {})
  );
  let itensBySubcat = $derived(
    (data.subcategorias as any[]).reduce((acc: Record<number,any[]>, sub: any) => {
      acc[sub.id] = (data.itens as any[]).filter(i => i.subcategoria_id === sub.id);
      return acc;
    }, {})
  );

  function fmt(v: number) { return v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); }
  function fmtDate(d: string) {
    if (!d) return '—';
    const [y,m,dd] = d.split('-');
    return `${dd}/${m}/${y}`;
  }

  let gastosTotal = $derived((data.gastos as any[]).reduce((s:number,g:any) => s + (g.valor||0), 0));

  const PARCELAS_OPTIONS = Array.from({length:12},(_,i)=>i+1);
  const TIPOS = ['variável','fixo'];
  const PAGAMENTOS = ['Crédito','Débito','Pix','Dinheiro'];
</script>

<div class="page">
  <!-- Header -->
  <header class="page-header">
    <div class="page-header-inner">
      <div class="page-title-wrap">
        <h1 class="page-title">Gastos</h1>
        <span class="page-subtitle">Lançamentos e histórico</span>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" onclick={() => showAddCompra = true}>
          <span>+</span> Adicionar Compra
        </button>
        <button class="btn btn-secondary" onclick={() => showManageCat = true}>
          <span>⊞</span> Gerenciar Categorias
        </button>
      </div>
    </div>
  </header>

  <main class="page-main">
    <!-- Filters -->
    <form method="get" class="filters-bar">
      <div class="filter-group">
        <label class="flabel">De</label>
        <input class="finput" type="date" name="dataInicio" bind:value={fDataInicio} />
      </div>
      <div class="filter-group">
        <label class="flabel">Até</label>
        <input class="finput" type="date" name="dataFim" bind:value={fDataFim} />
      </div>
      <div class="filter-group fg-grow">
        <label class="flabel">Pesquisar</label>
        <input class="finput" type="text" name="search" bind:value={fSearch} placeholder="categoria, item, comentário..." />
      </div>
      <div class="filter-group">
        <label class="flabel">Linhas</label>
        <select class="finput" name="limit" bind:value={fLimit}>
          <option value={20}>20</option><option value={50}>50</option>
          <option value={100}>100</option><option value={200}>200</option>
        </select>
      </div>
      <button type="submit" class="btn btn-filter">Filtrar</button>
    </form>

    <!-- Summary -->
    <div class="summary-bar">
      <span class="summary-count">{data.gastos.length} registros</span>
      <span class="summary-total">Total: <strong class="total-num">{fmt(gastosTotal)}</strong></span>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <table class="dtable">
        <thead>
          <tr>
            <th>Data</th><th>Item</th><th>Subcategoria</th><th>Categoria</th>
            <th class="tr">Valor</th><th>Tipo</th><th>Pagamento</th>
            <th class="tc">Parcelas</th><th>Comentário</th><th></th>
          </tr>
        </thead>
        <tbody>
          {#each data.gastos as g (g.id)}
            <tr class="drow" onclick={() => openEdit(g)}>
              <td class="td-date">{fmtDate(g.data)}</td>
              <td class="td-item">{g.item_nome || '—'}</td>
              <td class="td-muted">{g.subcategoria_nome || '—'}</td>
              <td>{#if g.categoria_nome}<span class="badge-cat">{g.categoria_nome}</span>{:else}<span class="td-muted">—</span>{/if}</td>
              <td class="td-val">{fmt(g.valor)}</td>
              <td><span class="pill pill-{g.tipo}">{g.tipo}</span></td>
              <td class="td-muted">{g.pagamento || '—'}</td>
              <td class="tc td-muted">{g.parcelas}×</td>
              <td class="td-comment">{g.comentario || '—'}</td>
              <td class="tc">
                <form method="post" action="?/deleteGasto"
                  use:enhance={() => async ({update}) => { await update(); }}>
                  <input type="hidden" name="id" value={g.id} />
                  <button type="submit" class="btn-del"
                    onclick={(e) => { e.stopPropagation(); if(!confirm(`Excluir "${g.item_nome}" (${fmt(g.valor)})?`)) e.preventDefault(); }}>✕</button>
                </form>
              </td>
            </tr>
          {:else}
            <tr><td colspan="10" class="td-empty">Nenhum gasto encontrado para o período e filtros selecionados.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </main>
</div>

<!-- ═══ MODAL: ADICIONAR COMPRA ═══════════════════════════════════════════ -->
{#if showAddCompra}
<div class="overlay" role="dialog" aria-modal="true" onclick={() => showAddCompra=false}>
  <div class="modal modal-xl" onclick={(e) => e.stopPropagation()}>
    <div class="modal-hdr">
      <h2 class="modal-title">Nova Compra</h2>
      <button class="modal-close" onclick={resetCompra}>✕</button>
    </div>
    <form method="post" action="?/addCompra"
      use:enhance={() => async ({result,update}) => { if(result.type==='success') resetCompra(); await update(); }}>
      <input type="hidden" name="itens" value={itensPayload} />
      <div class="modal-body">
        <!-- Common fields -->
        <div class="form-row">
          <div class="fg"><label class="fl">Data</label>
            <input class="fi" type="date" name="data" bind:value={cDate} required /></div>
          <div class="fg"><label class="fl">Parcelas</label>
            <select class="fi" name="parcelas" bind:value={cParcelas}>
              {#each PARCELAS_OPTIONS as n}<option value={n}>{n}×</option>{/each}
            </select></div>
          <div class="fg"><label class="fl">Tipo</label>
            <select class="fi" name="tipo" bind:value={cTipo}>
              {#each TIPOS as t}<option>{t}</option>{/each}
            </select></div>
          <div class="fg"><label class="fl">Pagamento</label>
            <select class="fi" name="pagamento" bind:value={cPagamento}>
              {#each PAGAMENTOS as p}<option>{p}</option>{/each}
            </select></div>
        </div>

        <!-- Item rows divider -->
        <div class="sec-divider">
          <span>Itens da compra</span>
          <button type="button" class="btn-add-row" onclick={addCompraItem}>+ Linha</button>
        </div>

        <div class="items-grid">
          <div class="ig-header">
            <span style="flex:2.2">Item</span>
            <span style="flex:1">Valor (R$)</span>
            <span style="flex:1.2">Subcategoria</span>
            <span style="flex:1.2">Categoria</span>
            <span style="flex:1.5">Comentário</span>
            <span style="width:26px"></span>
          </div>
          {#each cItens as ci, idx}
            <div class="item-line">
              <div class="if" style="flex:2.2;position:relative">
                <input class="fi" type="text" placeholder="Pesquisar item..."
                  value={ci.item_nome}
                  oninput={(e) => searchCI(idx, e.currentTarget.value)}
                  onblur={() => setTimeout(() => { cItens[idx].open=false; }, 180)}
                  autocomplete="off" />
                {#if ci.open && ci.results.length > 0}
                  <div class="dropdown">
                    {#each ci.results as r}
                      <button type="button" class="dd-item" onmousedown={() => pickCI(idx, r)}>
                        <span class="dd-nome">{r.nome}</span>
                        <span class="dd-sub">{r.subcategoria_nome} › {r.categoria_nome}</span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
              <div class="if" style="flex:1">
                <input class="fi" type="number" step="0.01" min="0" placeholder="0,00" bind:value={ci.valor} />
              </div>
              <div class="if" style="flex:1.2">
                <input class="fi fi-ro" type="text" readonly value={ci.subcategoria_nome} placeholder="—" />
              </div>
              <div class="if" style="flex:1.2">
                <input class="fi fi-ro" type="text" readonly value={ci.categoria_nome} placeholder="—" />
              </div>
              <div class="if" style="flex:1.5">
                <input class="fi" type="text" placeholder="Opcional..." bind:value={ci.comentario} />
              </div>
              <div style="display:flex;align-items:center;width:26px">
                {#if cItens.length > 1}
                  <button type="button" class="btn-rm" onclick={() => removeCompraItem(idx)}>✕</button>
                {/if}
              </div>
            </div>
          {/each}
        </div>

        <div class="compra-total">
          <span>Total da compra</span>
          <strong class="total-big">{fmt(totalCompra)}</strong>
        </div>
      </div>

      <div class="modal-ftr">
        <button type="button" class="btn btn-ghost" onclick={resetCompra}>Cancelar</button>
        <button type="submit" class="btn btn-primary"
          onclick={(e) => {
            const ok = cItens.some(i => i.item_id && parseFloat(i.valor) > 0);
            if (!ok) { e.preventDefault(); alert('Adicione pelo menos um item selecionado com valor.'); return; }
            if (!confirm(`Confirmar lançamento de ${fmt(totalCompra)}?`)) e.preventDefault();
          }}>
          ✓ Confirmar Compra
        </button>
      </div>
    </form>
  </div>
</div>
{/if}

<!-- ═══ MODAL: GERENCIAR CATEGORIAS ══════════════════════════════════════ -->
{#if showManageCat}
<div class="overlay" role="dialog" aria-modal="true" onclick={() => showManageCat=false}>
  <div class="modal modal-cat" onclick={(e) => e.stopPropagation()}>
    <div class="modal-hdr">
      <h2 class="modal-title">Gerenciar Categorias</h2>
      <button class="modal-close" onclick={() => showManageCat=false}>✕</button>
    </div>
    <div class="modal-body cat-manager">
      {#each data.categorias as cat (cat.id)}
        <div class="cat-card">
          <div class="cat-row">
            <button type="button" class="expand-btn" onclick={() => catExpanded[cat.id]=!catExpanded[cat.id]}>
              <span class="exp-icon">{catExpanded[cat.id]?'▾':'▸'}</span>
              <span class="cat-name">{cat.nome}</span>
              <span class="cat-cnt">{(subcatsByCategoria[cat.id]||[]).length} sub</span>
            </button>
            <form method="post" action="?/deleteCategoria"
              use:enhance={() => async ({update}) => { await update(); }}>
              <input type="hidden" name="id" value={cat.id} />
              <button type="submit" class="btn-del-sm"
                onclick={(e) => { if(!confirm(`Excluir categoria "${cat.nome}"?`)) e.preventDefault(); }}>✕</button>
            </form>
          </div>
          {#if catExpanded[cat.id]}
            <div class="cat-children">
              {#each (subcatsByCategoria[cat.id]||[]) as sub (sub.id)}
                <div class="subcat-card">
                  <div class="subcat-row">
                    <button type="button" class="expand-btn expand-btn-sm"
                      onclick={() => subcatExpanded[sub.id]=!subcatExpanded[sub.id]}>
                      <span class="exp-icon">{subcatExpanded[sub.id]?'▾':'▸'}</span>
                      <span class="subcat-name">{sub.nome}</span>
                      <span class="cat-cnt">{(itensBySubcat[sub.id]||[]).length} itens</span>
                    </button>
                    <form method="post" action="?/deleteSubcategoria"
                      use:enhance={() => async ({update}) => { await update(); }}>
                      <input type="hidden" name="id" value={sub.id} />
                      <button type="submit" class="btn-del-sm"
                        onclick={(e) => { if(!confirm(`Excluir subcategoria "${sub.nome}"?`)) e.preventDefault(); }}>✕</button>
                    </form>
                  </div>
                  {#if subcatExpanded[sub.id]}
                    <div class="chips-wrap">
                      {#each (itensBySubcat[sub.id]||[]) as item (item.id)}
                        <div class="chip">
                          <span>{item.nome}</span>
                          <form method="post" action="?/deleteItem"
                            use:enhance={() => async ({update}) => { await update(); }}>
                            <input type="hidden" name="id" value={item.id} />
                            <button type="submit" class="chip-del"
                              onclick={(e) => { if(!confirm(`Excluir item "${item.nome}"?`)) e.preventDefault(); }}>✕</button>
                          </form>
                        </div>
                      {/each}
                      <form method="post" action="?/addItem" class="inline-form"
                        use:enhance={() => async ({result,update}) => { if(result.type==='success') newItemData[sub.id]=''; await update(); }}>
                        <input type="hidden" name="subcategoria_id" value={sub.id} />
                        <input class="ii" type="text" name="nome" bind:value={newItemData[sub.id]} placeholder="Novo item..." required />
                        <button type="submit" class="btn-iadd">+</button>
                      </form>
                    </div>
                  {/if}
                </div>
              {/each}
              <form method="post" action="?/addSubcategoria" class="add-subcat-form"
                use:enhance={() => async ({result,update}) => { if(result.type==='success') newSubcatData[cat.id]=''; await update(); }}>
                <input type="hidden" name="categoria_id" value={cat.id} />
                <input class="ii" type="text" name="nome" bind:value={newSubcatData[cat.id]} placeholder="Nova subcategoria..." required />
                <button type="submit" class="btn-iadd">+</button>
              </form>
            </div>
          {/if}
        </div>
      {:else}
        <p class="cat-empty">Nenhuma categoria cadastrada ainda.</p>
      {/each}
      <form method="post" action="?/addCategoria" class="add-cat-form"
        use:enhance={() => async ({result,update}) => { if(result.type==='success') newCatName=''; await update(); }}>
        <input class="fi" type="text" name="nome" bind:value={newCatName} placeholder="Nova categoria..." required />
        <button type="submit" class="btn btn-primary btn-sm">+ Categoria</button>
      </form>
    </div>
  </div>
</div>
{/if}

<!-- ═══ MODAL: EDITAR GASTO ═══════════════════════════════════════════════ -->
{#if editGasto}
<div class="overlay" role="dialog" aria-modal="true" onclick={() => editGasto=null}>
  <div class="modal modal-edit" onclick={(e) => e.stopPropagation()}>
    <div class="modal-hdr">
      <h2 class="modal-title">Editar Gasto</h2>
      <button class="modal-close" onclick={() => editGasto=null}>✕</button>
    </div>
    <form method="post" action="?/updateGasto"
      use:enhance={() => async ({result,update}) => { if(result.type==='success') editGasto=null; await update(); }}>
      <input type="hidden" name="id"             value={editGasto.id} />
      <input type="hidden" name="item_id"        value={editGasto.item_id} />
      <input type="hidden" name="categoria_id"   value={editGasto.categoria_id} />
      <input type="hidden" name="subcategoria_id" value={editGasto.subcategoria_id} />
      <div class="modal-body">
        <div class="form-row">
          <div class="fg"><label class="fl">Data</label>
            <input class="fi" type="date" name="data" bind:value={editGasto.data} required /></div>
          <div class="fg"><label class="fl">Parcelas</label>
            <select class="fi" name="parcelas" bind:value={editGasto.parcelas}>
              {#each PARCELAS_OPTIONS as n}<option value={n}>{n}×</option>{/each}
            </select></div>
          <div class="fg"><label class="fl">Tipo</label>
            <select class="fi" name="tipo" bind:value={editGasto.tipo}>
              {#each TIPOS as t}<option>{t}</option>{/each}
            </select></div>
          <div class="fg"><label class="fl">Pagamento</label>
            <select class="fi" name="pagamento" bind:value={editGasto.pagamento}>
              {#each PAGAMENTOS as p}<option>{p}</option>{/each}
            </select></div>
        </div>
        <div class="form-row">
          <div class="fg" style="flex:2;position:relative"><label class="fl">Item</label>
            <input class="fi" type="text" value={editItemSearch}
              oninput={(e) => searchEditItem(e.currentTarget.value)}
              onblur={() => setTimeout(() => editItemOpen=false, 180)}
              placeholder="Pesquisar item..." autocomplete="off" />
            {#if editItemOpen && editItemResults.length > 0}
              <div class="dropdown">
                {#each editItemResults as r}
                  <button type="button" class="dd-item" onmousedown={() => pickEditItem(r)}>
                    <span class="dd-nome">{r.nome}</span>
                    <span class="dd-sub">{r.subcategoria_nome} › {r.categoria_nome}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
          <div class="fg"><label class="fl">Subcategoria</label>
            <input class="fi fi-ro" type="text" readonly value={editGasto.subcategoria_nome||''} /></div>
          <div class="fg"><label class="fl">Categoria</label>
            <input class="fi fi-ro" type="text" readonly value={editGasto.categoria_nome||''} /></div>
        </div>
        <div class="form-row">
          <div class="fg"><label class="fl">Valor (R$)</label>
            <input class="fi" type="number" step="0.01" name="valor" bind:value={editGasto.valor} required /></div>
          <div class="fg" style="flex:2"><label class="fl">Comentário</label>
            <input class="fi" type="text" name="comentario" bind:value={editGasto.comentario} placeholder="Opcional..." /></div>
        </div>
      </div>
      <div class="modal-ftr">
        <button type="button" class="btn btn-ghost" onclick={() => editGasto=null}>Cancelar</button>
        <button type="submit" class="btn btn-primary"
          onclick={(e) => { if(!editGasto?.item_id) { e.preventDefault(); alert('Selecione um item válido.'); } }}>
          ✓ Salvar
        </button>
      </div>
    </form>
  </div>
</div>
{/if}

<style>
.page { display:flex; flex-direction:column; min-height:100vh; background:var(--bg); }

/* Header */
.page-header {
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  padding: 0 32px;
  flex-shrink: 0;
}
.page-header-inner {
  display:flex; align-items:center; justify-content:space-between;
  gap:16px; flex-wrap:wrap; padding: 20px 0;
}
.page-title-wrap { display:flex; flex-direction:column; gap:2px; }
.page-title { font-family:'Syne',sans-serif; font-size:24px; font-weight:800; color:#fff; letter-spacing:-0.5px; line-height:1; }
.page-subtitle { font-size:12px; color:var(--text-3); }
.header-actions { display:flex; gap:10px; flex-wrap:wrap; }

/* Buttons */
.btn {
  display:inline-flex; align-items:center; gap:7px;
  padding:9px 18px; border:none; border-radius:var(--radius);
  font-size:13.5px; font-weight:500; cursor:pointer;
  transition:all 0.16s ease; white-space:nowrap;
}
.btn-primary {
  background: linear-gradient(135deg, var(--green), var(--green-dim));
  color: #000; font-weight:600;
  box-shadow: 0 0 20px rgba(0,224,123,0.2);
}
.btn-primary:hover { transform:translateY(-1px); box-shadow:0 0 28px rgba(0,224,123,0.35); }
.btn-secondary {
  background: var(--bg-elevated);
  color: var(--text-2);
  border: 1px solid var(--border-2);
}
.btn-secondary:hover { background:var(--bg-hover); color:var(--text); border-color:var(--border-3); }
.btn-ghost {
  background: transparent; color:var(--text-2);
  border: 1px solid var(--border);
}
.btn-ghost:hover { background:var(--bg-elevated); color:var(--text); }
.btn-filter {
  background: var(--blue-dim); color:#fff; border:none;
  padding:9px 20px; border-radius:var(--radius); font-size:13.5px;
  font-weight:500; cursor:pointer; align-self:flex-end; transition:background 0.15s;
}
.btn-filter:hover { background:var(--blue); }
.btn-sm { padding:7px 14px; font-size:13px; }

/* Main */
.page-main { padding:24px 32px 48px; flex:1; max-width:1440px; width:100%; }

/* Filters */
.filters-bar {
  display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap;
  background:var(--bg-card); border:1px solid var(--border);
  padding:16px 20px; border-radius:var(--radius-lg); margin-bottom:16px;
}
.filter-group { display:flex; flex-direction:column; gap:5px; }
.fg-grow { flex:1; min-width:200px; }
.flabel { font-size:10.5px; font-weight:600; color:var(--text-3); text-transform:uppercase; letter-spacing:0.6px; }
.finput {
  padding:9px 12px; border:1px solid var(--border-2); border-radius:8px;
  font-size:13.5px; color:var(--text); background:var(--bg-input);
  outline:none; min-width:120px; transition:border-color 0.15s, background 0.15s;
  color-scheme: dark;
}
.finput:focus { border-color:var(--blue); background:var(--bg-elevated); }

/* Summary */
.summary-bar { display:flex; justify-content:space-between; align-items:center; padding:8px 2px 12px; }
.summary-count { font-size:12.5px; color:var(--text-3); font-family:'DM Mono',monospace; }
.summary-total { font-size:13.5px; color:var(--text-2); }
.total-num { font-family:'Syne',sans-serif; font-size:20px; font-weight:700; color:var(--green); }

/* Table */
.table-wrap {
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:var(--radius-lg);
  overflow:hidden;
}
.dtable { width:100%; border-collapse:collapse; font-size:13px; }
.dtable thead tr { background:var(--bg-elevated); border-bottom:1px solid var(--border-2); }
.dtable th {
  padding:11px 14px; text-align:left;
  font-size:10.5px; font-weight:600; color:var(--text-3);
  text-transform:uppercase; letter-spacing:0.6px; white-space:nowrap;
}
.dtable th.tr { text-align:right; }
.dtable th.tc { text-align:center; }
.drow { border-bottom:1px solid var(--border); cursor:pointer; transition:background 0.12s; }
.drow:last-child { border-bottom:none; }
.drow:hover { background:var(--bg-hover); }
.drow td { padding:11px 14px; vertical-align:middle; }
.td-date  { white-space:nowrap; color:var(--text-3); font-family:'DM Mono',monospace; font-size:12px; }
.td-item  { font-weight:500; color:var(--text); }
.td-muted { color:var(--text-3); }
.td-val   { text-align:right; font-weight:600; color:var(--green); font-family:'Syne',sans-serif; white-space:nowrap; }
.td-comment { color:var(--text-3); max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tc { text-align:center; }
.td-empty { text-align:center; padding:56px 20px; color:var(--text-3); }

/* Badge & pills */
.badge-cat {
  display:inline-block; padding:3px 9px;
  background:var(--blue-bg); color:var(--blue);
  border:1px solid rgba(66,133,255,0.2);
  border-radius:20px; font-size:11.5px; font-weight:500; white-space:nowrap;
}
.pill { display:inline-block; padding:3px 9px; border-radius:20px; font-size:11.5px; font-weight:500; white-space:nowrap; }
.pill-variável { background:var(--amber-bg); color:var(--amber); border:1px solid rgba(245,158,11,0.2); }
.pill-fixo     { background:var(--blue-bg);  color:var(--blue);  border:1px solid rgba(66,133,255,0.2); }

/* Delete */
.btn-del {
  width:28px; height:28px; border-radius:7px; border:none;
  background:transparent; color:var(--text-3); font-size:11px;
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  transition:all 0.14s;
}
.btn-del:hover { background:var(--red-bg); color:var(--red); }

/* Overlay */
.overlay {
  position:fixed; inset:0;
  background:rgba(3,6,18,0.85);
  backdrop-filter:blur(6px);
  z-index:100;
  display:flex; align-items:center; justify-content:center;
  padding:20px;
  animation:fadeIn 0.16s ease;
}
@keyframes fadeIn { from{opacity:0} to{opacity:1} }

.modal {
  background:var(--bg-card);
  border:1px solid var(--border-2);
  border-radius:var(--radius-lg);
  box-shadow:var(--shadow-lg);
  width:100%; max-height:90vh;
  display:flex; flex-direction:column;
  animation:slideUp 0.2s ease;
  overflow:hidden;
}
@keyframes slideUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
.modal-xl   { max-width:1100px; }
.modal-cat  { max-width:600px; }
.modal-edit { max-width:780px; }

.modal-hdr {
  display:flex; align-items:center; justify-content:space-between;
  padding:20px 26px 18px;
  border-bottom:1px solid var(--border);
  flex-shrink:0;
}
.modal-title { font-family:'Syne',sans-serif; font-size:19px; font-weight:700; color:#fff; }
.modal-close {
  width:32px; height:32px; border-radius:8px; border:none;
  background:var(--bg-elevated); color:var(--text-2); font-size:13px;
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  transition:all 0.14s; border:1px solid var(--border);
}
.modal-close:hover { background:var(--red-bg); color:var(--red); border-color:rgba(255,77,90,0.3); }

.modal-body { padding:22px 26px; overflow-y:auto; flex:1; }
.modal-ftr {
  display:flex; justify-content:flex-end; gap:10px;
  padding:16px 26px 20px;
  border-top:1px solid var(--border);
  flex-shrink:0;
}

/* Forms */
.form-row { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
.fg { display:flex; flex-direction:column; gap:6px; flex:1; min-width:110px; }
.fl { font-size:10.5px; font-weight:600; color:var(--text-3); text-transform:uppercase; letter-spacing:0.5px; }
.fi {
  padding:9px 12px; border:1px solid var(--border-2); border-radius:9px;
  font-size:13.5px; color:var(--text); background:var(--bg-input);
  outline:none; width:100%; transition:border-color 0.14s, background 0.14s;
  color-scheme:dark;
}
.fi:focus { border-color:var(--blue); background:var(--bg-elevated); }
.fi-ro { background:var(--bg-surface); color:var(--text-3); cursor:default; }
.fi-ro:focus { border-color:var(--border-2); background:var(--bg-surface); }

/* Section divider */
.sec-divider {
  display:flex; align-items:center; justify-content:space-between;
  border-top:1px solid var(--border); padding-top:14px; margin-bottom:12px;
}
.sec-divider span { font-family:'Syne',sans-serif; font-size:13px; font-weight:600; color:var(--text-2); }
.btn-add-row {
  padding:6px 12px; background:var(--blue-bg); color:var(--blue);
  border:1px dashed rgba(66,133,255,0.4); border-radius:8px;
  font-size:12.5px; font-weight:500; cursor:pointer; transition:all 0.14s;
}
.btn-add-row:hover { background:var(--bg-hover); border-color:var(--blue); }

/* Items grid */
.items-grid { display:flex; flex-direction:column; gap:7px; }
.ig-header {
  display:flex; gap:8px; padding-bottom:7px;
  border-bottom:1px solid var(--border);
  font-size:10.5px; font-weight:600; color:var(--text-3); text-transform:uppercase; letter-spacing:0.5px;
}
.item-line {
  display:flex; gap:8px; align-items:flex-start;
  padding:9px; background:var(--bg-elevated);
  border:1px solid var(--border); border-radius:var(--radius); transition:border-color 0.14s;
}
.item-line:hover { border-color:var(--border-2); }
.if { display:flex; flex-direction:column; }

/* Dropdown */
.dropdown {
  position:absolute; top:calc(100% + 4px); left:0; right:0;
  background:var(--bg-elevated);
  border:1px solid var(--border-2);
  border-radius:var(--radius);
  box-shadow:var(--shadow-lg);
  z-index:300;
  max-height:220px; overflow-y:auto;
}
.dd-item {
  display:flex; flex-direction:column; gap:1px;
  width:100%; padding:9px 12px; border:none;
  background:transparent; text-align:left; cursor:pointer;
  border-bottom:1px solid var(--border); transition:background 0.1s;
}
.dd-item:hover { background:var(--bg-hover); }
.dd-item:last-child { border-bottom:none; }
.dd-nome { font-size:13px; font-weight:500; color:var(--text); }
.dd-sub  { font-size:11px; color:var(--text-3); }

/* Remove line btn */
.btn-rm {
  width:22px; height:22px; border:none; border-radius:6px;
  background:transparent; color:var(--text-3); font-size:10px;
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  margin-top:26px; transition:all 0.13s;
}
.btn-rm:hover { background:var(--red-bg); color:var(--red); }

/* Compra total */
.compra-total {
  display:flex; align-items:center; justify-content:flex-end; gap:14px;
  padding:14px 16px; margin-top:12px;
  background:var(--green-bg);
  border:1px solid rgba(0,224,123,0.15);
  border-radius:var(--radius);
}
.compra-total span { font-size:13.5px; color:var(--text-2); }
.total-big { font-family:'Syne',sans-serif; font-size:24px; font-weight:700; color:var(--green); }

/* Category manager */
.cat-manager { display:flex; flex-direction:column; gap:8px; }
.cat-card { border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden; background:var(--bg-elevated); }
.cat-row { display:flex; align-items:center; gap:8px; padding:12px 14px; background:var(--bg-card); }
.expand-btn {
  display:flex; align-items:center; gap:8px; flex:1;
  background:none; border:none; cursor:pointer; text-align:left; padding:0;
}
.exp-icon { font-size:11px; color:var(--text-3); width:13px; }
.cat-name { font-weight:600; color:var(--text); font-size:14px; }
.cat-cnt  { font-size:11px; color:var(--text-3); margin-left:4px; }
.cat-children { padding:8px 14px 12px 22px; display:flex; flex-direction:column; gap:6px; }
.subcat-card { border:1px solid var(--border); border-radius:9px; background:var(--bg-surface); overflow:hidden; }
.subcat-row { display:flex; align-items:center; gap:8px; padding:9px 12px; }
.expand-btn-sm .cat-name { font-size:13px; font-weight:500; }
.subcat-name { font-weight:500; color:var(--text-2); font-size:13px; }
.chips-wrap { display:flex; flex-wrap:wrap; gap:6px; padding:8px 12px 10px 22px; border-top:1px solid var(--border); }
.chip {
  display:inline-flex; align-items:center; gap:5px; padding:4px 8px 4px 10px;
  background:var(--bg-elevated); border:1px solid var(--border-2);
  border-radius:20px; font-size:12px; color:var(--text-2);
}
.chip-del {
  width:14px; height:14px; border:none; background:transparent; color:var(--text-3);
  font-size:8px; cursor:pointer; border-radius:50%; display:flex;
  align-items:center; justify-content:center; transition:all 0.12s; padding:0;
}
.chip-del:hover { background:var(--red-bg); color:var(--red); }
.btn-del-sm {
  width:26px; height:26px; border:none; border-radius:7px;
  background:transparent; color:var(--text-3); font-size:10px;
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  transition:all 0.13s; flex-shrink:0;
}
.btn-del-sm:hover { background:var(--red-bg); color:var(--red); }
.inline-form { display:flex; align-items:center; gap:5px; }
.add-subcat-form { display:flex; align-items:center; gap:6px; padding-top:6px; border-top:1px dashed var(--border); margin-top:2px; }
.add-cat-form { display:flex; gap:10px; align-items:center; padding:14px 16px; background:var(--bg-elevated); border:1px dashed var(--border-2); border-radius:var(--radius-lg); margin-top:4px; }
.add-cat-form .fi { flex:1; }
.cat-empty { color:var(--text-3); font-size:13px; text-align:center; padding:24px 0; }
.ii {
  padding:6px 10px; border:1px solid var(--border-2); border-radius:7px;
  font-size:12.5px; color:var(--text); background:var(--bg-input);
  outline:none; width:170px; transition:border-color 0.14s;
  color-scheme:dark;
}
.ii:focus { border-color:var(--blue); }
.btn-iadd {
  width:28px; height:28px; border:none; border-radius:7px;
  background:var(--green-dim); color:#000; font-size:18px;
  font-weight:300; cursor:pointer;
  display:flex; align-items:center; justify-content:center;
  transition:background 0.14s; flex-shrink:0; line-height:1;
}
.btn-iadd:hover { background:var(--green); }
</style>