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

  let pivotData = $derived.by(() => {
    const gastos = data.gastos as any[];
    const cols = mesesColunas;

    // Group gastos by row key and month
    const map: Record<string, Record<string, number>> = {};
    const rowNames: Record<string, string> = {};

    for (const g of gastos) {
      const mes = g.data?.substring(0, 7); // YYYY-MM
      if (!cols.includes(mes)) continue;

      let key: string;
      let name: string;
      if (estratificacao === 'subcategoria') {
        key = `sub-${g.subcategoria_id || 'none'}`;
        name = g.subcategoria_nome || 'Sem subcategoria';
      } else {
        key = `cat-${g.categoria_id || 'none'}`;
        name = g.categoria_nome || 'Sem categoria';
      }

      if (!map[key]) map[key] = {};
      rowNames[key] = name;
      map[key][mes] = (map[key][mes] || 0) + (g.valor || 0);
    }

    // Sort rows by total descending
    const rowKeys = Object.keys(map).sort((a, b) => {
      const totalA = Object.values(map[a]).reduce((s, v) => s + v, 0);
      const totalB = Object.values(map[b]).reduce((s, v) => s + v, 0);
      return totalB - totalA;
    });

    // Calculate row totals
    const rows = rowKeys.map(key => ({
      key,
      name: rowNames[key],
      values: cols.map(c => map[key][c] || 0),
      total: Object.values(map[key]).reduce((s, v) => s + v, 0)
    }));

    // Calculate column totals (sum per month)
    const colTotals = cols.map((c, i) => rows.reduce((s, r) => s + r.values[i], 0));
    const grandTotal = colTotals.reduce((s, v) => s + v, 0);

    return { cols, rows, colTotals, grandTotal };
  });

  // ── Averages (últimos 3, 6, 12 meses) ──
  let averages = $derived.by(() => {
    const gastosAvg = data.gastosAvg as any[];
    const now = new Date();

    function calcAvg(monthsBack: number) {
      const ref = new Date(now);
      ref.setMonth(ref.getMonth() - monthsBack);
      const refStr = ref.toISOString().split('T')[0];

      // Group by row key
      const map: Record<string, number> = {};
      const rowNames: Record<string, string> = {};
      const mesesSet = new Set<string>();

      for (const g of gastosAvg) {
        if (g.data < refStr) continue;
        const mes = g.data?.substring(0, 7);
        mesesSet.add(mes);

        let key: string;
        let name: string;
        if (estratificacao === 'subcategoria') {
          key = `sub-${g.subcategoria_id || 'none'}`;
          name = g.subcategoria_nome || 'Sem subcategoria';
        } else {
          key = `cat-${g.categoria_id || 'none'}`;
          name = g.categoria_nome || 'Sem categoria';
        }

        rowNames[key] = name;
        map[key] = (map[key] || 0) + (g.valor || 0);
      }

      const numMeses = Math.max(mesesSet.size, 1);
      const result: Record<string, number> = {};
      for (const key of Object.keys(map)) {
        result[key] = map[key] / numMeses;
      }
      // Total average
      const totalAvg = Object.values(map).reduce((s, v) => s + v, 0) / numMeses;
      return { perRow: result, total: totalAvg };
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
            {#each pivotData.rows as row}
              <tr class="pivot-row">
                <td class="td-name">{row.name}</td>
                {#each row.values as val}
                  <td class="td-value" class:td-zero={val === 0}>{val > 0 ? fmt(val) : '—'}</td>
                {/each}
                <td class="td-total">{fmt(row.total)}</td>
                <td class="td-avg">{fmt(averages.avg3.perRow[row.key] || 0)}</td>
                <td class="td-avg">{fmt(averages.avg6.perRow[row.key] || 0)}</td>
                <td class="td-avg">{fmt(averages.avg12.perRow[row.key] || 0)}</td>
              </tr>
            {:else}
              <tr>
                <td colspan={pivotData.cols.length + 5} class="td-empty">Nenhum dado encontrado para o período selecionado.</td>
              </tr>
            {/each}
          </tbody>
          {#if pivotData.rows.length > 0}
            <tfoot>
              <tr class="pivot-total-row">
                <td class="td-name td-total-label">Total Mensal</td>
                {#each pivotData.colTotals as ct}
                  <td class="td-total-value">{fmt(ct)}</td>
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
    {#if pivotData.rows.length > 0}
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
          <div class="stat-value">{pivotData.rows.length}</div>
          <div class="stat-sub">com lançamentos</div>
        </div>
      </div>
    {/if}
  </main>
</div>

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
.table-scroll { overflow-x:auto; margin-bottom:24px; }
.table-wrap {
  background:var(--bg-card); border:1px solid var(--border);
  border-radius:var(--radius-lg); overflow:hidden; min-width:max-content;
}

/* Pivot table */
.pivot-table { width:100%; border-collapse:collapse; font-size:12.5px; }
.pivot-table thead tr { background:var(--bg-elevated); border-bottom:1px solid var(--border-2); }
.pivot-table th {
  padding:10px 12px; text-align:right;
  font-size:10px; font-weight:600; color:var(--text-3);
  text-transform:uppercase; letter-spacing:0.6px; white-space:nowrap;
}
.th-sticky {
  text-align:left; position:sticky; left:0;
  background:var(--bg-elevated); z-index:2;
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

.td-value {
  padding:10px 12px; text-align:right;
  font-family:'DM Mono',monospace; font-size:12px;
  color:var(--text-2); white-space:nowrap;
}
.td-zero { color:var(--text-3); }

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
  background:var(--bg-elevated);
  border-top:2px solid var(--border-2);
}
.td-total-label {
  padding:12px 14px; font-weight:700; color:var(--text);
  text-transform:uppercase; font-size:11px; letter-spacing:0.5px;
  position:sticky; left:0; background:var(--bg-elevated);
  z-index:1; border-right:1px solid var(--border);
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
</style>
