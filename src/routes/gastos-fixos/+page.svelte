<script lang="ts">
  import { enhance } from '$app/forms';

  let { data } = $props();

  // ── Modal visibility ──
  let showAdd = $state(false);
  let editGasto = $state<any>(null);
  let showLancar = $state(false);

  // ── ADD GASTO FIXO ──
  let cTipo = $state('fixo');
  let cPagamento = $state('Crédito');
  let cValor = $state('');
  let cComentario = $state('');
  let cItemId = $state<number | null>(null);
  let cCategoriaId = $state<number | null>(null);
  let cSubcategoriaId = $state<number | null>(null);
  let cItemNome = $state('');
  let cSubcatNome = $state('');
  let cCatNome = $state('');
  let cResults = $state<any[]>([]);
  let cOpen = $state(false);

  function searchItem(q: string) {
    cItemNome = q;
    cItemId = null; cCategoriaId = null; cSubcategoriaId = null;
    cSubcatNome = ''; cCatNome = '';
    if (!q.trim()) { cResults = []; cOpen = false; return; }
    cResults = (data.itens as any[]).filter(i => i.nome.toLowerCase().includes(q.toLowerCase())).slice(0, 30);
    cOpen = cResults.length > 0;
  }

  function pickItem(item: any) {
    cItemId = item.id; cCategoriaId = item.categoria_id; cSubcategoriaId = item.subcategoria_id;
    cItemNome = item.nome; cSubcatNome = item.subcategoria_nome; cCatNome = item.categoria_nome;
    cResults = []; cOpen = false;
  }

  function resetAdd() {
    cTipo = 'fixo'; cPagamento = 'Crédito'; cValor = ''; cComentario = '';
    cItemId = null; cCategoriaId = null; cSubcategoriaId = null;
    cItemNome = ''; cSubcatNome = ''; cCatNome = '';
    cResults = []; cOpen = false; showAdd = false;
  }

  // ── EDIT ──
  let editItemSearch = $state('');
  let editItemResults = $state<any[]>([]);
  let editItemOpen = $state(false);

  function openEdit(g: any) {
    editGasto = { ...g };
    editItemSearch = g.item_nome || '';
    editItemOpen = false; editItemResults = [];
  }
  function searchEditItem(q: string) {
    editItemSearch = q;
    if (editGasto) { editGasto.item_id = null; editGasto.categoria_id = null; editGasto.subcategoria_id = null; }
    if (!q.trim()) { editItemResults = []; editItemOpen = false; return; }
    editItemResults = (data.itens as any[]).filter(i => i.nome.toLowerCase().includes(q.toLowerCase())).slice(0, 30);
    editItemOpen = editItemResults.length > 0;
  }
  function pickEditItem(item: any) {
    editItemSearch = item.nome; editItemOpen = false; editItemResults = [];
    if (editGasto) {
      editGasto.item_id = item.id; editGasto.categoria_id = item.categoria_id;
      editGasto.subcategoria_id = item.subcategoria_id; editGasto.item_nome = item.nome;
      editGasto.subcategoria_nome = item.subcategoria_nome; editGasto.categoria_nome = item.categoria_nome;
    }
  }

  // ── LANÇAR ──
  let lancMes = $state(new Date().getMonth() + 1);
  let lancAno = $state(new Date().getFullYear());

  // ── Helpers ──
  function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  let totalFixos = $derived((data.gastos_fixos as any[]).reduce((s: number, g: any) => s + (g.valor || 0), 0));

  const TIPOS = ['fixo', 'variável'];
  const PAGAMENTOS = ['Crédito', 'Débito', 'Pix', 'Dinheiro'];
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
</script>

<div class="page">
  <header class="page-header">
    <div class="page-header-inner">
      <div class="page-title-wrap">
        <h1 class="page-title">Gastos Fixos</h1>
        <span class="page-subtitle">Despesas recorrentes mensais</span>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" onclick={() => showAdd = true}>
          <span>+</span> Novo Gasto Fixo
        </button>
        <button class="btn btn-secondary" onclick={() => showLancar = true}>
          <span>↓</span> Lançar no Mês
        </button>
      </div>
    </div>
  </header>

  <main class="page-main">
    <div class="summary-bar">
      <span class="summary-count">{data.gastos_fixos.length} gastos fixos cadastrados</span>
      <span class="summary-total">Mensal: <strong class="total-num">{fmt(totalFixos)}</strong></span>
    </div>

    <div class="table-wrap">
      <table class="dtable">
        <thead>
          <tr>
            <th>Item</th><th>Subcategoria</th><th>Categoria</th>
            <th class="tr">Valor</th><th>Tipo</th><th>Pagamento</th>
            <th>Comentário</th><th></th>
          </tr>
        </thead>
        <tbody>
          {#each data.gastos_fixos as g (g.id)}
            <tr class="drow" onclick={() => openEdit(g)}>
              <td class="td-item">{g.item_nome || '—'}</td>
              <td class="td-muted">{g.subcategoria_nome || '—'}</td>
              <td>{#if g.categoria_nome}<span class="badge-cat">{g.categoria_nome}</span>{:else}<span class="td-muted">—</span>{/if}</td>
              <td class="td-val">{fmt(g.valor)}</td>
              <td><span class="pill pill-{g.tipo}">{g.tipo}</span></td>
              <td class="td-muted">{g.pagamento || '—'}</td>
              <td class="td-comment">{g.comentario || '—'}</td>
              <td class="tc">
                <form method="post" action="?/deleteGastoFixo"
                  use:enhance={() => async ({update}) => { await update(); }}>
                  <input type="hidden" name="id" value={g.id} />
                  <button type="submit" class="btn-del"
                    onclick={(e) => { e.stopPropagation(); if(!confirm(`Excluir "${g.item_nome}" (${fmt(g.valor)})?`)) e.preventDefault(); }}>✕</button>
                </form>
              </td>
            </tr>
          {:else}
            <tr><td colspan="8" class="td-empty">Nenhum gasto fixo cadastrado.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
  </main>
</div>

<!-- ═══ MODAL: ADICIONAR GASTO FIXO ═══ -->
{#if showAdd}
<div class="overlay" role="dialog" aria-modal="true" onclick={() => showAdd = false}>
  <div class="modal modal-edit" onclick={(e) => e.stopPropagation()}>
    <div class="modal-hdr">
      <h2 class="modal-title">Novo Gasto Fixo</h2>
      <button class="modal-close" onclick={resetAdd}>✕</button>
    </div>
    <form method="post" action="?/addGastoFixo"
      use:enhance={() => async ({result, update}) => { if(result.type === 'success') resetAdd(); await update(); }}>
      <input type="hidden" name="item_id" value={cItemId} />
      <input type="hidden" name="categoria_id" value={cCategoriaId} />
      <input type="hidden" name="subcategoria_id" value={cSubcategoriaId} />
      <div class="modal-body">
        <div class="form-row">
          <div class="fg" style="flex:2;position:relative"><label class="fl">Item</label>
            <input class="fi" type="text" value={cItemNome}
              oninput={(e) => searchItem(e.currentTarget.value)}
              onblur={() => setTimeout(() => cOpen = false, 180)}
              placeholder="Pesquisar item..." autocomplete="off" />
            {#if cOpen && cResults.length > 0}
              <div class="dropdown">
                {#each cResults as r}
                  <button type="button" class="dd-item" onmousedown={() => pickItem(r)}>
                    <span class="dd-nome">{r.nome}</span>
                    <span class="dd-sub">{r.subcategoria_nome} › {r.categoria_nome}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
          <div class="fg"><label class="fl">Subcategoria</label>
            <input class="fi fi-ro" type="text" readonly value={cSubcatNome} placeholder="—" /></div>
          <div class="fg"><label class="fl">Categoria</label>
            <input class="fi fi-ro" type="text" readonly value={cCatNome} placeholder="—" /></div>
        </div>
        <div class="form-row">
          <div class="fg"><label class="fl">Valor (R$)</label>
            <input class="fi" type="number" step="0.01" name="valor" bind:value={cValor} required /></div>
          <div class="fg"><label class="fl">Tipo</label>
            <select class="fi" name="tipo" bind:value={cTipo}>
              {#each TIPOS as t}<option>{t}</option>{/each}
            </select></div>
          <div class="fg"><label class="fl">Pagamento</label>
            <select class="fi" name="pagamento" bind:value={cPagamento}>
              {#each PAGAMENTOS as p}<option>{p}</option>{/each}
            </select></div>
        </div>
        <div class="form-row">
          <div class="fg"><label class="fl">Comentário</label>
            <input class="fi" type="text" name="comentario" bind:value={cComentario} placeholder="Opcional..." /></div>
        </div>
      </div>
      <div class="modal-ftr">
        <button type="button" class="btn btn-ghost" onclick={resetAdd}>Cancelar</button>
        <button type="submit" class="btn btn-primary"
          onclick={(e) => { if (!cItemId) { e.preventDefault(); alert('Selecione um item válido.'); } }}>
          ✓ Salvar
        </button>
      </div>
    </form>
  </div>
</div>
{/if}

<!-- ═══ MODAL: EDITAR GASTO FIXO ═══ -->
{#if editGasto}
<div class="overlay" role="dialog" aria-modal="true" onclick={() => editGasto = null}>
  <div class="modal modal-edit" onclick={(e) => e.stopPropagation()}>
    <div class="modal-hdr">
      <h2 class="modal-title">Editar Gasto Fixo</h2>
      <button class="modal-close" onclick={() => editGasto = null}>✕</button>
    </div>
    <form method="post" action="?/updateGastoFixo"
      use:enhance={() => async ({result, update}) => { if(result.type === 'success') editGasto = null; await update(); }}>
      <input type="hidden" name="id" value={editGasto.id} />
      <input type="hidden" name="item_id" value={editGasto.item_id} />
      <input type="hidden" name="categoria_id" value={editGasto.categoria_id} />
      <input type="hidden" name="subcategoria_id" value={editGasto.subcategoria_id} />
      <div class="modal-body">
        <div class="form-row">
          <div class="fg" style="flex:2;position:relative"><label class="fl">Item</label>
            <input class="fi" type="text" value={editItemSearch}
              oninput={(e) => searchEditItem(e.currentTarget.value)}
              onblur={() => setTimeout(() => editItemOpen = false, 180)}
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
            <input class="fi fi-ro" type="text" readonly value={editGasto.subcategoria_nome || ''} /></div>
          <div class="fg"><label class="fl">Categoria</label>
            <input class="fi fi-ro" type="text" readonly value={editGasto.categoria_nome || ''} /></div>
        </div>
        <div class="form-row">
          <div class="fg"><label class="fl">Valor (R$)</label>
            <input class="fi" type="number" step="0.01" name="valor" bind:value={editGasto.valor} required /></div>
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
          <div class="fg"><label class="fl">Comentário</label>
            <input class="fi" type="text" name="comentario" bind:value={editGasto.comentario} placeholder="Opcional..." /></div>
        </div>
      </div>
      <div class="modal-ftr">
        <button type="button" class="btn btn-ghost" onclick={() => editGasto = null}>Cancelar</button>
        <button type="submit" class="btn btn-primary"
          onclick={(e) => { if (!editGasto?.item_id) { e.preventDefault(); alert('Selecione um item válido.'); } }}>
          ✓ Salvar
        </button>
      </div>
    </form>
  </div>
</div>
{/if}

<!-- ═══ MODAL: LANÇAR NO MÊS ═══ -->
{#if showLancar}
<div class="overlay" role="dialog" aria-modal="true" onclick={() => showLancar = false}>
  <div class="modal" style="max-width:440px" onclick={(e) => e.stopPropagation()}>
    <div class="modal-hdr">
      <h2 class="modal-title">Lançar Gastos Fixos</h2>
      <button class="modal-close" onclick={() => showLancar = false}>✕</button>
    </div>
    <form method="post" action="?/lancarGastosFixos"
      use:enhance={() => async ({result, update}) => {
        if (result.type === 'success') { showLancar = false; alert('Gastos fixos lançados com sucesso!'); }
        await update();
      }}>
      <div class="modal-body">
        <p style="color:var(--text-2);font-size:13.5px;margin-bottom:18px;">
          Todos os {data.gastos_fixos.length} gastos fixos ({fmt(totalFixos)}) serão lançados como gastos no mês selecionado.
        </p>
        <div class="form-row">
          <div class="fg"><label class="fl">Mês</label>
            <select class="fi" name="mes" bind:value={lancMes}>
              {#each MESES as m, i}<option value={i + 1}>{m}</option>{/each}
            </select></div>
          <div class="fg"><label class="fl">Ano</label>
            <input class="fi" type="number" name="ano" bind:value={lancAno} min="2020" max="2030" /></div>
        </div>
      </div>
      <div class="modal-ftr">
        <button type="button" class="btn btn-ghost" onclick={() => showLancar = false}>Cancelar</button>
        <button type="submit" class="btn btn-primary"
          onclick={(e) => { if (!confirm(`Lançar ${data.gastos_fixos.length} gastos fixos em ${MESES[lancMes-1]}/${lancAno}?`)) e.preventDefault(); }}>
          ✓ Lançar
        </button>
      </div>
    </form>
  </div>
</div>
{/if}

<style>
.page { display:flex; flex-direction:column; min-height:100vh; background:var(--bg); }
.page-header { background:var(--bg-surface); border-bottom:1px solid var(--border); padding:0 32px; flex-shrink:0; }
.page-header-inner { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; padding:20px 0; }
.page-title-wrap { display:flex; flex-direction:column; gap:2px; }
.page-title { font-family:'Inter',sans-serif; font-size:24px; font-weight:800; color:#fff; letter-spacing:-0.5px; line-height:1; }
.page-subtitle { font-size:12px; color:var(--text-3); }
.header-actions { display:flex; gap:10px; flex-wrap:wrap; }
.btn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border:none; border-radius:var(--radius); font-size:13.5px; font-weight:500; cursor:pointer; transition:all 0.16s ease; white-space:nowrap; }
.btn-primary { background:linear-gradient(135deg, var(--green), var(--green-dim)); color:#000; font-weight:600; box-shadow:0 0 20px rgba(0,224,123,0.2); }
.btn-primary:hover { transform:translateY(-1px); box-shadow:0 0 28px rgba(0,224,123,0.35); }
.btn-secondary { background:var(--bg-elevated); color:var(--text-2); border:1px solid var(--border-2); }
.btn-secondary:hover { background:var(--bg-hover); color:#fff; border-color:var(--border-3); }
.btn-ghost { background:transparent; color:var(--text-2); border:1px solid var(--border); }
.btn-ghost:hover { background:var(--bg-elevated); color:#fff; }
.btn-sm { padding:7px 14px; font-size:13px; }
.page-main { padding:24px 32px 48px; flex:1; max-width:1440px; width:100%; }
.summary-bar { display:flex; justify-content:space-between; align-items:center; padding:8px 2px 12px; }
.summary-count { font-size:12.5px; color:var(--text-3); font-family:'DM Mono',monospace; }
.summary-total { font-size:13.5px; color:var(--text-2); }
.total-num { font-family:'Inter',sans-serif; font-size:20px; font-weight:700; color:var(--green); }
.table-wrap { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg); overflow:hidden; }
.dtable { width:100%; border-collapse:collapse; font-size:13px; }
.dtable thead tr { background:var(--bg-elevated); border-bottom:1px solid var(--border-2); }
.dtable th { padding:11px 14px; text-align:left; font-size:10.5px; font-weight:600; color:var(--text-3); text-transform:uppercase; letter-spacing:0.6px; white-space:nowrap; }
.dtable th.tr { text-align:right; }
.drow { border-bottom:1px solid var(--border); cursor:pointer; transition:background 0.12s; }
.drow:last-child { border-bottom:none; }
.drow:hover { background:var(--bg-hover); }
.drow td { padding:11px 14px; vertical-align:middle; }
.td-item { font-weight:500; color:#fff; }
.td-muted { color:var(--text-3); }
.td-val { text-align:right; font-weight:600; color:var(--green); font-family:'Inter',sans-serif; white-space:nowrap; }
.td-comment { color:var(--text-3); max-width:150px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.tc { text-align:center; }
.td-empty { text-align:center; padding:56px 20px; color:var(--text-3); }
.badge-cat { display:inline-block; padding:3px 9px; background:var(--blue-bg); color:var(--blue); border:1px solid rgba(66,133,255,0.2); border-radius:20px; font-size:11.5px; font-weight:500; white-space:nowrap; }
.pill { display:inline-block; padding:3px 9px; border-radius:20px; font-size:11.5px; font-weight:500; white-space:nowrap; }
.pill-variável { background:var(--amber-bg); color:var(--amber); border:1px solid rgba(245,158,11,0.2); }
.pill-fixo { background:var(--blue-bg); color:var(--blue); border:1px solid rgba(66,133,255,0.2); }
.btn-del { width:28px; height:28px; border-radius:7px; border:none; background:transparent; color:var(--text-3); font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.14s; }
.btn-del:hover { background:var(--red-bg); color:var(--red); }
.overlay { position:fixed; inset:0; background:rgba(3,6,18,0.85); backdrop-filter:blur(6px); z-index:100; display:flex; align-items:center; justify-content:center; padding:20px; animation:fadeIn 0.16s ease; }
@keyframes fadeIn { from{opacity:0} to{opacity:1} }
.modal { background:var(--bg-card); border:1px solid var(--border-2); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg); width:100%; max-height:90vh; display:flex; flex-direction:column; animation:slideUp 0.2s ease; overflow:hidden; }
@keyframes slideUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
.modal-edit { max-width:780px; }
.modal-hdr { display:flex; align-items:center; justify-content:space-between; padding:20px 26px 18px; border-bottom:1px solid var(--border); flex-shrink:0; }
.modal-title { font-family:'Inter',sans-serif; font-size:19px; font-weight:700; color:#fff; }
.modal-close { width:32px; height:32px; border-radius:8px; border:1px solid var(--border); background:var(--bg-elevated); color:var(--text-2); font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.14s; }
.modal-close:hover { background:var(--red-bg); color:var(--red); border-color:rgba(255,77,90,0.3); }
.modal-body { padding:22px 26px 32px; overflow-y:auto; flex:1; }
.modal-ftr { display:flex; justify-content:flex-end; gap:10px; padding:16px 26px 20px; border-top:1px solid var(--border); flex-shrink:0; }
.form-row { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
.fg { display:flex; flex-direction:column; gap:6px; flex:1; min-width:110px; }
.fl { font-size:10.5px; font-weight:600; color:var(--text-3); text-transform:uppercase; letter-spacing:0.5px; }
.fi { padding:9px 12px; border:1px solid var(--border-2); border-radius:9px; font-size:13.5px; color:#fff; background:var(--bg-input); outline:none; width:100%; transition:border-color 0.14s, background 0.14s; color-scheme:dark; }
.fi:focus { border-color:var(--blue); background:var(--bg-elevated); }
.fi-ro { background:var(--bg-surface); color:var(--text-3); cursor:default; }
.fi-ro:focus { border-color:var(--border-2); background:var(--bg-surface); }
.dropdown { position:absolute; top:calc(100% + 4px); left:0; right:0; background:var(--bg-elevated); border:1px solid var(--border-2); border-radius:var(--radius); box-shadow:var(--shadow-lg); z-index:300; max-height:220px; overflow-y:auto; }
.dd-item { display:flex; flex-direction:column; gap:1px; width:100%; padding:9px 12px; border:none; background:transparent; text-align:left; cursor:pointer; border-bottom:1px solid var(--border); transition:background 0.1s; }
.dd-item:hover { background:var(--bg-hover); }
.dd-item:last-child { border-bottom:none; }
.dd-nome { font-size:13px; font-weight:500; color:#fff; }
.dd-sub { font-size:11px; color:var(--text-3); }
</style>