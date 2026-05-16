<script lang="ts">
  let { data } = $props();

  // ── Filters (local state, synced with URL params) ──
  let ano = $state(data.filters.ano);
  let mesInicio = $state(data.filters.mesInicio);
  let mesFim = $state(data.filters.mesFim);
  let estratificacao = $state<'categoria' | 'subcategoria'>(data.filters.estratificacao as any);

  // ── Helpers ──
  function fmt(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  function fmtShort(v: number) {
    if (Math.abs(v) >= 1000) {
      return (v / 1000).toFixed(1).replace('.', ',') + 'k';
    }
    return v.toFixed(0);
  }

  const MESES_NOMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  // ── Build month columns ──
  let mesesColunas = $derived.by(() => {
    const cols: string[] = [];
    for (let m = mesInicio; m <= mesFim; m++) {
      cols.push(`${ano}-${String(m).padStart(2, '0')}`);
    }
    return cols;
  });

  // ── Drill down state ──
  let showDetails = $state(false);
  let detailTitle = $state("");
  let detailItems = $state<any[]>([]);

  function openDetails(items: any[], title: string) {
    if (!items.length) return;
    detailItems = [...items].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    detailTitle = title;
    showDetails = true;
  }

  function fmtDate(d: string) {
    if (!d) return "—";
    const [y, m, dd] = d.split("-");
    return `${dd}/${m}/${y}`;
  }

  let pivotData = $derived.by(() => {
    const gastos = data.gastos as any[];
    const cols = mesesColunas;

    // map[groupKey][rowKey][month] -> items[]
    const map: Record<string, Record<string, Record<string, any[]>>> = {};
    const groupNames: Record<string, string> = {};
    const rowNames: Record<string, string> = {};

    for (const g of gastos) {
      const mes = g.data?.substring(0, 7);
      if (!cols.includes(mes)) continue;

      let gKey: string, rKey: string, gName: string, rName: string;

      if (estratificacao === 'subcategoria') {
        gKey = `cat-${g.categoria_id || 'none'}`;
        gName = g.categoria_nome || 'Sem categoria';
        rKey = `sub-${g.subcategoria_id || 'none'}`;
        rName = g.subcategoria_nome || 'Sem subcategoria';
      } else {
        gKey = 'all';
        gName = '';
        rKey = `cat-${g.categoria_id || 'none'}`;
        rName = g.categoria_nome || 'Sem categoria';
      }

      if (!map[gKey]) map[gKey] = {};
      if (!map[gKey][rKey]) map[gKey][rKey] = {};
      if (!map[gKey][rKey][mes]) map[gKey][rKey][mes] = [];
      
      groupNames[gKey] = gName;
      rowNames[rKey] = rName;
      map[gKey][rKey][mes].push(g);
    }

    const groups = Object.keys(map).map(gk => {
      const rowKeys = Object.keys(map[gk]);
      const rows = rowKeys.map(rk => {
        const cellValues = cols.map(c => {
          const items = map[gk][rk][c] || [];
          return {
            sum: items.reduce((s, g) => s + (g.valor || 0), 0),
            items
          };
        });
        return {
          key: rk,
          name: rowNames[rk],
          values: cellValues,
          total: cellValues.reduce((s, v) => s + v.sum, 0)
        };
      }).sort((a, b) => b.total - a.total);

      const groupValues = cols.map((_, i) => {
        const items = rows.flatMap(r => r.values[i].items);
        return {
          sum: rows.reduce((s, r) => s + r.values[i].sum, 0),
          items
        };
      });
      const groupTotal = rows.reduce((s, r) => s + r.total, 0);

      return {
        key: gk,
        name: groupNames[gk],
        rows,
        values: groupValues,
        total: groupTotal
      };
    }).sort((a, b) => b.total - a.total);

    const colTotals = cols.map((_, i) => {
      const items = groups.flatMap(g => g.values[i].items);
      return {
        sum: groups.reduce((s, g) => s + g.values[i].sum, 0),
        items
      };
    });
    const grandTotal = colTotals.reduce((s, v) => s + v.sum, 0);

    return { cols, groups, colTotals, grandTotal };
  });

  // ── Averages (últimos 3, 6, 12 meses) ──
  let averages = $derived.by(() => {
    const gastosAvg = data.gastosAvg as any[];
    const now = new Date();

    function calcAvg(monthsBack: number) {
      const ref = new Date(now);
      ref.setMonth(ref.getMonth() - monthsBack);
      const refStr = ref.toISOString().split('T')[0];

      const map: Record<string, number> = {};
      const groupMap: Record<string, number> = {};
      const mesesSet = new Set<string>();

      for (const g of gastosAvg) {
        if (g.data < refStr) continue;
        const mes = g.data?.substring(0, 7);
        mesesSet.add(mes);

        let gKey: string, rKey: string;
        if (estratificacao === 'subcategoria') {
          gKey = `cat-${g.categoria_id || 'none'}`;
          rKey = `sub-${g.subcategoria_id || 'none'}`;
        } else {
          gKey = 'all';
          rKey = `cat-${g.categoria_id || 'none'}`;
        }

        map[rKey] = (map[rKey] || 0) + (g.valor || 0);
        groupMap[gKey] = (groupMap[gKey] || 0) + (g.valor || 0);
      }

      const numMeses = Math.max(mesesSet.size, 1);
      const perRow: Record<string, number> = {};
      for (const key of Object.keys(map)) perRow[key] = map[key] / numMeses;
      
      const perGroup: Record<string, number> = {};
      for (const key of Object.keys(groupMap)) perGroup[key] = groupMap[key] / numMeses;

      const totalAvg = Object.values(map).reduce((s, v) => s + v, 0) / numMeses;
      return { perRow, perGroup, total: totalAvg };
    }

    return {
      avg3: calcAvg(3),
      avg6: calcAvg(6),
      avg12: calcAvg(12)
    };
  });
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=DM+Mono:wght@300;400;500&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap" rel="stylesheet" />
</svelte:head>

<div class="page">
  <header class="page-header">
    <div class="page-header-inner">
      <div class="page-title-wrap">
        <h1 class="page-title">Dashboard Detalhado</h1>
        <span class="page-subtitle">Tabela analítica · {estratificacao === 'categoria' ? 'por Categoria' : 'por Subcategoria'}</span>
      </div>
    </div>
  </header>

  <main class="page-main">
    <!-- Filters bar -->
    <form method="get" class="filters-bar">
      <div class="filter-group">
        <label class="filter-label">Ano</label>
        <select class="filter-input" name="ano" bind:value={ano}>
          {#each data.anosDisponiveis as a}
            <option value={a}>{a}</option>
          {/each}
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Mês início</label>
        <select class="filter-input" name="mesInicio" bind:value={mesInicio}>
          {#each MESES_FULL as m, i}
            <option value={i + 1}>{m}</option>
          {/each}
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Mês fim</label>
        <select class="filter-input" name="mesFim" bind:value={mesFim}>
          {#each MESES_FULL as m, i}
            <option value={i + 1}>{m}</option>
          {/each}
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Estratificar por</label>
        <select class="filter-input" name="estratificacao" bind:value={estratificacao}>
          <option value="categoria">Categoria</option>
          <option value="subcategoria">Subcategoria</option>
        </select>
      </div>
      <button type="submit" class="btn btn-filter">Filtrar</button>
    </form>

    <!-- Pivot Table -->
    <div class="table-scroll">
      <div class="table-wrap">
        <table class="pivot-table">
          <thead>
            <tr>
              <th class="th-sticky">{estratificacao === 'categoria' ? 'Categoria' : 'Subcategoria'}</th>
              {#each pivotData.cols as col}
                <th class="th-month">{MESES_NOMES[parseInt(col.split('-')[1]) - 1]}</th>
              {/each}
              <th class="th-total">Total</th>
              <th class="th-avg">Méd. 3m</th>
              <th class="th-avg">Méd. 6m</th>
              <th class="th-avg">Méd. 12m</th>
            </tr>
          </thead>
          <tbody>
            {#each pivotData.groups as group}
              {#if estratificacao === 'subcategoria'}
                <!-- Category Header Row -->
                <tr class="pivot-group-header">
                  <td class="td-name td-group-name">{group.name}</td>
                  {#each group.values as gval, i}
                    <td 
                      class="td-value td-group-val" 
                      class:clickable={gval.sum > 0}
                      onclick={() => openDetails(gval.items, `${group.name} — ${MESES_NOMES[parseInt(pivotData.cols[i].split('-')[1]) - 1]}/${ano}`)}
                    >
                      {gval.sum > 0 ? fmt(gval.sum) : '—'}
                    </td>
                  {/each}
                  <td class="td-total">{fmt(group.total)}</td>
                  <td class="td-avg">{fmt(averages.avg3.perGroup[group.key] || 0)}</td>
                  <td class="td-avg">{fmt(averages.avg6.perGroup[group.key] || 0)}</td>
                  <td class="td-avg">{fmt(averages.avg12.perGroup[group.key] || 0)}</td>
                </tr>
              {/if}

              {#each group.rows as row}
                <tr class="pivot-row" class:row-sub={estratificacao === 'subcategoria'}>
                  <td class="td-name">{row.name}</td>
                  {#each row.values as val, i}
                    <td 
                      class="td-value" 
                      class:td-zero={val.sum === 0} 
                      class:clickable={val.sum > 0}
                      onclick={() => openDetails(val.items, `${row.name} — ${MESES_NOMES[parseInt(pivotData.cols[i].split('-')[1]) - 1]}/${ano}`)}
                    >
                      {val.sum > 0 ? fmt(val.sum) : '—'}
                    </td>
                  {/each}
                  <td class="td-total">{fmt(row.total)}</td>
                  <td class="td-avg">{fmt(averages.avg3.perRow[row.key] || 0)}</td>
                  <td class="td-avg">{fmt(averages.avg6.perRow[row.key] || 0)}</td>
                  <td class="td-avg">{fmt(averages.avg12.perRow[row.key] || 0)}</td>
                </tr>
              {/each}
            {:else}
              <tr>
                <td colspan={pivotData.cols.length + 5} class="td-empty">Nenhum dado encontrado para o período selecionado.</td>
              </tr>
            {/each}
          </tbody>

          {#if pivotData.groups.length > 0}
            <tfoot>
              <tr class="pivot-total-row">
                <td class="td-name td-total-label">Total Mensal</td>
                {#each pivotData.colTotals as ct, i}
                  <td 
                    class="td-total-value clickable" 
                    onclick={() => openDetails(ct.items, `Total — ${MESES_NOMES[parseInt(pivotData.cols[i].split('-')[1]) - 1]}/${ano}`)}
                  >
                    {fmt(ct.sum)}
                  </td>
                {/each}
                <td class="td-grand-total">{fmt(pivotData.grandTotal)}</td>
                <td class="td-total-avg">{fmt(averages.avg3.total)}</td>
                <td class="td-total-avg">{fmt(averages.avg6.total)}</td>
                <td class="td-total-avg">{fmt(averages.avg12.total)}</td>
              </tr>
            </tfoot>
          {/if}
        </table>
      </div>
    </div>

    <!-- Summary Cards -->
    {#if pivotData.groups.length > 0}
      <div class="summary-cards">
        <div class="stat-card">
          <div class="stat-label">Total do Período</div>
          <div class="stat-value green">{fmt(pivotData.grandTotal)}</div>
          <div class="stat-sub">{MESES_NOMES[mesInicio - 1]} — {MESES_NOMES[mesFim - 1]} / {ano}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Média Mensal (Período)</div>
          <div class="stat-value blue">{fmt(pivotData.grandTotal / pivotData.cols.length)}</div>
          <div class="stat-sub">{pivotData.cols.length} meses</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Média Mensal (12m)</div>
          <div class="stat-value amber">{fmt(averages.avg12.total)}</div>
          <div class="stat-sub">últimos 12 meses</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">{estratificacao === 'categoria' ? 'Categorias' : 'Subcategorias'}</div>
          <div class="stat-value">{pivotData.groups.reduce((acc, g) => acc + g.rows.length, 0)}</div>
          <div class="stat-sub">com lançamentos</div>
        </div>
      </div>
    {/if}
  </main>
</div>

<!-- ── Detail Modal ── -->
{#if showDetails}
  <div class="overlay" role="dialog" aria-modal="true" onclick={() => (showDetails = false)}>
    <div class="modal modal-details" onclick={(e) => e.stopPropagation()}>
      <div class="modal-hdr">
        <div class="modal-hdr-text">
          <h2 class="modal-title">{detailTitle}</h2>
          <span class="modal-subtitle">{detailItems.length} lançamentos</span>
        </div>
        <button class="modal-close" onclick={() => (showDetails = false)}>✕</button>
      </div>
      <div class="modal-body">
        <div class="details-list">
          {#each detailItems as item}
            <div class="detail-item">
              <div class="di-left">
                <span class="di-date">{fmtDate(item.data)}</span>
                <span class="di-item-name">{item.item_nome}</span>
                {#if item.comentario}
                  <span class="di-comment">{item.comentario}</span>
                {/if}
              </div>
              <div class="di-right">
                <span class="di-value">{fmt(item.valor)}</span>
                <span class="di-pay">{item.pagamento}</span>
              </div>
            </div>
          {/each}
        </div>
      </div>
      <div class="modal-ftr">
        <div class="detail-total">
          <span>Total</span>
          <strong>{fmt(detailItems.reduce((s, i) => s + (i.valor || 0), 0))}</strong>
        </div>
        <button type="button" class="btn btn-ghost" onclick={() => (showDetails = false)}>Fechar</button>
      </div>
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
.page-main { padding:24px 32px 48px; flex:1; width:100%; }

/* Filters */
.filters-bar {
  display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap;
  background:var(--bg-card); border:1px solid var(--border);
  padding:16px 20px; border-radius:var(--radius-lg); margin-bottom:20px;
}
.filter-group { display:flex; flex-direction:column; gap:4px; }
.filter-label { font-size:10.5px; font-weight:600; color:var(--text-3); text-transform:uppercase; letter-spacing:0.5px; }
.filter-input {
  padding:9px 12px; border:1px solid var(--border-2); border-radius:8px;
  font-family:'DM Sans',sans-serif; font-size:13.5px;
  color:#fff; background:var(--bg-input); outline:none;
  min-width:130px; transition:border-color 0.15s; color-scheme:dark;
}
.filter-input:focus { border-color:var(--blue); background:var(--bg-elevated); }
.btn { display:inline-flex; align-items:center; gap:7px; padding:9px 18px; border:none; border-radius:var(--radius); font-size:13.5px; font-weight:500; cursor:pointer; transition:all 0.16s ease; white-space:nowrap; }
.btn-filter {
  background:var(--blue-dim); color:#fff;
  align-self:flex-end; padding:10px 22px;
  border-radius:var(--radius); border:none;
  font-family:'DM Sans',sans-serif; font-weight:500; font-size:14px;
  cursor:pointer; transition:background 0.18s;
}
.btn-filter:hover { background:var(--blue); }

/* Table scroll */
.table-scroll { 
  overflow: auto; 
  max-height: 70vh; 
  margin-bottom: 24px; 
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
}
.table-wrap {
  min-width: max-content;
}

/* Pivot table */
.pivot-table { width:100%; border-collapse:collapse; font-size:12.5px; }
.pivot-table thead {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--bg-elevated);
}
.pivot-table thead tr { border-bottom:1px solid var(--border-2); }
.pivot-table th {
  padding:10px 12px; text-align:right;
  font-size:10px; font-weight:600; color:var(--text-3);
  text-transform:uppercase; letter-spacing:0.6px; white-space:nowrap;
  background: var(--bg-elevated);
}
.th-sticky {
  text-align:left; position:sticky; left:0;
  background:var(--bg-elevated); z-index:11;
  min-width:180px; border-right:1px solid var(--border-2);
}

.th-month { min-width:110px; }
.th-total {
  min-width:110px; color:var(--green);
  border-left:2px solid var(--border-2);
}
.th-avg {
  min-width:100px; color:var(--blue);
  font-style:italic;
}

/* Data rows */
.pivot-row { border-bottom:1px solid var(--border); transition:background 0.12s; }
.pivot-row:hover { background:var(--bg-hover); }
.pivot-row:last-child { border-bottom:none; }

.td-name {
  padding:10px 14px; font-weight:500; color:#fff;
  position:sticky; left:0; background:var(--bg-card);
  z-index:1; white-space:nowrap; border-right:1px solid var(--border);
}
.pivot-row:hover .td-name { background:var(--bg-hover); }

/* Group header row styles */
.pivot-group-header {
  position: sticky;
  top: 36px; /* Adjust based on header height if needed */
  z-index: 5;
  background: var(--bg-elevated);
  border-top: 2px solid var(--border-2);
  border-bottom: 1px solid var(--border-2);
}

.td-group-name {
  background: var(--bg-elevated) !important;
  color: var(--blue) !important;
  font-weight: 700 !important;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.td-group-val {
  font-weight: 600;
  color: var(--text);
}
.row-sub .td-name {
  padding-left: 28px;
  color: var(--text-2);
  font-size: 12px;
}

.td-value {
  padding:10px 12px; text-align:right;
  font-family:'DM Mono',monospace; font-size:12px;
  color:var(--text-2); white-space:nowrap;
}
.td-zero { color:var(--text-3); }

.clickable {
  cursor: pointer;
  position: relative;
}
.clickable:hover {
  background: rgba(66, 133, 255, 0.1) !important;
  color: #fff !important;
}
.clickable::after {
  content: "🔍";
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 8px;
  opacity: 0;
  transition: opacity 0.15s;
}
.clickable:hover::after {
  opacity: 0.5;
}

.td-total {
  padding:10px 12px; text-align:right;
  font-family:'DM Mono',monospace; font-size:12px;
  font-weight:600; color:var(--green);
  border-left:2px solid var(--border-2);
  white-space:nowrap;
}

.td-avg {
  padding:10px 12px; text-align:right;
  font-family:'DM Mono',monospace; font-size:12px;
  color:var(--blue); white-space:nowrap;
  font-style:italic;
}

.td-empty { text-align:center; padding:56px 20px; color:var(--text-3); }

/* Total footer row */
.pivot-total-row {
  position: sticky;
  bottom: 0;
  z-index: 10;
  background:var(--bg-elevated);
  border-top:2px solid var(--border-2);
}

.td-total-label {
  padding:12px 14px; font-weight:700; color:var(--text);
  text-transform:uppercase; font-size:11px; letter-spacing:0.5px;
  position:sticky; left:0; background:var(--bg-elevated);
  z-index:11; border-right:1px solid var(--border);
}

.td-total-value {
  padding:12px 12px; text-align:right;
  font-family:'DM Mono',monospace; font-size:12.5px;
  font-weight:700; color:var(--green);
  white-space:nowrap;
}
.td-grand-total {
  padding:12px 12px; text-align:right;
  font-family:'Inter',sans-serif; font-size:14px;
  font-weight:800; color:var(--green);
  border-left:2px solid var(--border-2);
  white-space:nowrap;
}
.td-total-avg {
  padding:12px 12px; text-align:right;
  font-family:'DM Mono',monospace; font-size:12.5px;
  font-weight:700; color:var(--blue);
  white-space:nowrap; font-style:italic;
}

/* Summary cards */
.summary-cards { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-top:8px; }
.stat-card {
  background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg);
  padding:22px 24px; display:flex; flex-direction:column; gap:6px;
  transition:border-color 0.15s;
}
.stat-card:hover { border-color:var(--border-2); }
.stat-label { font-size:11px; font-weight:600; color:var(--text-3); text-transform:uppercase; letter-spacing:0.6px; }
.stat-value { font-family:'Inter',sans-serif; font-size:26px; font-weight:800; color:#fff; line-height:1.1; }
.stat-value.green { color:var(--green); }
.stat-value.blue { color:var(--blue); }
.stat-value.amber { color:var(--amber); }
.stat-sub { font-size:11.5px; color:var(--text-3); font-family:'DM Mono',monospace; }

/* Modal & Detail Overlay */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(3, 6, 18, 0.85);
  backdrop-filter: blur(6px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.modal {
  background: var(--bg-card);
  border: 1px solid var(--border-2);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 600px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.modal-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid var(--border);
}
.modal-hdr-text { display: flex; flex-direction: column; gap: 2px; }
.modal-title { font-size: 18px; font-weight: 700; color: #fff; }
.modal-subtitle { font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.5px; }
.modal-close {
  width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--bg-elevated); color: var(--text-2); font-size: 13px;
  cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.14s;
}
.modal-close:hover { background: var(--red-bg); color: var(--red); }

.modal-body { padding: 0; overflow-y: auto; flex: 1; }
.details-list { display: flex; flex-direction: column; }
.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 14px 24px;
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;
}
.detail-item:hover { background: var(--bg-hover); }
.detail-item:last-child { border-bottom: none; }

.di-left { display: flex; flex-direction: column; gap: 2px; }
.di-date { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--text-3); }
.di-item-name { font-weight: 500; color: #fff; font-size: 14px; }
.di-comment { font-size: 12px; color: var(--text-3); font-style: italic; }

.di-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.di-value { font-family: 'Inter', sans-serif; font-weight: 700; color: var(--green); font-size: 15px; }
.di-pay { font-size: 10px; color: var(--text-3); text-transform: uppercase; }

.modal-ftr {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 24px; border-top: 1px solid var(--border);
  background: var(--bg-surface);
}
.detail-total { display: flex; flex-direction: column; }
.detail-total span { font-size: 11px; color: var(--text-3); text-transform: uppercase; }
.detail-total strong { font-size: 20px; color: var(--green); }
</style>
