<script lang="ts">
  import { onMount } from 'svelte';

  let { data } = $props();

  function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtMes(m: string) {
    const [y, mm] = m.split('-');
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${nomes[parseInt(mm) - 1]}/${y.slice(2)}`;
  }

  const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  let ano = $state(data.filters.ano);
  let mesInicio = $state(data.filters.mesInicio);
  let mesFim = $state(data.filters.mesFim);

  const COLORS = [
    '#00e07b','#4285ff','#f59e0b','#ff4d5a','#a78bfa','#06b6d4',
    '#ec4899','#84cc16','#f97316','#6366f1','#14b8a6','#e879f9'
  ];

  let barCanvas: HTMLCanvasElement;
  let donutCanvas: HTMLCanvasElement;
  let lineCanvas: HTMLCanvasElement;
  let hbarCanvas: HTMLCanvasElement;

  onMount(() => {
    drawBarChart();
    drawDonutChart();
    drawLineChart();
    drawHBarChart();
  });

  function drawBarChart() {
    const ctx = barCanvas.getContext('2d');
    if (!ctx) return;
    const items = data.porMes as any[];
    if (!items.length) return;

    const dpr = window.devicePixelRatio || 1;
    const w = barCanvas.clientWidth * dpr;
    const h = barCanvas.clientHeight * dpr;
    barCanvas.width = w; barCanvas.height = h;
    ctx.scale(dpr, dpr);
    const cw = barCanvas.clientWidth, ch = barCanvas.clientHeight;

    const max = Math.max(...items.map(i => i.total));
    const pad = { t: 20, r: 20, b: 50, l: 80 };
    const plotW = cw - pad.l - pad.r;
    const plotH = ch - pad.t - pad.b;
    const barW = Math.min(40, (plotW / items.length) * 0.65);
    const gap = plotW / items.length;

    // Grid lines
    ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (plotH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(cw - pad.r, y); ctx.stroke();
      ctx.fillStyle = '#505050'; ctx.font = '11px DM Mono, monospace'; ctx.textAlign = 'right';
      ctx.fillText(fmt(max - (max / 4) * i), pad.l - 8, y + 4);
    }

    // Bars
    items.forEach((item, idx) => {
      const x = pad.l + idx * gap + (gap - barW) / 2;
      const barH = (item.total / max) * plotH;
      const y = pad.t + plotH - barH;

      const grad = ctx.createLinearGradient(x, y, x, y + barH);
      grad.addColorStop(0, '#00e07b'); grad.addColorStop(1, '#059669');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
      ctx.fill();

      // Label
      ctx.fillStyle = '#8a8a8a'; ctx.font = '10px DM Sans, sans-serif'; ctx.textAlign = 'center';
      ctx.save(); ctx.translate(x + barW / 2, ch - pad.b + 14);
      ctx.fillText(fmtMes(item.mes), 0, 0);
      ctx.restore();
    });
  }

  function drawDonutChart() {
    const ctx = donutCanvas.getContext('2d');
    if (!ctx) return;
    const items = data.porCategoria as any[];
    if (!items.length) return;

    const dpr = window.devicePixelRatio || 1;
    const w = donutCanvas.clientWidth * dpr;
    const h = donutCanvas.clientHeight * dpr;
    donutCanvas.width = w; donutCanvas.height = h;
    ctx.scale(dpr, dpr);
    const cw = donutCanvas.clientWidth, ch = donutCanvas.clientHeight;

    const total = items.reduce((s, i) => s + i.total, 0);
    const cx = cw * 0.35, cy = ch / 2;
    const outerR = Math.min(cx, cy) - 20;
    const innerR = outerR * 0.55;

    let startAngle = -Math.PI / 2;
    items.forEach((item, idx) => {
      const sliceAngle = (item.total / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
      ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = COLORS[idx % COLORS.length];
      ctx.fill();
      startAngle += sliceAngle;
    });

    // Center text
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(fmt(total), cx, cy + 2);
    ctx.fillStyle = '#505050'; ctx.font = '11px DM Sans, sans-serif';
    ctx.fillText('Total', cx, cy + 18);

    // Legend
    const legendX = cw * 0.65;
    let legendY = 30;
    items.slice(0, 8).forEach((item, idx) => {
      ctx.fillStyle = COLORS[idx % COLORS.length];
      ctx.fillRect(legendX, legendY, 12, 12);
      ctx.fillStyle = '#e0e0e0'; ctx.font = '12px DM Sans, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`${item.categoria || 'Sem cat.'}`, legendX + 18, legendY + 10);
      ctx.fillStyle = '#8a8a8a'; ctx.font = '11px DM Mono, monospace';
      ctx.fillText(fmt(item.total), legendX + 18, legendY + 24);
      legendY += 36;
    });
  }

  function drawLineChart() {
    const ctx = lineCanvas.getContext('2d');
    if (!ctx) return;
    const items = data.porMes as any[];
    if (items.length < 2) return;

    const dpr = window.devicePixelRatio || 1;
    const w = lineCanvas.clientWidth * dpr;
    const h = lineCanvas.clientHeight * dpr;
    lineCanvas.width = w; lineCanvas.height = h;
    ctx.scale(dpr, dpr);
    const cw = lineCanvas.clientWidth, ch = lineCanvas.clientHeight;

    const max = Math.max(...items.map(i => i.total)) * 1.1;
    const pad = { t: 20, r: 20, b: 50, l: 80 };
    const plotW = cw - pad.l - pad.r;
    const plotH = ch - pad.t - pad.b;

    // Grid
    ctx.strokeStyle = '#1e1e1e'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (plotH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(cw - pad.r, y); ctx.stroke();
      ctx.fillStyle = '#505050'; ctx.font = '11px DM Mono, monospace'; ctx.textAlign = 'right';
      ctx.fillText(fmt(max - (max / 4) * i), pad.l - 8, y + 4);
    }

    // Line
    const points = items.map((item, idx) => ({
      x: pad.l + (idx / (items.length - 1)) * plotW,
      y: pad.t + plotH - (item.total / max) * plotH
    }));

    // Fill under line
    ctx.beginPath();
    ctx.moveTo(points[0].x, pad.t + plotH);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, pad.t + plotH);
    ctx.closePath();
    const gradFill = ctx.createLinearGradient(0, pad.t, 0, pad.t + plotH);
    gradFill.addColorStop(0, 'rgba(66,133,255,0.2)'); gradFill.addColorStop(1, 'rgba(66,133,255,0)');
    ctx.fillStyle = gradFill; ctx.fill();

    // Line stroke
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = '#4285ff'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();

    // Dots
    points.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#4285ff'; ctx.fill();
      ctx.strokeStyle = '#0d0d0d'; ctx.lineWidth = 2; ctx.stroke();
    });

    // X labels
    items.forEach((item, idx) => {
      const x = pad.l + (idx / (items.length - 1)) * plotW;
      ctx.fillStyle = '#8a8a8a'; ctx.font = '10px DM Sans, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(fmtMes(item.mes), x, ch - pad.b + 16);
    });
  }

  function drawHBarChart() {
    const ctx = hbarCanvas.getContext('2d');
    if (!ctx) return;
    const items = data.porCategoria as any[];
    if (!items.length) return;

    const dpr = window.devicePixelRatio || 1;
    const w = hbarCanvas.clientWidth * dpr;
    const h = hbarCanvas.clientHeight * dpr;
    hbarCanvas.width = w; hbarCanvas.height = h;
    ctx.scale(dpr, dpr);
    const cw = hbarCanvas.clientWidth, ch = hbarCanvas.clientHeight;

    const max = items[0]?.total || 1;
    const pad = { t: 10, r: 80, b: 10, l: 130 };
    const plotW = cw - pad.l - pad.r;
    const barH = Math.min(28, (ch - pad.t - pad.b) / items.length * 0.7);
    const gap = (ch - pad.t - pad.b) / items.length;

    items.slice(0, 10).forEach((item, idx) => {
      const y = pad.t + idx * gap + (gap - barH) / 2;
      const bw = (item.total / max) * plotW;

      ctx.fillStyle = COLORS[idx % COLORS.length];
      ctx.beginPath();
      ctx.roundRect(pad.l, y, bw, barH, [0, 4, 4, 0]);
      ctx.fill();

      // Label left
      ctx.fillStyle = '#e0e0e0'; ctx.font = '12px DM Sans, sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(item.categoria || 'Sem cat.', pad.l - 10, y + barH / 2 + 4);

      // Value right
      ctx.fillStyle = '#8a8a8a'; ctx.font = '11px DM Mono, monospace'; ctx.textAlign = 'left';
      ctx.fillText(fmt(item.total), pad.l + bw + 8, y + barH / 2 + 4);
    });
  }
</script>

<div class="page">
  <header class="page-header">
    <div class="page-header-inner">
      <div class="page-title-wrap">
        <h1 class="page-title">Dashboard Gráfico</h1>
        <span class="page-subtitle">Visualização dos seus gastos</span>
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
      <button type="submit" class="btn btn-filter">Filtrar</button>
    </form>

    <div class="charts-grid">
      <div class="chart-card">
        <h3 class="chart-title">Gastos por Mês</h3>
        <div class="chart-container">
          <canvas bind:this={barCanvas}></canvas>
        </div>
      </div>

      <div class="chart-card">
        <h3 class="chart-title">Distribuição por Categoria</h3>
        <div class="chart-container">
          <canvas bind:this={donutCanvas}></canvas>
        </div>
      </div>

      <div class="chart-card full">
        <h3 class="chart-title">Evolução Mensal</h3>
        <div class="chart-container line">
          <canvas bind:this={lineCanvas}></canvas>
        </div>
      </div>

      <div class="chart-card full">
        <h3 class="chart-title">Top Categorias</h3>
        <div class="chart-container hbar">
          <canvas bind:this={hbarCanvas}></canvas>
        </div>
      </div>
    </div>

    <!-- Payment method breakdown -->
    <section class="section">
      <h2 class="section-title">Por Método de Pagamento</h2>
      <div class="payment-cards">
        {#each data.porPagamento as pg}
          <div class="pay-card">
            <div class="pay-method">{pg.pagamento || '—'}</div>
            <div class="pay-value">{fmt(pg.total)}</div>
            <div class="pay-count">{pg.qtd} lançamentos</div>
          </div>
        {/each}
      </div>
    </section>
  </main>
</div>

<style>
.page { display:flex; flex-direction:column; min-height:100vh; background:var(--bg); }
.page-header { background:var(--bg-surface); border-bottom:1px solid var(--border); padding:0 32px; flex-shrink:0; }
.page-header-inner { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; padding:20px 0; }
.page-title-wrap { display:flex; flex-direction:column; gap:2px; }
.page-title { font-family:'Inter',sans-serif; font-size:24px; font-weight:800; color:#fff; letter-spacing:-0.5px; line-height:1; }
.page-subtitle { font-size:12px; color:var(--text-3); }
.page-main { padding:24px 32px 48px; flex:1; max-width:1440px; width:100%; }

/* Filters */
.filters-bar {
  display:flex; align-items:flex-end; gap:12px; flex-wrap:wrap;
  background:var(--bg-card); border:1px solid var(--border);
  padding:16px 20px; border-radius:var(--radius-lg); margin-bottom:24px;
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

.charts-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:32px; }
.chart-card {
  background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg);
  padding:20px 24px; display:flex; flex-direction:column;
}
.chart-card.full { grid-column: 1 / -1; }
.chart-title { font-family:'Inter',sans-serif; font-size:15px; font-weight:700; color:#fff; margin-bottom:16px; }
.chart-container { width:100%; height:300px; position:relative; }
.chart-container canvas { width:100%; height:100%; display:block; }
.chart-container.line { height:280px; }
.chart-container.hbar { height:320px; }

.section { margin-bottom:28px; }
.section-title { font-family:'Inter',sans-serif; font-size:17px; font-weight:700; color:#fff; margin-bottom:14px; }

.payment-cards { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:14px; }
.pay-card {
  background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-lg);
  padding:20px; display:flex; flex-direction:column; gap:6px;
}
.pay-method { font-size:13px; font-weight:600; color:var(--blue); text-transform:uppercase; letter-spacing:0.5px; }
.pay-value { font-family:'Inter',sans-serif; font-size:22px; font-weight:700; color:var(--green); }
.pay-count { font-size:11.5px; color:var(--text-3); font-family:'DM Mono',monospace; }

@media (max-width: 768px) {
  .charts-grid { grid-template-columns:1fr; }
  .chart-card.full { grid-column:1; }
}
</style>
