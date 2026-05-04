<script lang="ts">
  import favicon from '$lib/assets/favicon.svg';
  import { page } from '$app/stores';

  let { children } = $props();

  let sidebarOpen = $state(true);

  const NAV = [
    { href: '/',              icon: '◈', label: 'Gastos',        sub: 'Lançamentos' },
    { href: '/gastos-fixos', icon: '⊟', label: 'Gastos Fixos',  sub: 'Recorrentes' },
  ];
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap" rel="stylesheet" />
</svelte:head>

<div class="shell" class:sidebar-collapsed={!sidebarOpen}>
  <aside class="sidebar">
    <div class="sidebar-top">
      <div class="logo">
        <div class="logo-mark">₿</div>
        {#if sidebarOpen}
          <div class="logo-text">
            <span class="logo-name">Finanças</span>
            <span class="logo-sub">Controle familiar</span>
          </div>
        {/if}
      </div>
      <button class="toggle-btn" onclick={() => sidebarOpen = !sidebarOpen}
        title={sidebarOpen ? 'Recolher menu' : 'Expandir menu'}>
        {sidebarOpen ? '‹' : '›'}
      </button>
    </div>

    <nav class="nav">
      {#each NAV as item}
        {@const active = $page.url.pathname === item.href}
        <a class="nav-item" class:active href={item.href}>
          <span class="nav-icon">{item.icon}</span>
          {#if sidebarOpen}
            <div class="nav-text">
              <span class="nav-label">{item.label}</span>
              <span class="nav-sub">{item.sub}</span>
            </div>
            {#if active}
              <span class="nav-pip"></span>
            {/if}
          {/if}
        </a>
      {/each}
    </nav>

    {#if sidebarOpen}
      <div class="sidebar-footer">
        <div class="sidebar-footer-text">v1.0 · Cloudflare D1</div>
      </div>
    {/if}
  </aside>

  <div class="content">
    {@render children()}
  </div>
</div>

<style>
  :global(:root) {
    --bg:         #060a14;
    --bg-surface: #0b1020;
    --bg-card:    #0f1626;
    --bg-elevated:#141d30;
    --bg-hover:   #1a2540;
    --bg-input:   #0d1525;
    --border:     #1b2d50;
    --border-2:   #243860;
    --border-3:   #2e4878;
    --text:       #dde4f5;
    --text-2:     #7d8fae;
    --text-3:     #3d506e;
    --green:      #00e07b;
    --green-dim:  #059669;
    --green-bg:   rgba(0,200,110,0.08);
    --blue:       #4285ff;
    --blue-dim:   #2460d4;
    --blue-bg:    rgba(66,133,255,0.08);
    --red:        #ff4d5a;
    --red-bg:     rgba(255,77,90,0.1);
    --amber:      #f59e0b;
    --amber-bg:   rgba(245,158,11,0.1);
    --radius:     10px;
    --radius-lg:  16px;
    --shadow:     0 4px 24px rgba(0,0,0,0.5);
    --shadow-lg:  0 16px 56px rgba(0,0,0,0.75);
  }

  :global(*, *::before, *::after) { box-sizing: border-box; margin: 0; padding: 0; }

  :global(html, body) {
    height: 100%;
    font-family: 'DM Sans', sans-serif;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  :global(a) { color: inherit; text-decoration: none; }
  :global(input), :global(select), :global(button), :global(textarea) { font-family: inherit; }
  :global(input[type="date"]::-webkit-calendar-picker-indicator) { filter: invert(0.5); }

  .shell {
    display: flex;
    min-height: 100vh;
    --sidebar-w: 220px;
  }
  .shell.sidebar-collapsed { --sidebar-w: 60px; }

  .sidebar {
    width: var(--sidebar-w);
    flex-shrink: 0;
    background: var(--bg-surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0; left: 0; bottom: 0;
    z-index: 50;
    transition: width 0.22s cubic-bezier(.4,0,.2,1);
    overflow: hidden;
  }

  .sidebar-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 12px 14px;
    border-bottom: 1px solid var(--border);
    gap: 8px;
    min-height: 68px;
    flex-shrink: 0;
  }

  .logo { display: flex; align-items: center; gap: 10px; overflow: hidden; }
  .logo-mark {
    width: 36px; height: 36px;
    flex-shrink: 0;
    background: linear-gradient(135deg, var(--green), var(--green-dim));
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; color: #000;
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    box-shadow: 0 0 18px rgba(0,224,123,0.2);
  }
  .logo-text { display: flex; flex-direction: column; white-space: nowrap; }
  .logo-name { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: var(--text); letter-spacing: -0.3px; line-height: 1.2; }
  .logo-sub  { font-size: 10.5px; color: var(--text-3); }

  .toggle-btn {
    width: 26px; height: 26px;
    flex-shrink: 0;
    background: var(--bg-elevated);
    border: 1px solid var(--border-2);
    border-radius: 7px;
    color: var(--text-2);
    font-size: 14px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
    line-height: 1;
  }
  .toggle-btn:hover { background: var(--bg-hover); color: var(--text); border-color: var(--border-3); }

  .nav { flex: 1; padding: 12px 8px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; overflow-x: hidden; }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border-radius: var(--radius);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.15s;
    position: relative;
    overflow: hidden;
    white-space: nowrap;
    min-height: 48px;
  }
  .nav-item:hover { background: var(--bg-hover); border-color: var(--border); }
  .nav-item.active { background: var(--blue-bg); border-color: var(--border-2); }
  .nav-item.active .nav-label { color: #fff; }

  .nav-icon { font-size: 18px; flex-shrink: 0; width: 22px; text-align: center; color: var(--text-2); transition: color 0.15s; }
  .nav-item.active .nav-icon { color: var(--blue); }
  .nav-item:hover .nav-icon { color: var(--text); }

  .nav-text { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
  .nav-label { font-size: 13.5px; font-weight: 500; color: var(--text-2); transition: color 0.15s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nav-sub   { font-size: 10.5px; color: var(--text-3); }
  .nav-pip   { width: 5px; height: 5px; border-radius: 50%; background: var(--blue); flex-shrink: 0; box-shadow: 0 0 6px var(--blue); }

  .sidebar-footer { padding: 12px 14px; border-top: 1px solid var(--border); flex-shrink: 0; }
  .sidebar-footer-text { font-size: 10.5px; color: var(--text-3); font-family: 'DM Mono', monospace; }

  .content {
    flex: 1;
    margin-left: var(--sidebar-w);
    transition: margin-left 0.22s cubic-bezier(.4,0,.2,1);
    min-width: 0;
    min-height: 100vh;
  }
</style>