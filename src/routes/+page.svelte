<script lang="ts">
  import { enhance } from "$app/forms";
  import { tick } from "svelte";

  let { data } = $props();

  const todayDate = new Date().toISOString().split("T")[0];

  // ── Modal visibility ──────────────────────────────────────────────────────
  let showAddCompra = $state(false);
  let showManageCat = $state(false);
  let showImportCSV = $state(false);
  let editGasto = $state<any>(null);

  // ── CSV Import ──────────────────────────────────────────────────────────
  let csvFile = $state<File | null>(null);
  let csvDragging = $state(false);
  let csvImporting = $state(false);
  let csvResult = $state<{
    imported?: number;
    total?: number;
    errors?: string[];
  } | null>(null);

  function handleCSVDrop(e: DragEvent) {
    e.preventDefault();
    csvDragging = false;
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
      csvFile = file;
      csvResult = null;
    }
  }

  function handleCSVSelect(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      csvFile = file;
      csvResult = null;
    }
  }

  function resetCSVImport() {
    showImportCSV = false;
    csvFile = null;
    csvDragging = false;
    csvImporting = false;
    csvResult = null;
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  let fDataInicio = $state(data.filters.dataInicio);
  let fDataFim = $state(data.filters.dataFim);
  let fSearch = $state(data.filters.search);
  let fLimit = $state(data.filters.limit);

  // ── ADD COMPRA ────────────────────────────────────────────────────────────
  let cDate = $state(todayDate);
  let cParcelas = $state(1);
  let cTipo = $state("variável");
  let cPagamento = $state("Crédito");

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
      item_id: null,
      categoria_id: null,
      subcategoria_id: null,
      item_nome: "",
      valor: "",
      subcategoria_nome: "",
      categoria_nome: "",
      comentario: "",
      results: [],
      open: false,
    };
  }

  let cItens = $state<CItem[]>([newCI()]);

  let totalCompra = $derived(
    cItens.reduce((s, i) => s + (parseFloat(i.valor) || 0), 0),
  );

  // Garantir envio dos ids de categoria e subcategoria pelo payload JSON
  let itensPayload = $derived(
    JSON.stringify(
      cItens.map((i) => ({
        item_id: i.item_id,
        categoria_id: i.categoria_id,
        subcategoria_id: i.subcategoria_id,
        valor: i.valor,
        comentario: i.comentario,
      })),
    ),
  );

  function searchCI(idx: number, q: string) {
    cItens[idx].item_nome = q;
    cItens[idx].item_id = null;
    cItens[idx].categoria_id = null;
    cItens[idx].subcategoria_id = null;
    cItens[idx].subcategoria_nome = "";
    cItens[idx].categoria_nome = "";
    if (!q.trim()) {
      cItens[idx].results = [];
      cItens[idx].open = false;
      return;
    }
    cItens[idx].results = (data.itens as any[])
      .filter((i) => i.nome.toLowerCase().includes(q.toLowerCase()))
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

  function addCompraItem() {
    cItens = [...cItens, newCI()];
  }

  function removeCompraItem(idx: number) {
    cItens = cItens.filter((_, i) => i !== idx);
  }

  function resetCompra() {
    cDate = todayDate;
    cParcelas = 1;
    cTipo = "variável";
    cPagamento = "Crédito";
    cItens = [newCI()];
    showAddCompra = false;
  }

  function formatCurrencyInput(val: string): string {
    const digits = val.replace(/\D/g, "");
    if (!digits) return "";
    const num = parseInt(digits, 10) / 100;
    return num.toFixed(2);
  }

  function handleSearchKeyDown(e: KeyboardEvent, idx: number) {
    if (e.key === "Tab") {
      const ci = cItens[idx];
      if (ci.open && ci.results.length > 0) {
        e.preventDefault();
        pickCI(idx, ci.results[0]);
      }
    }
  }

  async function handleValorKeyDown(e: KeyboardEvent, idx: number) {
    if (e.key === "Tab" && !e.shiftKey) {
      if (idx === cItens.length - 1) {
        e.preventDefault();
        addCompraItem();
        await tick();
        const nextInput = document.getElementById(`search-input-${idx + 1}`);
        if (nextInput) {
          nextInput.focus();
        }
      } else {
        e.preventDefault();
        const nextInput = document.getElementById(`search-input-${idx + 1}`);
        if (nextInput) {
          nextInput.focus();
        }
      }
    }
  }

  // ── EDIT GASTO ────────────────────────────────────────────────────────────
  let editItemSearch = $state("");
  let editItemResults = $state<any[]>([]);
  let editItemOpen = $state(false);

  function openEdit(g: any) {
    editGasto = { ...g };
    if (editGasto && editGasto.valor !== undefined) {
      editGasto.valor = parseFloat(editGasto.valor).toFixed(2);
    }
    editItemSearch = g.item_nome || "";
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
    if (!q.trim()) {
      editItemResults = [];
      editItemOpen = false;
      return;
    }
    editItemResults = (data.itens as any[])
      .filter((i) => i.nome.toLowerCase().includes(q.toLowerCase()))
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
  let catExpanded = $state<Record<number, boolean>>({});
  let subcatExpanded = $state<Record<number, boolean>>({});
  let newCatName = $state("");
  let newSubcatData = $state<Record<number, string>>({});
  let newItemData = $state<Record<number, string>>({});

  let catView = $state<'categories' | 'subcategories' | 'itens'>('categories');
  let selectedCatId = $state<number | null>(null);
  let selectedSubcatId = $state<number | null>(null);
  let newSubcatName = $state("");
  let newItemName = $state("");

  let selectedCatName = $derived(data.categorias.find(c => c.id === selectedCatId)?.nome || "");
  let selectedSubcatName = $derived(data.subcategorias.find(s => s.id === selectedSubcatId)?.nome || "");
  let selectedSubcats = $derived((data.subcategorias as any[]).filter(s => s.categoria_id === selectedCatId));
  let selectedItens = $derived((data.itens as any[]).filter(i => i.subcategoria_id === selectedSubcatId));

  let subcatsByCategoria = $derived(
    (data.categorias as any[]).reduce(
      (acc: Record<number, any[]>, cat: any) => {
        acc[cat.id] = (data.subcategorias as any[]).filter(
          (s) => s.categoria_id === cat.id,
        );
        return acc;
      },
      {},
    ),
  );

  let itensBySubcat = $derived(
    (data.subcategorias as any[]).reduce(
      (acc: Record<number, any[]>, sub: any) => {
        acc[sub.id] = (data.itens as any[]).filter(
          (i) => i.subcategoria_id === sub.id,
        );
        return acc;
      },
      {},
    ),
  );

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmt(v: number) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function fmtDate(d: string) {
    if (!d) return "—";
    const [y, m, dd] = d.split("-");
    return `${dd}/${m}/${y}`;
  }

  let gastosTotal = $derived(
    (data.gastos as any[]).reduce((s: number, g: any) => s + (g.valor || 0), 0),
  );

  const PARCELAS_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
  const TIPOS = ["variável", "fixo", "eventual"];
  const PAGAMENTOS = ["Crédito", "Débito", "Pix", "Dinheiro"];
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="app">
  <!-- ══ HEADER ══════════════════════════════════════════════════════════════ -->
  <header class="header">
    <div class="header-inner">
      <div class="brand">
        <div class="brand-icon">$</div>
        <div class="brand-text">
          <h1>Finanças</h1>
          <p>Gestão de gastos</p>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" onclick={() => (showAddCompra = true)}>
          <span class="btn-icon">+</span> Adicionar Compra
        </button>
        <button class="btn btn-blue" onclick={() => (showImportCSV = true)}>
          <span class="btn-icon">⇪</span> Importar CSV
        </button>
        <button class="btn btn-outline" onclick={() => (showManageCat = true)}>
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
        <input
          class="filter-input"
          type="date"
          name="dataInicio"
          bind:value={fDataInicio}
        />
      </div>
      <div class="filter-group">
        <label class="filter-label">Até</label>
        <input
          class="filter-input"
          type="date"
          name="dataFim"
          bind:value={fDataFim}
        />
      </div>
      <div class="filter-group filter-search">
        <label class="filter-label">Pesquisar</label>
        <input
          class="filter-input"
          type="text"
          name="search"
          bind:value={fSearch}
          placeholder="categoria, item, comentário..."
        />
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
      <span class="summary-count"
        >{data.gastos.length} registros encontrados</span
      >
      <span class="summary-total"
        >Total: <strong>{fmt(gastosTotal)}</strong></span
      >
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
              <td class="item-cell">{g.item_nome || "—"}</td>
              <td class="muted-cell">{g.subcategoria_nome || "—"}</td>
              <td>
                {#if g.categoria_nome}
                  <span class="badge">{g.categoria_nome}</span>
                {:else}
                  <span class="muted-cell">—</span>
                {/if}
              </td>
              <td class="value-cell">{fmt(g.valor)}</td>
              <td><span class="tipo-pill tipo-{g.tipo}">{g.tipo}</span></td>
              <td class="muted-cell">{g.pagamento || "—"}</td>
              <td class="center">{g.parcelas}×</td>
              <td class="comment-cell">{g.comentario || "—"}</td>
              <td class="delete-cell">
                <form
                  method="post"
                  action="?/deleteGasto"
                  use:enhance={() =>
                    async ({ update }) => {
                      await update();
                    }}
                >
                  <input type="hidden" name="id" value={g.id} />
                  <button
                    type="submit"
                    class="btn-delete"
                    onclick={(e) => {
                      e.stopPropagation();
                      if (
                        !confirm(`Excluir "${g.item_nome}" (${fmt(g.valor)})?`)
                      )
                        e.preventDefault();
                    }}>✕</button
                  >
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
  <div
    class="overlay"
    role="dialog"
    aria-modal="true"
    onclick={() => (showAddCompra = false)}
  >
    <div class="modal modal-xl" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title">Nova Compra</h2>
        <button class="modal-close" onclick={resetCompra}>✕</button>
      </div>

      <form
        method="post"
        action="?/addCompra"
        use:enhance={() =>
          async ({ result, update }) => {
            if (result.type === "success") {
              resetCompra();
            }
            await update();
          }}
      >
        <input type="hidden" name="itens" value={itensPayload} />

        <div class="modal-body">
          <!-- Common fields row -->
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Data</label>
              <input
                class="form-input"
                type="date"
                name="data"
                bind:value={cDate}
                required
              />
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
              <select
                class="form-input"
                name="pagamento"
                bind:value={cPagamento}
              >
                {#each PAGAMENTOS as p}<option>{p}</option>{/each}
              </select>
            </div>
          </div>

          <!-- Divider -->
          <div class="section-divider">
            <span>Itens da compra</span>
            <button type="button" class="btn-add-row" onclick={addCompraItem}
              >+ Adicionar linha</button
            >
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
                    id="search-input-{idx}"
                    class="form-input"
                    type="text"
                    placeholder="Pesquisar item..."
                    value={ci.item_nome}
                    oninput={(e) => searchCI(idx, e.currentTarget.value)}
                    onkeydown={(e) => handleSearchKeyDown(e, idx)}
                    onblur={() =>
                      setTimeout(() => {
                        cItens[idx].open = false;
                      }, 180)}
                    autocomplete="off"
                  />
                  {#if ci.open && ci.results.length > 0}
                    <div class="dropdown">
                      {#each ci.results as r}
                        <button
                          type="button"
                          class="dropdown-item"
                          onmousedown={() => pickCI(idx, r)}
                        >
                          <span class="di-nome">{r.nome}</span>
                          <span class="di-sub"
                            >{r.subcategoria_nome} › {r.categoria_nome}</span
                          >
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>

                <!-- Valor -->
                <div class="item-field" style="flex:1">
                  <input
                    id="valor-input-{idx}"
                    class="form-input"
                    type="text"
                    inputmode="numeric"
                    placeholder="0.00"
                    value={ci.valor}
                    oninput={(e) => {
                      ci.valor = formatCurrencyInput(e.currentTarget.value);
                    }}
                    onkeydown={(e) => handleValorKeyDown(e, idx)}
                  />
                </div>

                <!-- Subcategoria (auto) -->
                <div class="item-field" style="flex:1.2">
                  <input
                    class="form-input readonly-input"
                    type="text"
                    readonly
                    value={ci.subcategoria_nome}
                    placeholder="—"
                  />
                </div>

                <!-- Categoria (auto) -->
                <div class="item-field" style="flex:1.2">
                  <input
                    class="form-input readonly-input"
                    type="text"
                    readonly
                    value={ci.categoria_nome}
                    placeholder="—"
                  />
                </div>

                <!-- Comentário -->
                <div class="item-field" style="flex:1.5">
                  <input
                    class="form-input"
                    type="text"
                    placeholder="Opcional..."
                    bind:value={ci.comentario}
                  />
                </div>

                <!-- Remove -->
                <div style="display:flex;align-items:center;width:28px">
                  {#if cItens.length > 1}
                    <button
                      type="button"
                      class="btn-rm-line"
                      onclick={() => removeCompraItem(idx)}>✕</button
                    >
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
          <button type="button" class="btn btn-ghost" onclick={resetCompra}
            >Cancelar</button
          >
          <button
            type="submit"
            class="btn btn-primary"
            onclick={(e) => {
              const hasValid = cItens.some(
                (i) => i.item_id && parseFloat(i.valor) > 0,
              );
              if (!hasValid) {
                e.preventDefault();
                alert(
                  "Adicione pelo menos um item com nome selecionado e valor preenchido.",
                );
                return;
              }
              if (!confirm(`Confirmar lançamento de ${fmt(totalCompra)}?`))
                e.preventDefault();
            }}
          >
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
  <div
    class="overlay"
    role="dialog"
    aria-modal="true"
    onclick={() => (showManageCat = false)}
  >
    <div class="modal modal-cat" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title">
          {#if catView === 'categories'}
            Gerenciar Categorias
          {:else}
            <button class="btn-back-header" onclick={() => {
              if (catView === 'itens') {
                catView = 'subcategories';
              } else {
                catView = 'categories';
              }
            }}>
              ← Voltar
            </button>
            <span style="margin-left: 10px;">
              {#if catView === 'subcategories'}
                {selectedCatName}
              {:else}
                {selectedSubcatName}
              {/if}
            </span>
          {/if}
        </h2>
        <button class="modal-close" onclick={() => { showManageCat = false; catView = 'categories'; }}
          >✕</button
        >
      </div>

      <div class="modal-body cat-manager">
        {#if catView === 'categories'}
          <!-- VIEW 1: CATEGORIES -->
          <p class="view-desc">Selecione uma categoria para gerenciar suas subcategorias:</p>
          <div class="cats-list-container">
            {#each data.categorias as cat (cat.id)}
              <div class="cat-row-drill">
                <!-- Clickable name form -->
                <form
                  method="post"
                  action="?/updateCategoria"
                  class="editable-input-form"
                  use:enhance
                >
                  <input type="hidden" name="id" value={cat.id} />
                  <input
                    class="editable-input cat-name-drill"
                    type="text"
                    name="nome"
                    value={cat.nome}
                    onchange={(e) => e.currentTarget.form.requestSubmit()}
                    title="Clique para editar"
                  />
                </form>

                <button
                  type="button"
                  class="btn-drill-down"
                  onclick={() => {
                    selectedCatId = cat.id;
                    catView = 'subcategories';
                  }}
                >
                  Subcategorias ›
                </button>

                <form
                  method="post"
                  action="?/deleteCategoria"
                  use:enhance={() =>
                    async ({ update }) => {
                      await update();
                    }}
                >
                  <input type="hidden" name="id" value={cat.id} />
                  <button
                    type="submit"
                    class="btn-delete-sm"
                    onclick={(e) => {
                      if (
                        !confirm(
                          `Excluir categoria "${cat.nome}"? Isso pode afetar subcategorias e itens vinculados.`,
                        )
                      )
                        e.preventDefault();
                    }}>✕</button
                  >
                </form>
              </div>
            {:else}
              <p class="cat-empty">Nenhuma categoria cadastrada ainda.</p>
            {/each}
          </div>

          <!-- Add Categoria -->
          <form
            method="post"
            action="?/addCategoria"
            class="add-cat-form-drill"
            use:enhance={() => {
              const addedName = newCatName;
              return async ({ result, update }) => {
                await update();
                if (result.type === "success") {
                  const newCat = data.categorias.find(c => c.nome.toLowerCase() === addedName.toLowerCase());
                  if (newCat) {
                    selectedCatId = newCat.id;
                    catView = 'subcategories';
                  }
                  newCatName = "";
                }
              };
            }}
          >
            <input
              class="form-input"
              type="text"
              name="nome"
              bind:value={newCatName}
              placeholder="Nome da nova categoria..."
              required
            />
            <button type="submit" class="btn btn-primary btn-sm"
              >+ Categoria</button
            >
          </form>

        {:else}
          <div class="header-back-row">
            <button
              class="btn-back"
              onclick={() => {
                if (catView === 'itens') {
                  catView = 'subcategories';
                } else {
                  catView = 'categories';
                }
              }}
            >
              ← Voltar para {#if catView === 'subcategories'}Categorias{:else}Subcategorias{/if}
            </button>
          </div>

          {#if catView === 'subcategories'}
            <!-- VIEW 2: SUBCATEGORIES -->
            <p class="view-desc">Subcategorias de <strong>{selectedCatName}</strong>. Selecione uma para ver os itens:</p>
            <div class="cats-list-container">
              {#each selectedSubcats as sub (sub.id)}
                <div class="cat-row-drill">
                  <form
                    method="post"
                    action="?/updateSubcategoria"
                    class="editable-input-form"
                    use:enhance
                  >
                    <input type="hidden" name="id" value={sub.id} />
                    <input
                      class="editable-input subcat-name-drill"
                      type="text"
                      name="nome"
                      value={sub.nome}
                      onchange={(e) => e.currentTarget.form.requestSubmit()}
                      title="Clique para editar"
                    />
                  </form>

                  <button
                    type="button"
                    class="btn-drill-down"
                    onclick={() => {
                      selectedSubcatId = sub.id;
                      catView = 'itens';
                    }}
                  >
                    Itens ›
                  </button>

                  <form
                    method="post"
                    action="?/deleteSubcategoria"
                    use:enhance={() =>
                      async ({ update }) => {
                        await update();
                      }}
                  >
                    <input type="hidden" name="id" value={sub.id} />
                    <button
                      type="submit"
                      class="btn-delete-sm"
                      onclick={(e) => {
                        if (!confirm(`Excluir subcategoria "${sub.nome}"?`))
                          e.preventDefault();
                      }}>✕</button
                    >
                  </form>
                </div>
              {:else}
                <p class="cat-empty">Nenhuma subcategoria cadastrada para esta categoria.</p>
              {/each}
            </div>

            <!-- Add Subcategoria -->
            <form
              method="post"
              action="?/addSubcategoria"
              class="add-cat-form-drill"
              use:enhance={() => {
                const addedName = newSubcatName;
                return async ({ result, update }) => {
                  await update();
                  if (result.type === "success") {
                    const subcats = (data.subcategorias as any[]).filter(s => s.categoria_id === selectedCatId);
                    const newSub = subcats.find(s => s.nome.toLowerCase() === addedName.toLowerCase());
                    if (newSub) {
                      selectedSubcatId = newSub.id;
                      catView = 'itens';
                    }
                    newSubcatName = "";
                  }
                };
              }}
            >
              <input type="hidden" name="categoria_id" value={selectedCatId} />
              <input
                class="form-input"
                type="text"
                name="nome"
                bind:value={newSubcatName}
                placeholder="Nome da nova subcategoria..."
                required
              />
              <button type="submit" class="btn btn-primary btn-sm"
                >+ Subcategoria</button
              >
            </form>

          {:else if catView === 'itens'}
            <!-- VIEW 3: ITENS -->
            <p class="view-desc">Itens vinculados à subcategoria <strong>{selectedSubcatName}</strong>:</p>
            <div class="cats-list-container">
              {#each selectedItens as item (item.id)}
                <div class="cat-row-drill">
                  <form
                    method="post"
                    action="?/updateItem"
                    class="editable-input-form"
                    use:enhance
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <input
                      class="editable-input item-name-drill"
                      type="text"
                      name="nome"
                      value={item.nome}
                      onchange={(e) => e.currentTarget.form.requestSubmit()}
                      title="Clique para editar"
                    />
                  </form>

                  <form
                    method="post"
                    action="?/deleteItem"
                    use:enhance={() =>
                      async ({ update }) => {
                        await update();
                      }}
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <button
                      type="submit"
                      class="btn-delete-sm"
                      onclick={(e) => {
                        if (!confirm(`Excluir item "${item.nome}"?`))
                          e.preventDefault();
                      }}>✕</button
                    >
                  </form>
                </div>
              {:else}
                <p class="cat-empty">Nenhum item cadastrado para esta subcategoria.</p>
              {/each}
            </div>

            <!-- Add Item -->
            <form
              method="post"
              action="?/addItem"
              class="add-cat-form-drill"
              use:enhance={() => {
                return async ({ result, update }) => {
                  await update();
                  if (result.type === "success") {
                    newItemName = "";
                  }
                };
              }}
            >
              <input type="hidden" name="subcategoria_id" value={selectedSubcatId} />
              <input
                class="form-input"
                type="text"
                name="nome"
                bind:value={newItemName}
                placeholder="Nome do novo item..."
                required
              />
              <button type="submit" class="btn btn-primary btn-sm"
                >+ Item</button
              >
            </form>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- ════════════════════════════════════════════════════════════════════════════
     MODAL: EDITAR GASTO
     ════════════════════════════════════════════════════════════════════════════ -->
{#if editGasto}
  <div
    class="overlay"
    role="dialog"
    aria-modal="true"
    onclick={() => (editGasto = null)}
  >
    <div class="modal modal-edit" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title">Editar Gasto</h2>
        <button class="modal-close" onclick={() => (editGasto = null)}>✕</button
        >
      </div>

      <form
        method="post"
        action="?/updateGasto"
        use:enhance={() =>
          async ({ result, update }) => {
            if (result.type === "success") editGasto = null;
            await update();
          }}
      >
        <input type="hidden" name="id" value={editGasto.id} />
        <!-- Campos hierárquicos necessários para o update -->
        <input type="hidden" name="item_id" value={editGasto.item_id} />
        <input
          type="hidden"
          name="categoria_id"
          value={editGasto.categoria_id}
        />
        <input
          type="hidden"
          name="subcategoria_id"
          value={editGasto.subcategoria_id}
        />

        <div class="modal-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Data</label>
              <input
                class="form-input"
                type="date"
                name="data"
                bind:value={editGasto.data}
                required
              />
            </div>
            <div class="form-group">
              <label class="form-label">Parcelas</label>
              <select
                class="form-input"
                name="parcelas"
                bind:value={editGasto.parcelas}
              >
                {#each PARCELAS_OPTIONS as n}<option value={n}>{n}×</option
                  >{/each}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Tipo</label>
              <select
                class="form-input"
                name="tipo"
                bind:value={editGasto.tipo}
              >
                {#each TIPOS as t}<option>{t}</option>{/each}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Pagamento</label>
              <select
                class="form-input"
                name="pagamento"
                bind:value={editGasto.pagamento}
              >
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
                onblur={() => setTimeout(() => (editItemOpen = false), 180)}
                placeholder="Pesquisar item..."
                autocomplete="off"
              />
              {#if editItemOpen && editItemResults.length > 0}
                <div class="dropdown">
                  {#each editItemResults as r}
                    <button
                      type="button"
                      class="dropdown-item"
                      onmousedown={() => pickEditItem(r)}
                    >
                      <span class="di-nome">{r.nome}</span>
                      <span class="di-sub"
                        >{r.subcategoria_nome} › {r.categoria_nome}</span
                      >
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
            <div class="form-group">
              <label class="form-label">Subcategoria</label>
              <input
                class="form-input readonly-input"
                type="text"
                readonly
                value={editGasto.subcategoria_nome || ""}
              />
            </div>
            <div class="form-group">
              <label class="form-label">Categoria</label>
              <input
                class="form-input readonly-input"
                type="text"
                readonly
                value={editGasto.categoria_nome || ""}
              />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Valor (R$)</label>
              <input
                class="form-input"
                type="text"
                inputmode="numeric"
                name="valor"
                value={editGasto.valor}
                oninput={(e) => {
                  editGasto.valor = formatCurrencyInput(e.currentTarget.value);
                }}
                required
              />
            </div>
            <div class="form-group" style="flex:2">
              <label class="form-label">Comentário</label>
              <input
                class="form-input"
                type="text"
                name="comentario"
                bind:value={editGasto.comentario}
                placeholder="Opcional..."
              />
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-ghost"
            onclick={() => (editGasto = null)}>Cancelar</button
          >
          <button
            type="submit"
            class="btn btn-primary"
            onclick={(e) => {
              if (!editGasto?.item_id) {
                e.preventDefault();
                alert("Selecione um item válido na lista de pesquisa.");
              }
            }}
          >
            ✓ Salvar alterações
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- ════════════════════════════════════════════════════════════════════════════
     MODAL: IMPORTAR CSV
     ════════════════════════════════════════════════════════════════════════════ -->
{#if showImportCSV}
  <div
    class="overlay"
    role="dialog"
    aria-modal="true"
    onclick={() => resetCSVImport()}
  >
    <div class="modal modal-csv" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2 class="modal-title">Importar Dados via CSV</h2>
        <button class="modal-close" onclick={resetCSVImport}>✕</button>
      </div>

      <form
        method="post"
        action="?/importCSV"
        enctype="multipart/form-data"
        use:enhance={() => {
          csvImporting = true;
          return async ({ result, update }) => {
            csvImporting = false;
            if (result.type === "success" && result.data) {
              csvResult = result.data;
            }
            await update();
          };
        }}
      >
        <div class="modal-body">
          <p class="csv-description">
            Selecione um arquivo CSV contendo as colunas: <strong
              >data, valor, parcelas, categoria, subcategoria, item, tipo,
              comentario, pagamento</strong
            >. Categorias, subcategorias e itens serão criados automaticamente
            caso não existam.
          </p>

          <!-- Drop zone -->
          <div
            class="csv-dropzone"
            class:dragging={csvDragging}
            class:has-file={csvFile}
            ondragover={(e) => {
              e.preventDefault();
              csvDragging = true;
            }}
            ondragleave={() => (csvDragging = false)}
            ondrop={handleCSVDrop}
            onclick={() => document.getElementById("csv-file-input")?.click()}
          >
            {#if csvFile}
              <div class="csv-file-info">
                <span class="csv-file-icon">📄</span>
                <div class="csv-file-details">
                  <span class="csv-file-name">{csvFile.name}</span>
                  <span class="csv-file-size"
                    >{(csvFile.size / 1024).toFixed(1)} KB</span
                  >
                </div>
                <button
                  type="button"
                  class="csv-file-remove"
                  onclick={(e) => {
                    e.stopPropagation();
                    csvFile = null;
                    csvResult = null;
                  }}>✕</button
                >
              </div>
            {:else}
              <div class="csv-drop-content">
                <span class="csv-drop-icon">⇪</span>
                <span class="csv-drop-text">Arraste o arquivo CSV aqui</span>
                <span class="csv-drop-sub">ou clique para selecionar</span>
              </div>
            {/if}
          </div>

          <input
            id="csv-file-input"
            type="file"
            name="csvFile"
            accept=".csv,text/csv"
            style="display:none"
            onchange={handleCSVSelect}
          />

          <!-- CSV format example -->
          <div class="csv-format-box">
            <span class="csv-format-title">Formato esperado:</span>
            <code class="csv-format-example"
              >data,valor,parcelas,categoria,subcategoria,item,tipo,comentario,pagamento<br
              />01/02/2025,18.98,1,Alimentação,Ovos,ovos,variável,,pix</code
            >
          </div>

          <!-- Result display -->
          {#if csvResult}
            <div
              class="csv-result"
              class:csv-result-success={csvResult.imported &&
                csvResult.imported > 0}
            >
              <div class="csv-result-header">
                <span class="csv-result-icon"
                  >{csvResult.imported && csvResult.imported > 0
                    ? "✓"
                    : "⚠"}</span
                >
                <span class="csv-result-text">
                  {csvResult.imported || 0} de {csvResult.total || 0} registros importados
                  com sucesso
                </span>
              </div>
              {#if csvResult.errors && csvResult.errors.length > 0}
                <div class="csv-result-errors">
                  {#each csvResult.errors as err}
                    <div class="csv-error-line">⚠ {err}</div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" onclick={resetCSVImport}>
            {csvResult ? "Fechar" : "Cancelar"}
          </button>
          {#if !csvResult}
            <button
              type="submit"
              class="btn btn-blue"
              disabled={!csvFile || csvImporting}
              onclick={(e) => {
                if (!csvFile) {
                  e.preventDefault();
                  return;
                }
                // Attach file to form
                const input = document.getElementById(
                  "csv-file-input",
                ) as HTMLInputElement;
                if (input && csvFile) {
                  const dt = new DataTransfer();
                  dt.items.add(csvFile);
                  input.files = dt.files;
                }
              }}
            >
              {#if csvImporting}
                <span class="btn-spinner"></span> Importando...
              {:else}
                ⇪ Importar Dados
              {/if}
            </button>
          {/if}
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  /* ── Reset & tokens ────────────────────────────────────────────────────── */
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* ── App shell ────────────────────────────────────────────────────────── */
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg);
  }

  /* ── Header ───────────────────────────────────────────────────────────── */
  .header {
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 2px 24px rgba(0, 0, 0, 0.4);
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
  .brand {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .brand-icon {
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, var(--green), var(--green-dim));
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    color: #000;
    font-family: "Inter", sans-serif;
    font-weight: 700;
    box-shadow: 0 4px 12px rgba(0, 224, 123, 0.3);
  }
  .brand-text h1 {
    font-family: "Inter", sans-serif;
    font-size: 22px;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.5px;
  }
  .brand-text p {
    font-size: 12px;
    color: var(--text-3);
    margin-top: 1px;
  }
  .header-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  /* ── Buttons ──────────────────────────────────────────────────────────── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    border: none;
    border-radius: var(--radius);
    font-family: "DM Sans", sans-serif;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.18s ease;
    white-space: nowrap;
  }
  .btn-icon {
    font-size: 16px;
    font-weight: 400;
  }
  .btn-primary {
    background: linear-gradient(135deg, var(--green), var(--green-dim));
    color: #000;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0, 224, 123, 0.3);
  }
  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(0, 224, 123, 0.4);
  }
  .btn-blue {
    background: linear-gradient(135deg, var(--blue), var(--blue-dim));
    color: #fff;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(66, 133, 255, 0.3);
  }
  .btn-blue:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(66, 133, 255, 0.4);
  }
  .btn-blue:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  .btn-outline {
    background: var(--bg-elevated);
    color: var(--text-2);
    border: 1px solid var(--border-2);
  }
  .btn-outline:hover {
    background: var(--bg-hover);
    color: #fff;
    border-color: var(--border-3);
  }
  .btn-ghost {
    background: transparent;
    color: var(--text-2);
    border: 1px solid var(--border);
  }
  .btn-ghost:hover {
    background: var(--bg-elevated);
    color: #fff;
  }
  .btn-filter {
    background: var(--blue-dim);
    color: #fff;
    align-self: flex-end;
    padding: 10px 22px;
    border-radius: var(--radius);
    border: none;
    font-family: "DM Sans", sans-serif;
    font-weight: 500;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.18s;
  }
  .btn-filter:hover {
    background: var(--blue);
  }
  .btn-sm {
    padding: 8px 16px;
    font-size: 13px;
  }

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
    background: var(--bg-card);
    border: 1px solid var(--border);
    padding: 16px 20px;
    border-radius: var(--radius-lg);
    margin-bottom: 16px;
  }
  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .filter-search {
    flex: 1;
    min-width: 200px;
  }
  .filter-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .filter-input {
    padding: 9px 12px;
    border: 1px solid var(--border-2);
    border-radius: 8px;
    font-family: "DM Sans", sans-serif;
    font-size: 14px;
    color: #fff;
    background: var(--bg-input);
    transition: border-color 0.15s;
    outline: none;
    min-width: 120px;
    color-scheme: dark;
  }
  .filter-input:focus {
    border-color: var(--blue);
    background: var(--bg-elevated);
  }

  /* ── Summary bar ──────────────────────────────────────────────────────── */
  .summary-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 4px;
    margin-bottom: 10px;
  }
  .summary-count {
    font-size: 13px;
    color: var(--text-3);
    font-family: "DM Mono", monospace;
  }
  .summary-total {
    font-size: 14px;
    color: var(--text-2);
  }
  .summary-total strong {
    font-size: 18px;
    color: var(--green);
    font-family: "Inter", sans-serif;
  }

  /* ── Table ────────────────────────────────────────────────────────────── */
  .table-wrapper {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13.5px;
  }
  .data-table thead tr {
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--border-2);
  }
  .data-table th {
    padding: 12px 14px;
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
  }
  .data-table th.right {
    text-align: right;
  }
  .data-table th.center {
    text-align: center;
  }
  .data-row {
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    transition: background 0.12s;
  }
  .data-row:hover {
    background: var(--bg-hover);
  }
  .data-row td {
    padding: 11px 14px;
    vertical-align: middle;
  }
  .date-cell {
    white-space: nowrap;
    color: var(--text-3);
    font-family: "DM Mono", monospace;
    font-size: 12px;
  }
  .item-cell {
    font-weight: 500;
    color: #fff;
  }
  .muted-cell {
    color: var(--text-3);
    font-size: 13px;
  }
  .value-cell {
    text-align: right;
    font-weight: 600;
    color: var(--green);
    font-family: "Inter", sans-serif;
    white-space: nowrap;
  }
  .comment-cell {
    color: var(--text-3);
    font-size: 13px;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .center {
    text-align: center;
    color: var(--text-3);
  }
  .delete-cell {
    width: 40px;
    text-align: center;
  }
  .empty-row {
    text-align: center;
    padding: 48px 20px;
    color: var(--text-3);
    font-size: 14px;
  }

  /* ── Badge & pills ────────────────────────────────────────────────────── */
  .badge {
    display: inline-block;
    padding: 3px 10px;
    background: var(--blue-bg);
    color: var(--blue);
    border: 1px solid rgba(66, 133, 255, 0.2);
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
  .tipo-variável {
    background: var(--amber-bg);
    color: var(--amber);
    border: 1px solid rgba(245, 158, 11, 0.2);
  }
  .tipo-fixo {
    background: var(--blue-bg);
    color: var(--blue);
    border: 1px solid rgba(66, 133, 255, 0.2);
  }
  .tipo-eventual {
    background: rgba(219, 39, 119, 0.1);
    color: #f472b6;
    border: 1px solid rgba(219, 39, 119, 0.2);
  }

  /* ── Delete button ────────────────────────────────────────────────────── */
  .btn-delete {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    border: none;
    background: transparent;
    color: var(--text-3);
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  .btn-delete:hover {
    background: var(--red-bg);
    color: var(--red);
  }

  /* ── Overlay & modals ─────────────────────────────────────────────────── */
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(3, 6, 18, 0.85);
    backdrop-filter: blur(6px);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: fadeIn 0.18s ease;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .modal {
    background: var(--bg-card);
    border: 1px solid var(--border-2);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.22s ease;
    overflow: hidden;
  }
  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  .modal-xl {
    max-width: 1100px;
  }
  .modal-cat {
    max-width: 640px;
    max-height: 85vh;
  }
  .modal-edit {
    max-width: 780px;
  }

  .modal > form {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 28px 18px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .modal-title {
    font-family: "Inter", sans-serif;
    font-size: 20px;
    font-weight: 700;
    color: #fff;
  }
  .modal-close {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-elevated);
    color: var(--text-2);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  .modal-close:hover {
    background: var(--red-bg);
    color: var(--red);
    border-color: rgba(255, 77, 90, 0.3);
  }

  .modal-body {
    padding: 24px 28px 32px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 16px 28px 20px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }

  /* ── Forms ────────────────────────────────────────────────────────────── */
  .form-row {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    margin-bottom: 18px;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 120px;
  }
  .form-label {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .form-input {
    padding: 10px 13px;
    border: 1px solid var(--border-2);
    border-radius: 9px;
    font-family: "DM Sans", sans-serif;
    font-size: 14px;
    color: #fff;
    background: var(--bg-input);
    outline: none;
    transition:
      border-color 0.15s,
      background 0.15s;
    width: 100%;
    color-scheme: dark;
  }
  .form-input:focus {
    border-color: var(--blue);
    background: var(--bg-elevated);
  }
  .readonly-input {
    background: var(--bg-surface);
    color: var(--text-3);
    cursor: default;
  }
  .readonly-input:focus {
    border-color: var(--border-2);
    background: var(--bg-surface);
  }

  /* ── Section divider ──────────────────────────────────────────────────── */
  .section-divider {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid var(--border);
    padding-top: 16px;
    margin-bottom: 14px;
  }
  .section-divider span {
    font-family: "Inter", sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-2);
  }
  .btn-add-row {
    padding: 7px 14px;
    background: var(--blue-bg);
    color: var(--blue);
    border: 1px dashed rgba(66, 133, 255, 0.4);
    border-radius: 8px;
    font-family: "DM Sans", sans-serif;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-add-row:hover {
    background: var(--bg-hover);
    border-color: var(--blue);
  }

  /* ── Items grid ───────────────────────────────────────────────────────── */
  .items-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .items-grid-header {
    display: flex;
    gap: 8px;
    padding: 0 0 6px;
    border-bottom: 1px solid var(--border);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  .item-line {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    transition: border-color 0.15s;
  }
  .item-line:hover {
    border-color: var(--border-2);
  }
  .item-field {
    display: flex;
    flex-direction: column;
  }

  /* ── Dropdown ─────────────────────────────────────────────────────────── */
  .dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--bg-elevated);
    border: 1px solid var(--border-2);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    z-index: 200;
    max-height: 220px;
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
    border-bottom: 1px solid var(--border);
    transition: background 0.1s;
  }
  .dropdown-item:hover {
    background: var(--bg-hover);
  }
  .dropdown-item:last-child {
    border-bottom: none;
  }
  .di-nome {
    font-size: 13.5px;
    font-weight: 500;
    color: #fff;
  }
  .di-sub {
    font-size: 11.5px;
    color: var(--text-3);
  }

  /* ── Remove line ──────────────────────────────────────────────────────── */
  .btn-rm-line {
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text-3);
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 28px;
    transition: all 0.15s;
  }
  .btn-rm-line:hover {
    background: var(--red-bg);
    color: var(--red);
  }

  /* ── Compra total ─────────────────────────────────────────────────────── */
  .compra-total {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 14px 16px;
    margin-top: 12px;
    background: var(--green-bg);
    border: 1px solid rgba(0, 224, 123, 0.15);
    border-radius: var(--radius);
  }
  .compra-total span {
    font-size: 14px;
    color: var(--text-2);
    font-weight: 500;
  }
  .total-value {
    font-family: "Inter", sans-serif;
    font-size: 22px;
    font-weight: 700;
    color: var(--green);
  }

  /* ── Category manager ─────────────────────────────────────────────────── */
  .cat-manager {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .cat-card {
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--bg-elevated);
  }
  .cat-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    background: var(--bg-card);
  }
  .expand-toggle-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text-3);
    border-radius: 4px;
    transition: all 0.15s ease;
  }
  .expand-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
  }
  .editable-input-form {
    flex: 1;
    display: flex;
    align-items: center;
    margin: 0;
    padding: 0;
  }
  .editable-input {
    background: transparent;
    border: none;
    border-bottom: 1px dashed transparent;
    color: #fff;
    font-family: inherit;
    font-size: 14.5px;
    font-weight: 600;
    padding: 2px 4px;
    width: 100%;
    outline: none;
    transition: all 0.15s ease;
  }
  .editable-input:hover {
    background: rgba(255, 255, 255, 0.03);
    border-bottom-color: var(--border-3);
  }
  .editable-input:focus {
    background: var(--bg-input);
    border-bottom: 1px solid var(--blue);
    border-radius: 4px;
  }
  .expand-icon {
    font-size: 12px;
    color: var(--text-3);
    width: 14px;
  }
  .cat-count {
    font-size: 11.5px;
    color: var(--text-3);
    margin-right: 8px;
    white-space: nowrap;
  }
  .cat-children {
    padding: 8px 14px 12px 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .subcat-card {
    border: 1px solid var(--border);
    border-radius: 9px;
    background: var(--bg-surface);
    overflow: hidden;
  }
  .subcat-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
  }
  .subcat-name {
    font-weight: 500;
    color: var(--text-2);
    font-size: 13.5px;
  }
  .items-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 12px 10px 24px;
    border-top: 1px solid var(--border);
  }
  .item-chip-editable {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px 2px 10px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-2);
    border-radius: 20px;
    transition: all 0.15s ease;
  }
  .item-chip-editable:hover {
    border-color: var(--border-3);
    background: var(--bg-hover);
  }
  .item-chip-input {
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-2);
    width: 100px;
    border-bottom: none;
    padding: 0;
  }
  .item-chip-input:focus {
    width: 130px;
    background: transparent;
  }
  .chip-delete-btn {
    width: 16px;
    height: 16px;
    border: none;
    background: transparent;
    color: var(--text-3);
    font-size: 9px;
    cursor: pointer;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s;
    padding: 0;
  }
  .chip-delete-btn:hover {
    background: var(--red-bg);
    color: var(--red);
  }
  .btn-delete-sm {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--text-3);
    font-size: 11px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.14s;
    flex-shrink: 0;
  }
  .btn-delete-sm:hover {
    background: var(--red-bg);
    color: var(--red);
  }
  .inline-form {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .inline-input {
    padding: 5px 10px;
    border: 1px solid var(--border-2);
    border-radius: 7px;
    font-family: "DM Sans", sans-serif;
    font-size: 13px;
    color: #fff;
    background: var(--bg-input);
    outline: none;
    width: 180px;
    transition: border-color 0.15s;
    color-scheme: dark;
  }
  .inline-input:focus {
    border-color: var(--blue);
  }
  .btn-inline-add {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 7px;
    background: var(--green-dim);
    color: #000;
    font-size: 18px;
    font-weight: 300;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
    flex-shrink: 0;
    line-height: 1;
  }
  .btn-inline-add:hover {
    background: var(--green);
  }
  .add-subcat-form {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-top: 6px;
    border-top: 1px dashed var(--border);
    margin-top: 2px;
  }
  .add-cat-form {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 14px 16px;
    background: var(--bg-elevated);
    border: 1px dashed var(--border-2);
    border-radius: var(--radius-lg);
    margin-top: 4px;
  }
  .add-cat-form .form-input {
    flex: 1;
  }
  .cat-empty {
    color: var(--text-3);
    font-size: 13.5px;
    text-align: center;
    padding: 24px 0;
  }

  /* ── CSV Import Modal ────────────────────────────────────────────────── */
  .modal-csv {
    max-width: 640px;
  }
  .csv-description {
    font-size: 13.5px;
    color: var(--text-2);
    line-height: 1.6;
    margin-bottom: 20px;
  }
  .csv-description strong {
    color: var(--text);
    font-weight: 600;
  }

  .csv-dropzone {
    border: 2px dashed var(--border-2);
    border-radius: var(--radius-lg);
    padding: 40px 24px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    background: var(--bg-input);
    margin-bottom: 18px;
  }
  .csv-dropzone:hover,
  .csv-dropzone.dragging {
    border-color: var(--blue);
    background: var(--blue-bg);
  }
  .csv-dropzone.has-file {
    border-style: solid;
    border-color: var(--green);
    background: var(--green-bg);
    padding: 18px 20px;
  }

  .csv-drop-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .csv-drop-icon {
    font-size: 36px;
    color: var(--blue);
    line-height: 1;
    margin-bottom: 4px;
  }
  .csv-drop-text {
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
  }
  .csv-drop-sub {
    font-size: 12.5px;
    color: var(--text-3);
  }

  .csv-file-info {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .csv-file-icon {
    font-size: 28px;
  }
  .csv-file-details {
    display: flex;
    flex-direction: column;
    flex: 1;
    text-align: left;
  }
  .csv-file-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
  }
  .csv-file-size {
    font-size: 12px;
    color: var(--text-3);
    font-family: "DM Mono", monospace;
  }
  .csv-file-remove {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--text-3);
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }
  .csv-file-remove:hover {
    background: var(--red-bg);
    color: var(--red);
  }

  .csv-format-box {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 16px;
    margin-bottom: 18px;
  }
  .csv-format-title {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-3);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }
  .csv-format-example {
    font-family: "DM Mono", monospace;
    font-size: 11.5px;
    color: var(--text-2);
    line-height: 1.7;
    display: block;
    word-break: break-all;
  }

  .csv-result {
    border: 1px solid var(--amber);
    background: var(--amber-bg);
    border-radius: var(--radius);
    padding: 16px;
  }
  .csv-result.csv-result-success {
    border-color: var(--green);
    background: var(--green-bg);
  }
  .csv-result-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .csv-result-icon {
    font-size: 20px;
  }
  .csv-result-success .csv-result-icon {
    color: var(--green);
  }
  .csv-result-text {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
  }
  .csv-result-errors {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .csv-error-line {
    font-size: 12.5px;
    color: var(--amber);
    font-family: "DM Mono", monospace;
  }

  .btn-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ── Category drill-down styles ── */
  .view-desc {
    font-size: 13.5px;
    color: var(--text-2);
    margin-bottom: 14px;
    line-height: 1.5;
  }
  .cats-list-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 380px;
    overflow-y: auto;
    margin-bottom: 16px;
    padding-right: 4px;
  }
  .cat-row-drill {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    transition: all 0.15s ease;
  }
  .cat-row-drill:hover {
    border-color: var(--border-2);
    background: var(--bg-hover);
  }
  .btn-drill-down {
    background: var(--blue-bg);
    color: var(--blue);
    border: 1px solid rgba(66, 133, 255, 0.2);
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  .btn-drill-down:hover {
    background: var(--blue);
    color: #fff;
    border-color: var(--blue);
  }
  .add-cat-form-drill {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 12px;
    background: var(--bg-elevated);
    border: 1px dashed var(--border-2);
    border-radius: var(--radius-lg);
    margin-top: 10px;
  }
  .add-cat-form-drill .form-input {
    flex: 1;
  }
  .header-back-row {
    margin-bottom: 12px;
  }
  .btn-back {
    background: transparent;
    border: 1px solid var(--border-2);
    color: var(--text-2);
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .btn-back:hover {
    background: var(--bg-elevated);
    color: #fff;
    border-color: var(--border-3);
  }
  .btn-back-header {
    background: transparent;
    border: 1px solid var(--border-2);
    color: var(--text-2);
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    display: inline-flex;
    align-items: center;
  }
  .btn-back-header:hover {
    background: var(--bg-elevated);
    color: #fff;
  }
</style>
