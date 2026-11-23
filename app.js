/* Raio-X Fundos PF — painel público. Lê dados/meses.json e dados/<mes>.json (gerados por raiox.outputs.site). */
(function () {
  "use strict";
  const CLASSES = ["Ações", "Multimercados", "Renda Fixa", "RF Baixa Duração"];
  const PERIODOS = [["MES", "Mês"], ["ANO", "Ano"], ["12M", "12 meses"]];
  const NOME_PER = { MES: "no mês", ANO: "no ano", "12M": "em 12 meses" };
  const ROT_PER = { MES: "NO MÊS", ANO: "NO ANO", "12M": "EM 12 MESES" };
  const RANKINGS = [["maiores_rent", "Maiores rentabilidades"], ["menores_rent", "Menores rentabilidades"],
                    ["maiores_pl", "Maiores PL"], ["maiores_cotistas", "Maiores em cotistas"]];
  const COMPS = [["cdi", "CDI"], ["ibovespa", "Ibovespa"], ["mediana", "Mediana da classe"]];
  const PLURAL = { "Ações": "fundos de ações", "Multimercados": "multimercados", "Renda Fixa": "fundos de renda fixa",
                   "RF Baixa Duração": "fundos de RF baixa duração" };
  const est = { dados: null, classe: "Multimercados", periodo: "ANO", ranking: "maiores_rent", comp: "cdi" };
  const $ = (id) => document.getElementById(id);

  // ---------- formatação pt-BR ----------
  const nf = (d) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (x) => (x == null ? "—" : nf(2).format(x).replace("-", "−") + "%");
  const inteiro = (x) => (x == null ? "—" : nf(0).format(x));
  function reais(x) {
    if (x == null) return "—";
    const s = x < 0 ? "−" : "", a = Math.abs(x);
    if (a >= 1e9) return s + "R$ " + nf(1).format(a / 1e9) + " bi";
    return s + "R$ " + nf(1).format(a / 1e6) + " mi";
  }
  function el(tag, attrs, ...filhos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else e.setAttribute(k, v);
    }
    for (const f of filhos) if (f != null) e.append(f);
    return e;
  }
  const limpar = (e) => { while (e.firstChild) e.removeChild(e.firstChild); return e; };

  // ---------- leitura (texto dos autores; opcional) ----------
  const L = () => est.dados.leitura || {};
  const chave = (painel) => `${est.classe}|${est.periodo}|${painel}`;
  const manchete = (painel, auto) => ((L().manchetes || {})[chave(painel)] || auto);
  function comentarios(id, auto) {
    const c = L().comentarios || {};
    return c[chave(id)] || c[id] || auto;
  }

  // ---------- dados do recorte ----------
  const bloco = () => est.dados.classes[est.classe].periodos[est.periodo];
  const ind = (id) => est.dados.indicadores.find((i) => i.id === id);

  // ---------- filtros ----------
  function botoes() {
    const bc = limpar($("botoes-classe"));
    for (const c of CLASSES) {
      const b = el("button", { type: "button", "aria-pressed": String(c === est.classe), text: c });
      b.onclick = () => { est.classe = c; render(); };
      bc.append(b);
    }
    const bp = limpar($("botoes-periodo"));
    for (const [p, n] of PERIODOS) {
      const b = el("button", { type: "button", "aria-pressed": String(p === est.periodo), text: n });
      b.onclick = () => { est.periodo = p; render(); };
      bp.append(b);
    }
  }

  function abas(alvo, itens, atual, ao) {
    const a = limpar($(alvo));
    for (const [k, n] of itens) {
      const b = el("button", { type: "button", role: "tab", "aria-selected": String(k === atual), text: n });
      b.onclick = () => ao(k);
      a.append(b);
    }
  }

  // ---------- dica (passar o mouse / foco) ----------
  const dica = $("dica");
  function mostrarDica(alvo, titulo, linhas) {
    limpar(dica).append(el("b", { text: titulo }));
    for (const l of linhas) dica.append(el("div", { text: "• " + l }));
    dica.hidden = false;
    const r = alvo.getBoundingClientRect();
    const x = Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - dica.offsetWidth - 8);
    dica.style.left = Math.max(8, x) + "px";
    dica.style.top = window.scrollY + r.bottom + 8 + "px";
  }
  const esconder = () => { dica.hidden = true; };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") esconder(); });

  // ---------- seções ----------
  function leitura() {
    const l = est.dados.leitura;
    $("leitura").hidden = !(l && l.manchete);
    if (!l || !l.manchete) return;
    $("leitura-manchete").textContent = l.manchete;
    const ul = limpar($("leitura-bullets"));
    for (const b of l.bullets || []) ul.append(el("li", { text: b }));
    $("leitura-assinatura").textContent = l.assinatura || "";
  }

  function rentabilidade() {
    const t = bloco().total || {}, per = est.periodo, cdi = ind("cdi"), ibov = ind("ibovespa");
    $("rent-rotulo").textContent = "RENTABILIDADE " + ROT_PER[per];
    let auto = `${est.classe}: média de ${pct(t.rent_media)} ${NOME_PER[per]}`;
    if (cdi && cdi[per] != null) auto += `, ${t.rent_media >= cdi[per] ? "acima" : "abaixo"} dos ${pct(cdi[per])} do CDI`;
    if (ibov && ibov[per] != null) auto += ` e ${t.rent_media >= ibov[per] ? "acima" : "abaixo"} dos ${pct(ibov[per])} do Ibovespa`;
    $("rent-manchete").textContent = manchete("rentabilidade", auto);

    const cards = limpar($("cards"));
    cards.append(el("div", { class: "card escuro" }, el("div", { class: "nome", text: est.classe + " (média)" }),
      el("div", { class: "valor", text: pct(t.rent_media) }),
      el("div", { class: "det", text: `${inteiro(t.n_com_rent)} fundos · mediana ${pct(t.rent_mediana)}` })));
    const ids = ["cdi", ...est.dados.classes[est.classe].destaques, "ptax"];
    for (const id of ids) {
      const i = ind(id);
      if (!i) continue;
      const v = i[per];
      const card = el("button", { type: "button", class: "card", "aria-describedby": "dica" },
        el("div", { class: "nome", text: i.nome }), el("div", { class: "valor" + (v < 0 ? " neg" : ""), text: pct(v) }),
        el("div", { class: "det", text: i.fonte }));
      const comp = (bloco().comparacoes || {})[id];
      const auto2 = [];
      if (v != null && t.rent_media != null) {
        const dif = t.rent_media - v;
        auto2.push(`${est.classe}: média ${pct(t.rent_media)}, ${nf(2).format(Math.abs(dif))} p.p. ${dif >= 0 ? "acima" : "abaixo"} de ${i.nome}.`);
      }
      if (comp && comp.acima) auto2.push(`${inteiro(comp.acima.n_fundos)} de ${inteiro(t.n_com_rent)} fundos com rentabilidade igual ou maior.`);
      const linhas = comentarios(id, auto2);
      const abrir = () => mostrarDica(card, `${i.nome} ${NOME_PER[per]}`, linhas);
      card.addEventListener("mouseenter", abrir); card.addEventListener("focus", abrir);
      card.addEventListener("mouseleave", esconder); card.addEventListener("blur", esconder);
      cards.append(card);
    }
  }

  function ranking() {
    const per = est.periodo, lista = (bloco().rankings || {})[est.ranking] || [];
    $("rank-rotulo").textContent = `${RANKINGS.find((r) => r[0] === est.ranking)[1]} · ${est.classe} · ${ROT_PER[per].toLowerCase()}`;
    let auto = "";
    if (lista.length) {
      const f = lista[0];
      auto = { maiores_rent: `${f.nome} lidera com ${pct(f.rent)} ${NOME_PER[per]}`,
               menores_rent: `${f.nome} tem o menor resultado: ${pct(f.rent)} ${NOME_PER[per]}`,
               maiores_pl: `${f.nome} é o maior, com ${reais(f.pl)} de patrimônio`,
               maiores_cotistas: `${f.nome} tem o maior número de cotistas: ${inteiro(f.cotistas)}` }[est.ranking];
    }
    $("rank-manchete").textContent = manchete("ranking_" + est.ranking, auto);
    abas("abas-ranking", RANKINGS, est.ranking, (k) => { est.ranking = k; ranking(); });
    const tab = limpar($("tab-ranking"));
    const cab = ["#", "Fundo", "Gestor", "Rent.", "Vol.", "PL", "Cap. líq.", "Cotistas"];
    tab.append(el("thead", {}, el("tr", {}, ...cab.map((c, j) => el("th", { class: j >= 3 ? "num" : "", scope: "col", text: c })))));
    const tb = el("tbody");
    lista.forEach((f, j) => {
      tb.append(el("tr", {}, el("td", { text: String(j + 1) }), el("td", { text: f.nome, title: f.nome_completo || f.nome }), el("td", { text: f.gestor || "" }),
        el("td", { class: "num forte" + (f.rent < 0 ? " neg" : ""), text: pct(f.rent) }), el("td", { class: "num", text: pct(f.vol) }),
        el("td", { class: "num", text: reais(f.pl) }), el("td", { class: "num", text: reais(f.capliq) }),
        el("td", { class: "num", text: inteiro(f.cotistas) })));
    });
    tab.append(tb);
  }

  function comparacao() {
    const per = est.periodo, t = bloco().total || {}, comps = bloco().comparacoes || {};
    const disponiveis = COMPS.filter(([k]) => comps[k]);
    if (!disponiveis.find(([k]) => k === est.comp) && disponiveis.length) est.comp = disponiveis[0][0];
    const nomeRef = (COMPS.find((c) => c[0] === est.comp) || ["", ""])[1];
    const c = comps[est.comp] || {}, ac = c.acima || {}, ab = c.abaixo || {};
    $("comp-rotulo").textContent = `Acima e abaixo · ${nomeRef} · ${ROT_PER[per].toLowerCase()}`;
    const n = (ac.n_fundos || 0) + (ab.n_fundos || 0);
    $("comp-manchete").textContent = manchete("comparacao_" + est.comp,
      `${inteiro(ac.n_fundos)} de ${inteiro(n)} ${PLURAL[est.classe]} ${est.comp === "mediana" ? "ficaram na mediana da classe ou acima" : "bateram o " + nomeRef}`);
    abas("abas-comp", disponiveis, est.comp, (k) => { est.comp = k; comparacao(); });
    const b = limpar($("barras"));
    for (const [rot, g, cor] of [["Acima ou igual", ac, "#1f4e8c"], ["Abaixo", ab, "#a35c00"]]) {
      const p = n ? (100 * (g.n_fundos || 0)) / n : 0;
      b.append(el("div", { class: "barra-linha" }, el("span", { text: `${rot} ${est.comp === "mediana" ? "à mediana" : "ao " + nomeRef}` }),
        el("span", { class: "forte", text: `${inteiro(g.n_fundos)} fundos · média ${pct(g.rent_media)}` })));
      const barra = el("div", { class: "barra", role: "img", "aria-label": `${nf(1).format(p)}% dos fundos` });
      const cheio = el("div"); cheio.style.width = p + "%"; cheio.style.background = cor;
      barra.append(cheio); b.append(barra);
    }
    const tab = limpar($("tab-comp"));
    tab.append(el("thead", {}, el("tr", {}, el("th", { scope: "col", text: "" }), el("th", { class: "num", scope: "col", text: "PL" }),
      el("th", { class: "num", scope: "col", text: "Cap. líq." }))));
    const tb = el("tbody");
    for (const [rot, g] of [["Acima", ac], ["Abaixo", ab]])
      tb.append(el("tr", {}, el("td", { text: rot }), el("td", { class: "num", text: reais(g.pl) }), el("td", { class: "num", text: reais(g.capliq) })));
    tab.append(tb);
  }

  function indicadores() {
    const tab = limpar($("tab-indicadores"));
    tab.append(el("thead", {}, el("tr", {}, el("th", { scope: "col", text: "Indicador" }), el("th", { class: "num", scope: "col", text: "Mês" }),
      el("th", { class: "num", scope: "col", text: "Ano" }), el("th", { class: "num", scope: "col", text: "12 meses" }),
      el("th", { scope: "col", text: "Fonte" }))));
    const tb = el("tbody");
    for (const i of est.dados.indicadores)
      tb.append(el("tr", {}, el("td", { text: i.nome }), ...["MES", "ANO", "12M"].map((p) => el("td", { class: "num" + (i[p] < 0 ? " neg" : ""), text: pct(i[p]) })),
        el("td", { class: "nota", text: i.fonte })));
    tab.append(tb);
  }

  function resumo() {
    const d = est.dados, u = d.universo, data = (s) => s.split("-").reverse().join("/");
    $("resumo-texto").textContent = `Data-base ${data(d.data_base)}. ${inteiro(u.n_fundos)} fundos no universo, com ${reais(u.pl)} de patrimônio e ${inteiro(u.cotistas)} posições de cotistas. Início dos períodos: mês ${data(d.d0.MES)}, ano ${data(d.d0.ANO)}, 12 meses ${data(d.d0["12M"])}.`;
    const dl = limpar($("downloads"));
    dl.append("Baixar os dados do mês (CSV): ");
    ["universo", "consolidados", "rankings", "indicadores"].forEach((n, j) => {
      if (j) dl.append(" · ");
      dl.append(el("a", { href: `dados/${d.mes}/${n}.csv`, download: "", text: n }));
    });
    $("rodape-gerado").textContent = `Atualizado em ${d.gerado_em}`;
    // modo de teste (MVP): faixa fixa de "em desenvolvimento" no lugar do aviso de prévia
    $("faixa-teste").hidden = !d.modo_teste;
    $("aviso-previa").hidden = !d.previa || !!d.modo_teste;
  }

  function render() {
    esconder();
    botoes(); leitura(); rentabilidade(); ranking(); comparacao(); indicadores(); resumo();
  }

  async function carregar(mes) {
    const r = await fetch(`dados/${mes}.json`, { cache: "no-cache" });
    est.dados = await r.json();
    render();
  }

  async function iniciar() {
    const meses = await (await fetch("dados/meses.json", { cache: "no-cache" })).json();
    const sel = $("sel-mes");
    for (const m of meses) {
      const [a, mm] = m.split("-");
      sel.append(el("option", { value: m, text: `${mm}/${a}` }));
    }
    sel.onchange = () => carregar(sel.value);
    await carregar(meses[0]);
  }
  iniciar().catch((e) => { document.querySelector("main").prepend(el("div", { class: "aviso", text: "Não foi possível carregar os dados: " + e })); });
})();
