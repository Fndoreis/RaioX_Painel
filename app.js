/* Raio-X Fundos PF — painel público. Lê dados/meses.json, dados/<mes>.json e, sob demanda, dados/<mes>-fundos.json
   (gerados por raiox.outputs.site). Quatro visões: Visão geral, Por classe, Risco × retorno e Indicadores. */
(function () {
  "use strict";
  // ordem do menos ao mais arriscado
  const CLASSES = ["RF Baixa Duração", "Renda Fixa", "Multimercados", "Ações"];
  const CORES = { "RF Baixa Duração": "#5b8fd1", "Renda Fixa": "#1f4e8c", "Multimercados": "#a35c00", "Ações": "#0f1b2d" };
  const VISOES = [["geral", "Visão geral"], ["classe", "Por classe"], ["risco", "Risco × retorno"], ["indicadores", "Indicadores"]];
  const PERIODOS = [["MES", "Mês"], ["ANO", "Ano"], ["12M", "12 meses"], ["36M", "36 meses"]];
  const NOME_PER = { MES: "no mês", ANO: "no ano", "12M": "em 12 meses", "36M": "em 36 meses" };
  const ROT_PER = { MES: "NO MÊS", ANO: "NO ANO", "12M": "EM 12 MESES", "36M": "EM 36 MESES" };
  const RANKINGS = [["maiores_rent", "Maiores rentabilidades"], ["menores_rent", "Menores rentabilidades"],
                    ["maiores_pl", "Maiores PL"], ["maiores_cotistas", "Maiores em cotistas"]];
  const COMPS = [["cdi", "CDI"], ["poupanca", "Poupança"], ["ibovespa", "Ibovespa"], ["ihfa", "IHFA"], ["mediana", "Mediana da classe"]];
  const PLURAL = { "Ações": "fundos de ações", "Multimercados": "multimercados", "Renda Fixa": "fundos de renda fixa",
                   "RF Baixa Duração": "fundos de RF baixa duração" };
  const est = { dados: null, visao: "geral", classe: "Multimercados", periodo: "ANO", ranking: "maiores_rent", comp: "cdi",
                fundos: {}, busca: null, semExtremos: true };
  const $ = (id) => document.getElementById(id);

  // ---------- formatação pt-BR ----------
  const nf = (d) => new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (x, d = 2) => (x == null ? "—" : nf(d).format(x).replace("-", "−") + "%");
  const inteiro = (x) => (x == null ? "—" : nf(0).format(x));
  function reais(x) {
    if (x == null) return "—";
    const s = x < 0 ? "−" : "", a = Math.abs(x);
    if (a >= 1e12) return s + "R$ " + nf(2).format(a / 1e12) + " tri";
    if (a >= 1e9) return s + "R$ " + nf(1).format(a / 1e9) + " bi";
    return s + "R$ " + nf(1).format(a / 1e6) + " mi";
  }
  const data = (s) => (s ? s.split("-").reverse().join("/") : "—");
  function el(tag, attrs, ...filhos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else e.setAttribute(k, v);
    }
    for (const f of filhos) if (f != null) e.append(f);
    return e;
  }
  const SVG = "http://www.w3.org/2000/svg";
  function sv(tag, attrs, texto) {
    const e = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    if (texto != null) e.textContent = texto;
    return e;
  }
  const limpar = (e) => { while (e.firstChild) e.removeChild(e.firstChild); return e; };
  const td = (texto, cls) => el("td", { class: cls || "", text: texto });
  const tdNum = (v, f = pct, extra = "") => el("td", { class: "num" + (v < 0 ? " neg" : "") + (extra ? " " + extra : ""), text: f(v) });
  function cabecalho(tab, cols, numA = 1) {
    tab.append(el("thead", {}, el("tr", {}, ...cols.map((c, j) => el("th", { class: j >= numA ? "num" : "", scope: "col", text: c })))));
  }

  // ---------- leitura (texto dos autores; opcional) ----------
  const L = () => est.dados.leitura || {};
  const chave = (painel) => `${est.classe}|${est.periodo}|${painel}`;
  const manchete = (painel, auto) => ((L().manchetes || {})[chave(painel)] || auto);
  function comentarios(id, auto) {
    const c = L().comentarios || {};
    return c[chave(id)] || c[id] || auto;
  }

  // ---------- dados do recorte ----------
  const blocoDe = (cl, per) => ((est.dados.classes[cl] || {}).periodos || {})[per || est.periodo] || {};
  const bloco = () => blocoDe(est.classe);
  const ind = (id) => est.dados.indicadores.find((i) => i.id === id);
  const geral = (per) => (est.dados.geral || {})[per || est.periodo] || {};

  // ---------- navegação ----------
  function irPara(visao, classe) {
    est.visao = visao;
    if (classe) est.classe = classe;
    history.replaceState(null, "", "#" + visao);
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function botoes() {
    const nv = limpar($("visoes"));
    for (const [k, n] of VISOES) {
      const b = el("button", { type: "button", role: "tab", id: "aba-" + k, "aria-controls": "v-" + k,
                               "aria-selected": String(k === est.visao), text: n });
      b.onclick = () => irPara(k);
      nv.append(b);
    }
    for (const [k] of VISOES) $("v-" + k).hidden = k !== est.visao;

    const bc = limpar($("botoes-classe"));
    const dest = el("button", { type: "button", class: "botao-destaque", "aria-haspopup": "dialog", text: "Destaque" });
    dest.onclick = abrirDestaque;
    bc.append(dest);
    if (est.visao === "classe") {   // a classe só filtra a visão "Por classe"; as outras mostram todas lado a lado
      for (const c of CLASSES) {
        const b = el("button", { type: "button", "aria-pressed": String(c === est.classe), text: c });
        b.onclick = () => { est.classe = c; render(); };
        bc.append(b);
      }
    }
    const quem = el("button", { type: "button", class: "botao-quem", "aria-haspopup": "dialog", text: "Quem somos" });
    quem.onclick = () => abrir($("dlg-quem"));
    bc.append(quem);
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

  function cardSimples(nome, valor, det, extra) {
    return el("div", { class: "card" + (extra ? " " + extra : "") }, el("div", { class: "nome", text: nome }),
      el("div", { class: "valor" + (/^−/.test(valor) ? " neg" : ""), text: valor }), el("div", { class: "det", text: det }));
  }

  // ---------- leitura do mês ----------
  function leitura() {
    const l = est.dados.leitura;
    $("leitura").hidden = !(l && l.manchete) || est.visao !== "geral";
    if (!l || !l.manchete) return;
    $("leitura-manchete").textContent = l.manchete;
    const ul = limpar($("leitura-bullets"));
    for (const b of l.bullets || []) ul.append(el("li", { text: b }));
    $("leitura-assinatura").textContent = l.assinatura || "";
  }

  // =====================================================================
  // VISÃO GERAL
  // =====================================================================
  function visaoGeral() {
    const per = est.periodo, g = geral(), cdi = ind("cdi"), poup = ind("poupanca");
    $("geral-rotulo").textContent = "TODOS OS FUNDOS DO PAINEL · " + ROT_PER[per];
    let auto = `${inteiro(g.n_fundos)} fundos com ${reais(g.pl)} de patrimônio; média de ${pct(g.rent_media)} ${NOME_PER[per]}`;
    if (cdi && cdi[per] != null) auto += `, contra ${pct(cdi[per])} do CDI`;
    $("geral-manchete").textContent = auto;
    const cards = limpar($("geral-cards"));
    cards.append(el("div", { class: "card escuro" }, el("div", { class: "nome", text: "Patrimônio total" }),
      el("div", { class: "valor", text: reais(g.pl) }),
      el("div", { class: "det", text: `${inteiro(g.n_fundos)} fundos · ${inteiro(g.cotistas)} posições de cotistas` })));
    cards.append(cardSimples("Captação líquida " + NOME_PER[per], reais(g.capliq), "aplicações − resgates"));
    cards.append(cardSimples("Rentabilidade média", pct(g.rent_media), `mediana ${pct(g.rent_mediana)} · ${inteiro(g.n_com_rent)} fundos`));
    cards.append(cardSimples("Média ponderada pelo PL", pct(g.rent_ponderada), "peso de cada fundo = seu patrimônio"));
    if (cdi) cards.append(cardSimples("CDI", pct(cdi[per]), cdi.fonte));
    if (poup) cards.append(cardSimples("Poupança", pct(poup[per]), poup.fonte));

    tabelaResumo(g);
    distribuicao(g);
    superaram();
    quartis();
    evolucao();
  }

  function tabelaResumo(g) {
    const tab = limpar($("tab-resumo"));
    tab.style.minWidth = "820px";
    cabecalho(tab, ["Classe", "Fundos", "Patrimônio", "% do PL", "Captação líq.", "Média", "Mediana", "Ponderada", "Desvio padrão", "Vol. média"]);
    const tb = el("tbody");
    for (const cl of CLASSES) {
      const t = blocoDe(cl).total || {};
      const nome = el("button", { type: "button", class: "link", text: cl, title: "Abrir a visão desta classe" });
      nome.onclick = () => irPara("classe", cl);
      tb.append(el("tr", {}, el("td", {}, el("span", { class: "ponto", style: `background:${CORES[cl]}` }), nome),
        tdNum(t.n_fundos, inteiro), tdNum(t.pl, reais), tdNum(g.pl ? (100 * t.pl) / g.pl : null, (x) => pct(x, 1)),
        tdNum(t.capliq, reais), tdNum(t.rent_media, pct, "forte"), tdNum(t.rent_mediana), tdNum(t.rent_ponderada),
        tdNum(t.rent_desvio, (x) => (x == null ? "—" : nf(2).format(x) + " p.p.")), tdNum(t.vol_media)));
    }
    tb.append(el("tr", { class: "total" }, td("Total"), tdNum(g.n_fundos, inteiro), tdNum(g.pl, reais), td("100%", "num"),
      tdNum(g.capliq, reais), tdNum(g.rent_media, pct, "forte"), tdNum(g.rent_mediana), tdNum(g.rent_ponderada), td("—", "num"), td("—", "num")));
    tab.append(tb);
  }

  function distribuicao(g) {
    const d = limpar($("distribuicao"));
    for (const [rot, campo, tot, fmt] of [["Patrimônio", "pl", g.pl, reais], ["Posições de cotistas", "cotistas", g.cotistas, inteiro],
                                          ["Número de fundos", "n_fundos", g.n_fundos, inteiro]]) {
      d.append(el("div", { class: "barra-linha" }, el("span", { class: "forte", text: rot }), el("span", { text: fmt(tot) })));
      const barra = el("div", { class: "empilhada", role: "img",
        "aria-label": rot + ": " + CLASSES.map((cl) => `${cl} ${pct(tot ? (100 * ((blocoDe(cl).total || {})[campo] || 0)) / tot : 0, 1)}`).join(", ") });
      for (const cl of CLASSES) {
        const v = (blocoDe(cl).total || {})[campo] || 0, p = tot ? (100 * v) / tot : 0;
        const s = el("div", { title: `${cl}: ${fmt(v)} (${pct(p, 1)})` });
        s.style.width = p + "%"; s.style.background = CORES[cl];
        if (p >= 9) s.textContent = nf(0).format(p) + "%";
        barra.append(s);
      }
      d.append(barra);
    }
    const leg = el("div", { class: "legenda" });
    for (const cl of CLASSES) leg.append(el("span", {}, el("span", { class: "ponto", style: `background:${CORES[cl]}` }), cl));
    d.append(leg);
  }

  function superaram() {
    const per = est.periodo;
    $("superaram-rotulo").textContent = "FUNDOS ACIMA DAS REFERÊNCIAS · " + ROT_PER[per];
    const s = limpar($("superaram"));
    const tab = el("table", { class: "tabela grade" });
    cabecalho(tab, ["Referência", ...CLASSES]);
    const tb = el("tbody");
    for (const [k, nome] of COMPS) {
      const i = k === "mediana" ? null : ind(k);
      const ref = i ? `${nome} (${pct(i[per])})` : nome;
      const linha = el("tr", {}, td(ref));
      for (const cl of CLASSES) {
        const c = (blocoDe(cl).comparacoes || {})[k];
        if (!c) { linha.append(td("—", "num")); continue; }
        const a = (c.acima || {}).n_fundos || 0, b = (c.abaixo || {}).n_fundos || 0, n = a + b, p = n ? (100 * a) / n : null;
        const cel = el("td", { class: "num celula-barra", title: `${inteiro(a)} de ${inteiro(n)} ${PLURAL[cl]}` });
        const barra = el("div", { class: "mini" }); const cheio = el("div");
        cheio.style.width = (p || 0) + "%"; cheio.style.background = CORES[cl]; barra.append(cheio);
        cel.append(el("span", { class: "forte", text: pct(p, 0) }), barra);
        linha.append(cel);
      }
      tb.append(linha);
    }
    tab.append(tb);
    s.append(el("div", { class: "rolagem" }, tab));
  }

  function quartis() {
    const per = est.periodo;
    $("quartis-rotulo").textContent = "QUARTIS DE RENTABILIDADE · " + ROT_PER[per];
    const tab = limpar($("tab-quartis"));
    tab.style.minWidth = "860px";
    cabecalho(tab, ["Classe", "Mediana 1º quartil", "Limite 1º/2º", "Mediana 2º quartil", "Limite 2º/3º (mediana)",
                    "Mediana 3º quartil", "Limite 3º/4º", "Mediana 4º quartil", "Média", "Desvio padrão"]);
    const tb = el("tbody");
    for (const cl of CLASSES) {
      const t = blocoDe(cl).total || {};
      tb.append(el("tr", {}, td(cl), tdNum(t.mediana_q1), tdNum(t.quartil_p25, pct, "limite"), tdNum(t.mediana_q2),
        tdNum(t.quartil_p50, pct, "limite"), tdNum(t.mediana_q3), tdNum(t.quartil_p75, pct, "limite"), tdNum(t.mediana_q4),
        tdNum(t.rent_media, pct, "forte"), tdNum(t.rent_desvio, (x) => (x == null ? "—" : nf(2).format(x) + " p.p."))));
    }
    tab.append(tb);
  }

  function evolucao() {
    const d0 = est.dados.d0;
    const tab = limpar($("tab-evolucao"));
    tab.style.minWidth = "940px";
    cabecalho(tab, ["Classe", "PL hoje", `PL em ${data(d0.ANO)}`, `PL em ${data(d0["12M"])}`, `PL em ${data(d0["36M"])}`,
                    "Captação no mês", "no ano", "em 12 meses", "em 36 meses"]);
    const tb = el("tbody");
    const linha = (nome, f, cls) => {
      const pl = f("MES").pl;
      const antes = (p) => { const x = f(p); return x.pl != null && x.dif_pl != null ? x.pl - x.dif_pl : null; };
      tb.append(el("tr", { class: cls || "" }, td(nome), tdNum(pl, reais, "forte"), tdNum(antes("ANO"), reais),
        tdNum(antes("12M"), reais), tdNum(antes("36M"), reais),
        ...["MES", "ANO", "12M", "36M"].map((p) => tdNum(f(p).capliq, reais))));
    };
    for (const cl of CLASSES) linha(cl, (p) => blocoDe(cl, p).total || {});
    linha("Total", (p) => geral(p), "total");
    tab.append(tb);
  }

  // =====================================================================
  // POR CLASSE
  // =====================================================================
  function rentabilidade() {
    const t = bloco().total || {}, per = est.periodo, cdi = ind("cdi"), ibov = ind("ibovespa");
    $("rent-rotulo").textContent = `${est.classe} · RENTABILIDADE ${ROT_PER[per]}`;
    let auto = `${est.classe}: média de ${pct(t.rent_media)} ${NOME_PER[per]}`;
    if (cdi && cdi[per] != null) auto += `, ${t.rent_media >= cdi[per] ? "acima" : "abaixo"} dos ${pct(cdi[per])} do CDI`;
    if (ibov && ibov[per] != null) auto += ` e ${t.rent_media >= ibov[per] ? "acima" : "abaixo"} dos ${pct(ibov[per])} do Ibovespa`;
    $("rent-manchete").textContent = manchete("rentabilidade", auto);

    const cards = limpar($("cards"));
    cards.append(el("div", { class: "card escuro" }, el("div", { class: "nome", text: est.classe + " (média)" }),
      el("div", { class: "valor", text: pct(t.rent_media) }),
      el("div", { class: "det", text: `${inteiro(t.n_com_rent)} fundos · mediana ${pct(t.rent_mediana)}` })));
    const ids = ["cdi", "poupanca", ...est.dados.classes[est.classe].destaques, "ptax"];
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
      const abre = () => mostrarDica(card, `${i.nome} ${NOME_PER[per]}`, linhas);
      card.addEventListener("mouseenter", abre); card.addEventListener("focus", abre);
      card.addEventListener("mouseleave", esconder); card.addEventListener("blur", esconder);
      cards.append(card);
    }
    const e = limpar($("estatisticas"));
    for (const [rot, v] of [["Média ponderada pelo PL", pct(t.rent_ponderada)],
                            ["Desvio padrão entre os fundos", t.rent_desvio == null ? "—" : nf(2).format(t.rent_desvio) + " p.p."],
                            ["25% piores até", pct(t.quartil_p25)], ["Mediana", pct(t.quartil_p50)], ["25% melhores a partir de", pct(t.quartil_p75)],
                            ["Volatilidade média", pct(t.vol_media)], ["Patrimônio", reais(t.pl)], ["Captação líquida", reais(t.capliq)]])
      e.append(el("div", {}, el("span", { class: "nota", text: rot }), el("b", { text: v })));
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
    cabecalho(tab, ["#", "Fundo", "Gestor", "Rent.", "Vol.", "PL", "Cap. líq.", "Cotistas"], 3);
    const tb = el("tbody");
    lista.forEach((f, j) => {
      tb.append(el("tr", {}, td(String(j + 1)), el("td", { text: f.nome, title: f.nome_completo || f.nome }), td(f.gestor || ""),
        tdNum(f.rent, pct, "forte"), tdNum(f.vol), tdNum(f.pl, reais), tdNum(f.capliq, reais), tdNum(f.cotistas, inteiro)));
    });
    tab.append(tb);
  }

  function comparacao() {
    const per = est.periodo, comps = bloco().comparacoes || {};
    const disponiveis = COMPS.filter(([k]) => comps[k]);
    if (!disponiveis.find(([k]) => k === est.comp) && disponiveis.length) est.comp = disponiveis[0][0];
    const nomeRef = (COMPS.find((c) => c[0] === est.comp) || ["", ""])[1];
    const c = comps[est.comp] || {}, ac = c.acima || {}, ab = c.abaixo || {};
    $("comp-rotulo").textContent = `Acima e abaixo · ${nomeRef} · ${ROT_PER[per].toLowerCase()}`;
    const n = (ac.n_fundos || 0) + (ab.n_fundos || 0);
    const art = est.comp === "poupanca" ? "a " : "o ";
    $("comp-manchete").textContent = manchete("comparacao_" + est.comp,
      `${inteiro(ac.n_fundos)} de ${inteiro(n)} ${PLURAL[est.classe]} ${est.comp === "mediana" ? "ficaram na mediana da classe ou acima" : "bateram " + art + nomeRef}`);
    abas("abas-comp", disponiveis, est.comp, (k) => { est.comp = k; comparacao(); });
    const b = limpar($("barras"));
    const prep = est.comp === "mediana" || est.comp === "poupanca" ? "à " : "ao ";
    for (const [rot, g, cor] of [["Acima ou igual", ac, "#1f4e8c"], ["Abaixo", ab, "#a35c00"]]) {
      const p = n ? (100 * (g.n_fundos || 0)) / n : 0;
      b.append(el("div", { class: "barra-linha" }, el("span", { text: `${rot} ${prep}${est.comp === "mediana" ? "mediana" : nomeRef}` }),
        el("span", { class: "forte", text: `${inteiro(g.n_fundos)} fundos · média ${pct(g.rent_media)}` })));
      const barra = el("div", { class: "barra", role: "img", "aria-label": `${nf(1).format(p)}% dos fundos` });
      const cheio = el("div"); cheio.style.width = p + "%"; cheio.style.background = cor;
      barra.append(cheio); b.append(barra);
    }
    const tab = limpar($("tab-comp"));
    cabecalho(tab, ["", "PL", "Cap. líq."]);
    const tb = el("tbody");
    for (const [rot, g] of [["Acima", ac], ["Abaixo", ab]])
      tb.append(el("tr", {}, td(rot), tdNum(g.pl, reais), tdNum(g.capliq, reais)));
    tab.append(tb);
  }

  // =====================================================================
  // RISCO × RETORNO
  // =====================================================================
  async function carregarFundos() {
    const mes = est.dados.mes;
    if (!est.fundos[mes]) {
      const r = await fetch(`dados/${mes}-fundos.json`, { cache: "no-cache" });
      if (!r.ok) throw new Error("lista de fundos indisponível para " + mes);
      est.fundos[mes] = await r.json();
    }
    return est.fundos[mes];
  }

  function escala(d0, d1, r0, r1) { const k = (r1 - r0) / ((d1 - d0) || 1); return (x) => r0 + (x - d0) * k; }
  function marcas(a, b, n = 5) {
    const passo0 = (b - a) / n || 1, mag = Math.pow(10, Math.floor(Math.log10(passo0)));
    const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= passo0) || passo0;
    const out = [];
    for (let v = Math.ceil(a / passo) * passo; v <= b + 1e-9; v += passo) out.push(+v.toFixed(10));
    return out;
  }
  const normal = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  async function visaoRisco() {
    const per = est.periodo;
    $("risco-rotulo").textContent = "RISCO × RETORNO · " + ROT_PER[per];
    const alvo = $("graficos-risco");
    let lista;
    try { lista = await carregarFundos(); } catch (e) { limpar(alvo).append(el("div", { class: "aviso", text: String(e.message || e) })); return; }
    if (est.visao !== "risco") return;
    // busca
    const dl = $("lista-fundos");
    if (dl.dataset.mes !== est.dados.mes) {
      limpar(dl);
      for (const f of lista) dl.append(el("option", { value: `${f.n} · ${f.c}` }));
      dl.dataset.mes = est.dados.mes;
    }
    const inp = $("busca-fundo"), chk = $("sem-extremos");
    chk.checked = est.semExtremos;
    chk.onchange = () => { est.semExtremos = chk.checked; desenharRisco(lista); };
    inp.oninput = () => { est.busca = acharFundo(lista, inp.value); desenharRisco(lista); };
    desenharRisco(lista);
  }

  function acharFundo(lista, q) {
    q = String(q || "").trim();
    if (q.length < 3) return null;
    const m = q.match(/·\s*(\d{14})$/);
    if (m) return lista.find((f) => f.c === m[1]) || null;
    const dig = q.replace(/\D/g, "");
    if (dig.length >= 6 && dig.length === q.replace(/[\s./-]/g, "").length) {
      const r = lista.filter((f) => f.c.startsWith(dig));
      return r.length === 1 ? r[0] : null;
    }
    const nq = normal(q);
    const exato = lista.filter((f) => normal(f.n) === nq || normal(f.nc) === nq);
    if (exato.length) return exato[0];
    const r = lista.filter((f) => normal(f.n).includes(nq) || normal(f.nc).includes(nq));
    return r.length === 1 ? r[0] : null;
  }

  function desenharRisco(lista) {
    const per = est.periodo, alvo = limpar($("graficos-risco")), achado = est.busca;
    fichaFundo(achado);
    for (const cl of CLASSES) {
      let pts = lista.filter((f) => f.k === cl && f.p[per] && f.p[per][0] != null && f.p[per][1] != null)
                     .map((f) => ({ f, r: f.p[per][0], v: f.p[per][1] }));
      const total = pts.length;
      let escondidos = 0;
      if (est.semExtremos && pts.length > 2) {
        const est2 = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length;
          return [m, Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1))]; };
        const [mr, sr] = est2(pts.map((p) => p.r)), [mv, sv2] = est2(pts.map((p) => p.v));
        const ok = (p) => Math.abs(p.r - mr) <= 2 * sr && Math.abs(p.v - mv) <= 2 * sv2;
        const antes = pts.length;
        pts = pts.filter((p) => ok(p) || (achado && p.f.c === achado.c));
        escondidos = antes - pts.length;
      }
      const t = blocoDe(cl).total || {}, med = t.rent_mediana;
      const caixa = el("figure", { class: "grafico-risco" });
      caixa.append(el("figcaption", {}, el("span", { class: "ponto", style: `background:${CORES[cl]}` }), el("b", { text: cl }),
        el("span", { class: "nota", text: ` · ${inteiro(pts.length)} de ${inteiro(total)} fundos` +
          (escondidos ? ` (${inteiro(escondidos)} extremos escondidos)` : "") + ` · mediana ${pct(med)}` })));
      if (!pts.length) { caixa.append(el("div", { class: "nota", text: "Sem fundos com rentabilidade e volatilidade no período." })); alvo.append(caixa); continue; }
      const W = 560, H = 340, m = { e: 56, d: 14, t: 12, b: 40 };
      const rs = pts.map((p) => p.r).concat(med != null ? [med] : []), vs = pts.map((p) => p.v);
      let [y0, y1] = [Math.min(...rs), Math.max(...rs)]; const fy = (y1 - y0) * 0.05 || 1; y0 -= fy; y1 += fy;
      const x1 = Math.max(...vs) * 1.05 || 1;
      const X = escala(0, x1, m.e, W - m.d), Y = escala(y0, y1, H - m.b, m.t);
      const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", class: "dispersao",
        "aria-label": `${cl}: ${pts.length} fundos; rentabilidade de ${pct(Math.min(...pts.map((p) => p.r)))} a ${pct(Math.max(...pts.map((p) => p.r)))}` });
      for (const v of marcas(y0, y1)) {
        svg.append(sv("line", { x1: m.e, x2: W - m.d, y1: Y(v), y2: Y(v), class: v === 0 ? "eixo-zero" : "grade" }));
        svg.append(sv("text", { x: m.e - 6, y: Y(v) + 4, "text-anchor": "end", class: "marca" }, pct(v, Math.abs(v) < 10 && v % 1 ? 1 : 0)));
      }
      for (const v of marcas(0, x1)) {
        svg.append(sv("line", { x1: X(v), x2: X(v), y1: m.t, y2: H - m.b, class: "grade" }));
        svg.append(sv("text", { x: X(v), y: H - m.b + 16, "text-anchor": "middle", class: "marca" }, pct(v, v % 1 ? 1 : 0)));
      }
      svg.append(sv("text", { x: (m.e + W - m.d) / 2, y: H - 4, "text-anchor": "middle", class: "titulo-eixo" }, "Volatilidade anualizada"));
      svg.append(sv("text", { x: 12, y: (m.t + H - m.b) / 2, "text-anchor": "middle", class: "titulo-eixo",
        transform: `rotate(-90 12 ${(m.t + H - m.b) / 2})` }, "Rentabilidade " + NOME_PER[per]));
      if (med != null) {
        svg.append(sv("line", { x1: m.e, x2: W - m.d, y1: Y(med), y2: Y(med), class: "mediana" }));
        svg.append(sv("text", { x: W - m.d - 4, y: Y(med) - 5, "text-anchor": "end", class: "rot-mediana" }, "mediana " + pct(med)));
      }
      const g = sv("g", { fill: CORES[cl], "fill-opacity": "0.45" });
      let destaque = null;
      pts.forEach((p, j) => {
        if (achado && p.f.c === achado.c) { destaque = p; return; }
        g.append(sv("circle", { cx: X(p.v).toFixed(1), cy: Y(p.r).toFixed(1), r: 3.2, "data-j": j }));
      });
      svg.append(g);
      if (destaque) {
        svg.append(sv("circle", { cx: X(destaque.v), cy: Y(destaque.r), r: 8, class: "achado", "data-j": pts.indexOf(destaque) }));
      }
      svg.addEventListener("mouseover", (e) => {
        const j = e.target.getAttribute && e.target.getAttribute("data-j");
        if (j == null) return;
        const f = pts[+j].f, q = f.p[per];
        mostrarDica(e.target, f.n, [`Rentabilidade ${NOME_PER[per]}: ${pct(q[0])}`, `Volatilidade: ${pct(q[1])}`,
          `Patrimônio: ${reais(q[2])}`, `Gestor: ${f.g || "—"}`, `CNPJ: ${f.c}`]);
      });
      svg.addEventListener("mouseout", esconder);
      svg.addEventListener("click", (e) => {
        const j = e.target.getAttribute && e.target.getAttribute("data-j");
        if (j == null) return;
        const f = pts[+j].f;
        $("busca-fundo").value = `${f.n} · ${f.c}`; est.busca = f; desenharRisco(lista);
      });
      caixa.append(svg);
      alvo.append(caixa);
    }
  }

  function fichaFundo(f) {
    const fi = limpar($("ficha-fundo"));
    fi.hidden = !f;
    if (!f) return;
    fi.append(el("div", {}, el("b", { text: f.n }), el("span", { class: "nota", text: ` · ${f.k} · ${f.g || "gestor não informado"} · CNPJ ${f.c}` })));
    const tab = el("table", { class: "tabela compacta" });
    cabecalho(tab, ["", ...PERIODOS.map((p) => p[1])]);
    const tb = el("tbody");
    const lin = (rot, fn, fmt = pct) => tb.append(el("tr", {}, td(rot), ...PERIODOS.map(([p]) => tdNum(fn(p), fmt))));
    lin("Rentabilidade", (p) => (f.p[p] || [])[0]);
    lin("Mediana da classe", (p) => ((blocoDe(f.k, p).total) || {}).rent_mediana);
    lin("CDI", (p) => (ind("cdi") || {})[p]);
    lin("Volatilidade", (p) => (f.p[p] || [])[1]);
    lin("Captação líquida", (p) => (f.p[p] || [])[3], reais);
    tab.append(tb);
    fi.append(el("div", { class: "rolagem" }, tab));
    const pl = (f.p.MES || [])[2], cot = (f.p.MES || [])[4];
    fi.append(el("div", { class: "nota", text: `Patrimônio ${reais(pl)} · ${inteiro(cot)} cotistas · nome registrado: ${f.nc}` }));
  }

  // =====================================================================
  // INDICADORES
  // =====================================================================
  function visaoIndicadores() {
    const per = est.periodo, lista = est.dados.indicadores.filter((i) => i[per] != null);
    $("ind-rotulo").textContent = "INDICADORES DE MERCADO · " + ROT_PER[per];
    if (lista.length) {
      const ord = [...lista].sort((a, b) => b[per] - a[per]), top = ord[0], fim = ord[ord.length - 1];
      $("ind-manchete").textContent = `${top.nome} lidera ${NOME_PER[per]} (${pct(top[per])}); ${fim.nome} fica na lanterna (${pct(fim[per])})`;
    } else $("ind-manchete").textContent = "Sem indicadores para o período.";

    // gráfico de barras agrupado
    const gr = limpar($("grafico-indicadores"));
    const grupos = (est.dados.grupos_indicadores || []).map((g) => [g, est.dados.indicadores.filter((i) => i.grupo === g)]);
    const fundosRef = CLASSES.map((cl) => ({ nome: cl + " (média dos fundos)", v: (blocoDe(cl).total || {}).rent_media, fundo: true, cor: CORES[cl] }));
    const todos = grupos.flatMap(([, is]) => is.map((i) => i[per])).concat(fundosRef.map((f) => f.v)).filter((v) => v != null);
    const mn = Math.min(0, ...todos), mx = Math.max(0, ...todos), amp = mx - mn || 1;
    const zero = (100 * -mn) / amp;
    const linhaBarra = (nome, v, cls, titulo) => {
      const w = v == null ? 0 : (100 * Math.abs(v)) / amp, esq = v == null || v >= 0 ? zero : zero - w;
      const trilho = el("div", { class: "trilho" });
      const b = el("div", { class: "b " + cls }); b.style.left = esq + "%"; b.style.width = w + "%";
      const z = el("div", { class: "zero" }); z.style.left = zero + "%";
      trilho.append(z, b);
      return el("div", { class: "linha-barra", title: titulo || nome }, el("span", { class: "nome", text: nome }), trilho,
        el("span", { class: "val" + (v < 0 ? " neg" : ""), text: pct(v) }));
    };
    for (const [g, is] of grupos) {
      if (!is.length) continue;
      gr.append(el("div", { class: "grupo-titulo", text: g }));
      for (const i of [...is].sort((a, b) => (b[per] ?? -1e9) - (a[per] ?? -1e9))) gr.append(linhaBarra(i.nome, i[per], "mercado", i.fonte));
    }
    gr.append(el("div", { class: "grupo-titulo", text: "Fundos do painel" }));
    for (const f of fundosRef) gr.append(linhaBarra(f.nome, f.v, "fundos"));

    // tabela com os quatro períodos
    const tab = limpar($("tab-indicadores"));
    tab.style.minWidth = "720px";
    tab.append(el("thead", {}, el("tr", {}, el("th", { scope: "col", text: "Indicador" }),
      ...PERIODOS.map(([p, n]) => el("th", { class: "num" + (p === per ? " atual" : ""), scope: "col", text: n })),
      el("th", { scope: "col", text: "Fonte" }))));
    const tb = el("tbody");
    for (const [g, is] of grupos) {
      if (!is.length) continue;
      tb.append(el("tr", { class: "grupo" }, el("th", { scope: "rowgroup", colspan: String(PERIODOS.length + 2), text: g })));
      for (const i of is)
        tb.append(el("tr", {}, td(i.nome), ...PERIODOS.map(([p]) => tdNum(i[p], pct, p === per ? "atual" : "")), td(i.fonte, "nota")));
    }
    const outros = est.dados.indicadores.filter((i) => !(est.dados.grupos_indicadores || []).includes(i.grupo));
    if (outros.length) {
      tb.append(el("tr", { class: "grupo" }, el("th", { scope: "rowgroup", colspan: String(PERIODOS.length + 2), text: "Outros" })));
      for (const i of outros) tb.append(el("tr", {}, td(i.nome), ...PERIODOS.map(([p]) => tdNum(i[p], pct, p === per ? "atual" : "")), td(i.fonte, "nota")));
    }
    tb.append(el("tr", { class: "grupo" }, el("th", { scope: "rowgroup", colspan: String(PERIODOS.length + 2), text: "Fundos do painel (média simples)" })));
    for (const cl of CLASSES)
      tb.append(el("tr", {}, td(cl), ...PERIODOS.map(([p]) => tdNum((blocoDe(cl, p).total || {}).rent_media, pct, p === per ? "atual" : "")),
        td("CVM, Informe Diário", "nota")));
    tab.append(tb);
  }

  // ---------- rodapé do mês ----------
  function resumo() {
    const d = est.dados, u = d.universo;
    $("resumo-texto").textContent = `Data-base ${data(d.data_base)}. ${inteiro(u.n_fundos)} fundos no universo, com ${reais(u.pl)} de patrimônio e ${inteiro(u.cotistas)} posições de cotistas. Início dos períodos: mês ${data(d.d0.MES)}, ano ${data(d.d0.ANO)}, 12 meses ${data(d.d0["12M"])}, 36 meses ${data(d.d0["36M"])}.`;
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

  // ---------- janelas (Destaque e Quem somos) ----------
  function abrir(d) {
    esconder();
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
  }
  function fechar(d) {
    if (typeof d.close === "function") d.close(); else d.removeAttribute("open");
  }
  document.querySelectorAll("dialog").forEach((d) => {
    d.querySelectorAll("[data-fecha]").forEach((b) => (b.onclick = () => fechar(d)));
    d.addEventListener("click", (e) => { if (e.target === d) fechar(d); });   // clique fora fecha
    d.addEventListener("close", () => { if (d.id === "dlg-destaque") limpar($("destaque-video")); });  // para o vídeo
  });

  function abrirDestaque() {
    const l = est.dados.leitura || {}, d = est.dados;
    $("destaque-titulo").textContent = l.destaque_titulo || `A indústria de fundos até ${data(d.data_base)}`;
    const t = limpar($("destaque-texto"));
    const paragrafos = (l.destaque || "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
    if (paragrafos.length) for (const p of paragrafos) t.append(el("p", { text: p }));
    else t.append(el("p", { class: "nota", text: "O destaque deste mês está em preparação." }));
    $("destaque-assinatura").textContent = paragrafos.length ? (l.assinatura || "") : "";
    const v = limpar($("destaque-video"));
    v.hidden = !d.video_id;
    if (d.video_id) {
      // só carrega o YouTube quando a janela abre; domínio sem cookies de rastreamento
      v.append(el("iframe", { src: `https://www.youtube-nocookie.com/embed/${d.video_id}`, title: "Vídeo do destaque do mês",
        loading: "lazy", allow: "accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen",
        referrerpolicy: "strict-origin-when-cross-origin", allowfullscreen: "" }));
    }
    abrir($("dlg-destaque"));
  }

  function render() {
    esconder();
    botoes(); leitura(); resumo();
    if (est.visao === "geral") visaoGeral();
    else if (est.visao === "classe") { rentabilidade(); ranking(); comparacao(); }
    else if (est.visao === "risco") visaoRisco();
    else visaoIndicadores();
  }

  async function carregar(mes) {
    const r = await fetch(`dados/${mes}.json`, { cache: "no-cache" });
    est.dados = await r.json();
    est.busca = null;
    $("busca-fundo").value = "";
    if (!est.dados.d0["36M"] && est.periodo === "36M") est.periodo = "12M";
    render();
  }

  async function iniciar() {
    const h = location.hash.replace("#", "");
    if (VISOES.some(([k]) => k === h)) est.visao = h;
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
