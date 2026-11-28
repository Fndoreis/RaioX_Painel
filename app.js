/* Raio-X Fundos PF — painel público. Lê dados/meses.json, dados/<mes>.json e, sob demanda, dados/<mes>-fundos.json
   (gerados por raiox.outputs.site). Visões: A palavra do Especialista, Visão geral, Indicadores, Por classe, Risco × retorno e Quem somos. */
(function () {
  "use strict";
  // ordem do menos ao mais arriscado
  const CLASSES = ["RF Baixa Duração", "Renda Fixa", "Multimercados", "Ações"];
  const CORES = { "RF Baixa Duração": "#5aa0e6", "Renda Fixa": "#1f4e8c", "Multimercados": "#d08c00", "Ações": "#2a8f62" };
  const VISOES = [["destaque", "A palavra do Especialista"], ["geral", "Visão geral"], ["indicadores", "Indicadores"], ["classe", "Por classe"],
                  ["risco", "Risco × retorno"], ["etfs", "ETFs"], ["quem", "Quem somos"]];
  const COM_PERIODO = new Set(["geral", "indicadores", "classe", "risco", "etfs"]);
  const COM_CLASSE = new Set(["classe", "risco"]);
  const PERIODOS = [["MES", "Mês"], ["ANO", "Ano"], ["12M", "12 meses"], ["36M", "36 meses"]];
  const NOME_PER = { MES: "no mês", ANO: "no ano", "12M": "em 12 meses", "36M": "em 36 meses" };
  const ROT_PER = { MES: "NO MÊS", ANO: "NO ANO", "12M": "EM 12 MESES", "36M": "EM 36 MESES" };
  const RANKINGS = [["maiores_rent", "Maiores rentabilidades"], ["menores_rent", "Menores rentabilidades"],
                    ["maiores_pl", "Maiores PL"], ["maiores_cotistas", "Maiores em cotistas"]];
  const COMPS = [["cdi", "CDI"], ["poupanca", "Poupança"], ["ibovespa", "Ibovespa"], ["ihfa", "IHFA"], ["mediana", "Mediana da classe"]];
  // referência de cada classe: renda fixa contra o CDI, ações contra o Ibovespa, multimercados contra o IHFA
  const BENCH = { "RF Baixa Duração": ["cdi", "CDI"], "Renda Fixa": ["cdi", "CDI"], "Multimercados": ["ihfa", "IHFA"],
                  "Ações": ["ibovespa", "Ibovespa"] };
  const bench = (cl = est.classe) => BENCH[cl] || ["cdi", "CDI"];
  const PLURAL = { "Ações": "fundos de ações", "Multimercados": "multimercados", "Renda Fixa": "fundos de renda fixa",
                   "RF Baixa Duração": "fundos de RF baixa duração" };
  const est = { dados: null, visao: "destaque", classe: "Multimercados", periodo: "ANO", ranking: "maiores_rent", comp: "cdi",
                fundos: {}, busca: null, etfs: {}, etfTipo: "Renda variável", etfTodos: false };
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
                               "aria-selected": String(k === est.visao), class: "aba-" + k, text: n });
      b.onclick = () => irPara(k);
      nv.append(b);
    }
    for (const [k] of VISOES) $("v-" + k).hidden = k !== est.visao;

    // classe: filtra "Por classe" e "Risco × retorno"; as outras visões mostram as classes lado a lado
    const bc = limpar($("botoes-classe"));
    bc.hidden = !COM_CLASSE.has(est.visao);
    for (const c of CLASSES) {
      const b = el("button", { type: "button", "aria-pressed": String(c === est.classe), text: c });
      b.onclick = () => { est.classe = c; render(); };
      bc.append(b);
    }
    const bp = limpar($("botoes-periodo"));
    bp.hidden = !COM_PERIODO.has(est.visao);
    for (const [p, n] of PERIODOS) {
      const b = el("button", { type: "button", "aria-pressed": String(p === est.periodo), text: n });
      b.onclick = () => { est.periodo = p; render(); };
      bp.append(b);
    }
    document.querySelector(".filtros").hidden = bc.hidden && bp.hidden;
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


  // =====================================================================
  // VISÃO GERAL
  // =====================================================================
  function visaoGeral() {
    const per = est.periodo, g = geral(), cdi = ind("cdi"), poup = ind("poupanca");
    $("geral-rotulo").textContent = "TODOS OS FUNDOS DO PAINEL · " + ROT_PER[per];
    let auto = `${inteiro(g.n_fundos)} fundos com ${reais(g.pl)} de patrimônio; o fundo típico rendeu ${pct(g.rent_mediana)} ${NOME_PER[per]}` +
      ` e o real aplicado, ${pct(g.rent_ponderada)}`;
    if (cdi && cdi[per] != null) auto += `, contra ${pct(cdi[per])} do CDI`;
    $("geral-manchete").textContent = auto;
    const cards = limpar($("geral-cards"));
    cards.append(el("div", { class: "card escuro" }, el("div", { class: "nome", text: "Patrimônio total" }),
      el("div", { class: "valor", text: reais(g.pl) }),
      el("div", { class: "det", text: `${inteiro(g.n_fundos)} fundos · ${inteiro(g.cotistas)} posições de cotistas` })));
    cards.append(cardSimples("Captação líquida " + NOME_PER[per], reais(g.capliq), "aplicações − resgates"));
    cards.append(cardSimples("Rentabilidade mediana", pct(g.rent_mediana), `fundo típico · ${inteiro(g.n_com_rent)} fundos com rentabilidade`));
    cards.append(cardSimples("Média ponderada pelo PL", pct(g.rent_ponderada), "retorno do real aplicado"));
    if (cdi) cards.append(cardSimples("CDI", pct(cdi[per]), cdi.fonte));
    if (poup) cards.append(cardSimples("Poupança", pct(poup[per]), poup.fonte));

    tabelaResumo(g);
    const semRent = g.n_fundos - g.n_com_rent;
    $("nota-sobrevivencia").textContent = semRent > 0
      ? `${inteiro(semRent)} dos ${inteiro(g.n_fundos)} fundos do universo não têm rentabilidade ${NOME_PER[per]} (não existiam no início do período ou não têm cota nas datas)` +
        `${per === "36M" ? ": em 36 meses, só entram fundos com 3 anos ou mais" : ""}. Fundos encerrados no caminho não aparecem (viés de sobrevivência).`
      : "";
    distribuicao(g);
    superaram();
    quartis();
    evolucao();
  }

  function tabelaResumo(g) {
    const tab = limpar($("tab-resumo"));
    tab.style.minWidth = "960px";
    cabecalho(tab, ["Classe", "Fundos", "Patrimônio", "% do PL", "Captação líq.", "Mediana", "Ponderada", "Média simples", "Desvio padrão", "Vol. mediana", "Drawdown mediano"]);
    const tb = el("tbody");
    for (const cl of CLASSES) {
      const t = blocoDe(cl).total || {};
      const nome = el("button", { type: "button", class: "link", text: cl, title: "Abrir a visão desta classe" });
      nome.onclick = () => irPara("classe", cl);
      tb.append(el("tr", {}, el("td", {}, el("span", { class: "ponto", style: `background:${CORES[cl]}` }), nome),
        tdNum(t.n_fundos, inteiro), tdNum(t.pl, reais), tdNum(g.pl ? (100 * t.pl) / g.pl : null, (x) => pct(x, 1)),
        tdNum(t.capliq, reais), tdNum(t.rent_mediana, pct, "forte"), tdNum(t.rent_ponderada), tdNum(t.rent_media),
        tdNum(t.rent_desvio, (x) => (x == null ? "—" : nf(2).format(x) + " p.p.")), tdNum(t.vol_mediana), tdNum(t.drawdown_mediana)));
    }
    tb.append(el("tr", { class: "total" }, td("Total"), tdNum(g.n_fundos, inteiro), tdNum(g.pl, reais), td("100%", "num"),
      tdNum(g.capliq, reais), tdNum(g.rent_mediana, pct, "forte"), tdNum(g.rent_ponderada), el("td", { class: "num", text: "—", title: "Média simples entre classes diferentes não é mostrada" }),
      td("—", "num"), td("—", "num"), td("—", "num")));
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
        tdNum(t.rent_media), tdNum(t.rent_desvio, (x) => (x == null ? "—" : nf(2).format(x) + " p.p."))));
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
      const antes = (p) => f(p).pl_d0 ?? null;   // só fundos de hoje que já existiam no início do período
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
    const t = bloco().total || {}, per = est.periodo, [bid, bnome] = bench(), bi = ind(bid);
    $("rent-rotulo").textContent = `${est.classe} · RENTABILIDADE ${ROT_PER[per]}`;
    const md = t.rent_mediana;
    let auto = `${est.classe}: o fundo típico rendeu ${pct(md)} ${NOME_PER[per]}`;
    if (bi && bi[per] != null && md != null) auto += `, ${md >= bi[per] ? "acima" : "abaixo"} dos ${pct(bi[per])} do ${bnome}`;
    $("rent-manchete").textContent = manchete("rentabilidade", auto);

    const cards = limpar($("cards"));
    cards.append(el("div", { class: "card escuro" }, el("div", { class: "nome", text: est.classe + " (mediana)" }),
      el("div", { class: "valor", text: pct(md) }),
      el("div", { class: "det", text: `${inteiro(t.n_com_rent)} fundos · ponderada ${pct(t.rent_ponderada)} · média ${pct(t.rent_media)}` })));
    const ids = [...new Set([bid, "cdi", "poupanca", ...est.dados.classes[est.classe].destaques, "ptax"])];
    for (const id of ids) {
      const i = ind(id);
      if (!i) continue;
      const v = i[per];
      const card = el("button", { type: "button", class: "card", "aria-describedby": "dica" },
        el("div", { class: "nome", text: i.nome }), el("div", { class: "valor" + (v < 0 ? " neg" : ""), text: pct(v) }),
        el("div", { class: "det", text: i.fonte }));
      const comp = (bloco().comparacoes || {})[id];
      const auto2 = [];
      if (v != null && md != null) {
        const dif = md - v;
        auto2.push(`${est.classe}: mediana ${pct(md)}, ${nf(2).format(Math.abs(dif))} p.p. ${dif >= 0 ? "acima" : "abaixo"} de ${i.nome}.`);
      }
      if (comp && comp.acima) auto2.push(`${inteiro(comp.acima.n_fundos)} de ${inteiro(t.n_com_rent)} fundos com rentabilidade igual ou maior.`);
      const linhas = comentarios(id, auto2);
      const abre = () => mostrarDica(card, `${i.nome} ${NOME_PER[per]}`, linhas);
      card.addEventListener("mouseenter", abre); card.addEventListener("focus", abre);
      card.addEventListener("mouseleave", esconder); card.addEventListener("blur", esconder);
      cards.append(card);
    }
    const e = limpar($("estatisticas"));
    for (const [rot, v] of [["Média ponderada pelo PL", pct(t.rent_ponderada)], ["Média simples", pct(t.rent_media)],
                            ["Desvio padrão entre os fundos", t.rent_desvio == null ? "—" : nf(2).format(t.rent_desvio) + " p.p."],
                            ["25% piores até", pct(t.quartil_p25)], ["Mediana", pct(t.quartil_p50)], ["25% melhores a partir de", pct(t.quartil_p75)],
                            ["Volatilidade mediana", pct(t.vol_mediana)], ["Drawdown mediano", pct(t.drawdown_mediana)],
                            ["Patrimônio", reais(t.pl)], ["Captação líquida", reais(t.capliq)]])
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
    const [bid] = bench();
    const disponiveis = COMPS.filter(([k]) => comps[k]).sort((a, b) => (b[0] === bid) - (a[0] === bid));
    if (est.compClasse !== est.classe) { est.comp = bid; est.compClasse = est.classe; }
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

  function gestores() {
    const per = est.periodo, g = bloco().gestores || {};
    $("gest-rotulo").textContent = `GESTORES · ${est.classe} · ${ROT_PER[per]}`;
    const top = (g.maiores || [])[0];
    const conc = g.hhi == null ? "" : g.hhi < 1000 ? "pouco concentrado" : g.hhi < 1500 ? "concentração baixa a moderada"
      : g.hhi < 2500 ? "moderadamente concentrado" : "muito concentrado";
    $("gest-manchete").textContent = top
      ? `${inteiro(g.n_gestores)} gestores; os 10 maiores têm ${pct(g.part_top10, 1)} do patrimônio (HHI ${inteiro(g.hhi)}, ${conc})`
      : "Sem dados de gestores no período.";
    const tab = limpar($("tab-gestores"));
    cabecalho(tab, ["#", "Gestor", "Fundos", "Patrimônio", "Participação", "Captação líq."], 2);
    const tb = el("tbody");
    (g.maiores || []).forEach((r, j) => tb.append(el("tr", {}, td(String(j + 1)), td(r.gestor), tdNum(r.n, inteiro),
      tdNum(r.pl, reais), tdNum(r.part, (x) => pct(x, 1), "forte"), tdNum(r.capliq, reais))));
    tab.append(tb);
    const c = limpar($("gest-captacao"));
    for (const [rot, lista] of [["Mais captaram " + NOME_PER[per], g.mais_captaram || []], ["Mais resgates " + NOME_PER[per], g.mais_resgates || []]]) {
      c.append(el("div", { class: "grupo-titulo", text: rot }));
      const t = el("table", { class: "tabela compacta" }), b = el("tbody");
      for (const r of lista) b.append(el("tr", {}, td(r.gestor), tdNum(r.capliq, reais, "forte")));
      t.append(b);
      c.append(t);
    }
  }

  function subtipos() {
    const per = est.periodo, lista = bloco().subtipos || [];
    $("sub-rotulo").textContent = `${est.classe} POR CLASSIFICAÇÃO ANBIMA · ${ROT_PER[per]}`;
    const comRent = lista.filter((r) => r.rent_mediana != null && r.n_com_rent >= 5);
    const ord = [...comRent].sort((a, b) => b.rent_mediana - a.rent_mediana);
    $("sub-manchete").textContent = ord.length > 1
      ? `${ord[0].subtipo} tem a maior mediana (${pct(ord[0].rent_mediana)}); ${ord[ord.length - 1].subtipo}, a menor (${pct(ord[ord.length - 1].rent_mediana)})`
      : `${lista.length} tipo(s) de classificação ANBIMA nesta classe`;
    const tab = limpar($("tab-subtipos"));
    tab.style.minWidth = "820px";
    cabecalho(tab, ["Classificação ANBIMA", "Fundos", "Patrimônio", "Captação líq.", "Mediana", "Ponderada", "Vol. mediana", "Drawdown mediano"]);
    const tb = el("tbody");
    for (const r of lista)
      tb.append(el("tr", {}, td(r.subtipo), tdNum(r.n, inteiro), tdNum(r.pl, reais), tdNum(r.capliq, reais),
        tdNum(r.rent_mediana, pct, "forte"), tdNum(r.rent_ponderada), tdNum(r.vol_mediana), tdNum(r.drawdown_mediana)));
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

  // ---------- outliers: cercas de Tukey externas (k = 3) por eixo, volatilidade em log10 ----------
  // Regra recomendada pela revisão estatística (reports/analise_estatistica_2026-11.md): usa quartis, então os
  // próprios extremos não deslocam o limite; a escala log trata a volatilidade, que é limitada em zero.
  const METODO_OUTLIER = "fundos com rentabilidade ou volatilidade (esta em escala logarítmica) a mais de 3 vezes a distância " +
    "entre o 1º e o 3º quartil, abaixo do 1º quartil ou acima do 3º, por classe e período. Classes com menos de 30 fundos não são filtradas.";
  const K_TUKEY = 3, N_MIN_OUTLIER = 30, PISO_VOL = 0.01;   // volatilidade em % a.a.
  const lvol = (v) => Math.log10(Math.max(v, PISO_VOL));
  function quantil(o, p) { const h = (o.length - 1) * p, i = Math.floor(h); return o[i] + (h - i) * ((i + 1 < o.length ? o[i + 1] : o[i]) - o[i]); }
  function cercas(xs) {
    const o = [...xs].sort((a, b) => a - b), q1 = quantil(o, 0.25), q3 = quantil(o, 0.75), iqr = q3 - q1;
    return iqr > 1e-12 ? [q1 - K_TUKEY * iqr, q3 + K_TUKEY * iqr] : [-Infinity, Infinity];
  }
  function outliers(pts) {
    // devolve o conjunto de índices de pts considerados valores extremos
    const fora = new Set();
    if (pts.length < N_MIN_OUTLIER) return fora;
    const [r0, r1] = cercas(pts.map((p) => p.r)), [x0, x1] = cercas(pts.map((p) => lvol(p.v)));
    pts.forEach((p, j) => { const x = lvol(p.v); if (p.r < r0 || p.r > r1 || x < x0 || x > x1) fora.add(j); });
    return fora;
  }
  // no Mês e no Ano o eixo x usa a volatilidade de 12 meses: ~21 dias de cota são dominados por um único pregão
  const perVol = (per) => (per === "MES" || per === "ANO" ? "12M" : per);
  function pontos(lista, cl, per) {
    const pv = perVol(per);
    return lista.filter((f) => f.k === cl && f.p[per] && f.p[per][0] != null && f.p[pv] && f.p[pv][1] != null)
                .map((f) => ({ f, r: f.p[per][0], v: f.p[pv][1] }));
  }
  function resumoPts(pts) {
    if (!pts.length) return {};
    const rs = pts.map((p) => p.r).sort((a, b) => a - b), n = rs.length, m = rs.reduce((a, b) => a + b, 0) / n;
    const med = n % 2 ? rs[(n - 1) / 2] : (rs[n / 2 - 1] + rs[n / 2]) / 2;
    const dp = n > 1 ? Math.sqrt(rs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1)) : null;
    return { n, media: m, mediana: med, desvio: dp };
  }

  async function visaoRisco() {
    const per = est.periodo;
    $("risco-rotulo").textContent = `RISCO × RETORNO · ${est.classe} · ${ROT_PER[per]}`;
    const alvo = $("graficos-risco");
    let lista;
    try { lista = await carregarFundos(); } catch (e) { limpar(alvo).append(el("div", { class: "aviso", text: String(e.message || e) })); return; }
    if (est.visao !== "risco") return;
    const dl = $("lista-fundos");
    if (dl.dataset.mes !== est.dados.mes) {
      limpar(dl);
      for (const f of lista) dl.append(el("option", { value: `${f.n} · ${f.c}` }));
      dl.dataset.mes = est.dados.mes;
    }
    const inp = $("busca-fundo");
    inp.oninput = () => {
      est.busca = acharFundo(lista, inp.value);
      if (est.busca && est.busca.k !== est.classe) { est.classe = est.busca.k; render(); } else desenharRisco(lista);
    };
    desenharRisco(lista);
    tabelaOutliers(lista);
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
    const per = est.periodo, cl = est.classe, alvo = limpar($("graficos-risco")), achado = est.busca;
    fichaFundo(achado);
    const todos = pontos(lista, cl, per), fora = outliers(todos), sem = todos.filter((_, j) => !fora.has(j));
    $("risco-manchete").textContent = todos.length
      ? `${est.classe}: ${inteiro(todos.length)} fundos, dos quais ${inteiro(fora.size)} são valores extremos (outliers)`
      : `${est.classe}: sem fundos com rentabilidade e volatilidade ${NOME_PER[per]}`;
    const med = (blocoDe(cl).total || {}).rent_mediana;
    for (const [titulo, pts, extra, marcar] of [["Com todos os fundos", todos, `${inteiro(todos.length)} fundos · outliers em vermelho-claro`, fora],
                                                 ["Sem outliers", sem, `${inteiro(sem.length)} fundos · ${inteiro(fora.size)} retirados`, null]]) {
      const caixa = el("figure", { class: "grafico-risco" });
      caixa.append(el("figcaption", {}, el("b", { text: titulo }), el("span", { class: "nota", text: ` · ${extra} · mediana da classe ${pct(med)}` })));
      if (!pts.length) { caixa.append(el("div", { class: "nota", text: "Sem fundos no período." })); alvo.append(caixa); continue; }
      caixa.append(dispersao(pts, cl, per, med, achado, marcar, lista));
      alvo.append(caixa);
    }
  }

  function dispersao(pts, cl, per, med, achado, fora, lista) {
    const W = 560, H = 360, m = { e: 58, d: 14, t: 14, b: 40 };
    const rs = pts.map((p) => p.r).concat(med != null ? [med] : []), vs = pts.map((p) => p.v);
    let [y0, y1] = [Math.min(...rs), Math.max(...rs)]; const fy = (y1 - y0) * 0.05 || 1; y0 -= fy; y1 += fy;
    // eixo x em escala log (0,01% a 100%+): a RF Baixa Duração fica perto de zero e Ações perto de 30%
    const lx = vs.map(lvol), lx0 = Math.floor(Math.min(...lx) * 2) / 2, lx1 = Math.max(Math.ceil(Math.max(...lx) * 2) / 2, lx0 + 1);
    const Xl = escala(lx0, lx1, m.e, W - m.d), X = (v) => Xl(lvol(v)), Y = escala(y0, y1, H - m.b, m.t);
    const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", class: "dispersao",
      "aria-label": `${cl}: ${pts.length} fundos; rentabilidade de ${pct(Math.min(...pts.map((p) => p.r)))} a ${pct(Math.max(...pts.map((p) => p.r)))}` });
    const my = marcas(y0, y1), mx = [0.01, 0.1, 1, 10, 100, 1000].filter((v) => Math.log10(v) >= lx0 - 1e-9 && Math.log10(v) <= lx1 + 1e-9);
    const casas = (lista2) => (lista2.length > 1 && lista2[1] - lista2[0] < 1 ? 1 : 0);
    for (const v of my) {
      svg.append(sv("line", { x1: m.e, x2: W - m.d, y1: Y(v), y2: Y(v), class: v === 0 ? "eixo-zero" : "grade" }));
      svg.append(sv("text", { x: m.e - 6, y: Y(v) + 4, "text-anchor": "end", class: "marca" }, pct(v, casas(my))));
    }
    for (const v of mx) {
      svg.append(sv("line", { x1: X(v), x2: X(v), y1: m.t, y2: H - m.b, class: "grade" }));
      svg.append(sv("text", { x: X(v), y: H - m.b + 16, "text-anchor": "middle", class: "marca" },
        (v === 0.01 ? "≤ " : "") + pct(v, v < 0.1 ? 2 : v < 1 ? 1 : 0)));
    }
    svg.append(sv("text", { x: (m.e + W - m.d) / 2, y: H - 4, "text-anchor": "middle", class: "titulo-eixo" }, (perVol(per) === per ? "Volatilidade anualizada" : "Volatilidade anualizada em 12 meses") + " (escala logarítmica)"));
    svg.append(sv("text", { x: 12, y: (m.t + H - m.b) / 2, "text-anchor": "middle", class: "titulo-eixo",
      transform: `rotate(-90 12 ${(m.t + H - m.b) / 2})` }, "Rentabilidade " + NOME_PER[per]));
    if (med != null) {
      svg.append(sv("line", { x1: m.e, x2: W - m.d, y1: Y(med), y2: Y(med), class: "mediana" }));
      svg.append(sv("text", { x: W - m.d - 4, y: Y(med) - 5, "text-anchor": "end", class: "rot-mediana" }, "mediana " + pct(med)));
    }
    const g = sv("g", { fill: CORES[cl], "fill-opacity": "0.45" });
    const gx = sv("g", { class: "outlier" });
    let destaque = null;
    pts.forEach((p, j) => {
      if (achado && p.f.c === achado.c) { destaque = j; return; }
      const c = sv("circle", { cx: X(p.v).toFixed(1), cy: Y(p.r).toFixed(1), r: 3.2, "data-j": j });
      (fora && fora.has(j) ? gx : g).append(c);
    });
    svg.append(g, gx);
    if (destaque != null) svg.append(sv("circle", { cx: X(pts[destaque].v), cy: Y(pts[destaque].r), r: 8, class: "achado", "data-j": destaque }));
    const alvoJ = (e) => { const j = e.target.getAttribute && e.target.getAttribute("data-j"); return j == null ? null : +j; };
    svg.addEventListener("mouseover", (e) => {
      const j = alvoJ(e); if (j == null) return;
      const f = pts[j].f, q = f.p[per];
      mostrarDica(e.target, f.n, [`Rentabilidade ${NOME_PER[per]}: ${pct(q[0])}`,
        `Volatilidade${perVol(per) === per ? "" : " em 12 meses"}: ${pct(pts[j].v)}`, `Drawdown ${NOME_PER[per]}: ${pct(q[5])}`,
        `Patrimônio: ${reais(q[2])}`, `Gestor: ${f.g || "—"}`, `CNPJ: ${f.c}`].concat(fora && fora.has(j) ? ["Valor extremo (outlier)"] : []));
    });
    svg.addEventListener("mouseout", esconder);
    svg.addEventListener("click", (e) => {
      const j = alvoJ(e); if (j == null) return;
      $("busca-fundo").value = `${pts[j].f.n} · ${pts[j].f.c}`; est.busca = pts[j].f; desenharRisco(lista);
    });
    return svg;
  }

  function tabelaOutliers(lista) {
    const per = est.periodo, tab = limpar($("tab-outliers"));
    tab.style.minWidth = "860px";
    tab.append(el("thead", {},
      el("tr", {}, el("th", { scope: "col", text: "" }), el("th", { class: "grupo-col", colspan: "4", scope: "colgroup", text: "Com todos os fundos" }),
        el("th", { class: "grupo-col", colspan: "4", scope: "colgroup", text: "Sem outliers" }), el("th", { scope: "col", text: "" })),
      el("tr", {}, ...["Classe", "Fundos", "Média", "Mediana", "Desvio padrão", "Fundos", "Média", "Mediana", "Desvio padrão", "Outliers"]
        .map((c, j) => el("th", { class: j ? "num" : "", scope: "col", text: c })))));
    const tb = el("tbody");
    const dp = (x) => (x == null ? "—" : nf(2).format(x) + " p.p.");
    for (const cl of CLASSES) {
      const todos = pontos(lista, cl, per), fora = outliers(todos), sem = todos.filter((_, j) => !fora.has(j));
      const a = resumoPts(todos), b = resumoPts(sem);
      tb.append(el("tr", { class: cl === est.classe ? "selecionada" : "" }, td(cl), tdNum(a.n, inteiro), tdNum(a.media, pct, "forte"),
        tdNum(a.mediana), tdNum(a.desvio, dp), tdNum(b.n, inteiro), tdNum(b.media, pct, "forte"), tdNum(b.mediana), tdNum(b.desvio, dp),
        td(a.n ? `${inteiro(fora.size)} (${pct((100 * fora.size) / a.n, 1)})` : "—", "num")));
    }
    tab.append(tb);
    $("nota-outliers").textContent = "Critério de outlier: " + METODO_OUTLIER +
      " Esta tabela considera só os fundos com rentabilidade e volatilidade no período.";
  }

  function fichaFundo(f) {
    const fi = limpar($("ficha-fundo"));
    fi.hidden = !f;
    if (!f) return;
    fi.append(el("div", {}, el("b", { text: f.n }), el("span", { class: "nota", text: ` · ${f.k}${f.a ? " (" + f.a + ")" : ""} · ${f.g || "gestor não informado"} · CNPJ ${f.c}` })));
    const tab = el("table", { class: "tabela compacta" });
    cabecalho(tab, ["", ...PERIODOS.map((p) => p[1])]);
    const tb = el("tbody");
    const lin = (rot, fn, fmt = pct) => tb.append(el("tr", {}, td(rot), ...PERIODOS.map(([p]) => tdNum(fn(p), fmt))));
    lin("Rentabilidade", (p) => (f.p[p] || [])[0]);
    lin("Mediana da classe", (p) => ((blocoDe(f.k, p).total) || {}).rent_mediana);
    lin(bench(f.k)[1], (p) => (ind(bench(f.k)[0]) || {})[p]);
    lin("Volatilidade", (p) => (f.p[p] || [])[1]);
    lin("Drawdown", (p) => (f.p[p] || [])[5]);
    lin("Captação líquida", (p) => (f.p[p] || [])[3], reais);
    tab.append(tb);
    fi.append(el("div", { class: "rolagem" }, tab));
    const pl = (f.p.MES || [])[2], cot = (f.p.MES || [])[4];
    fi.append(el("div", { class: "nota", text: `Patrimônio ${reais(pl)} · ${inteiro(cot)} cotistas · nome registrado: ${f.nc}` }));
  }

  // =====================================================================
  // INDICADORES (cartões no estilo do painel antigo: nome + minitabela por período)
  // =====================================================================
  function visaoIndicadores() {
    const per = est.periodo, lista = est.dados.indicadores.filter((i) => i[per] != null);
    $("ind-rotulo").textContent = "INDICADORES DE MERCADO · " + ROT_PER[per];
    if (lista.length) {
      const ord = [...lista].sort((a, b) => b[per] - a[per]), top = ord[0], fim = ord[ord.length - 1];
      $("ind-manchete").textContent = `${top.nome} lidera ${NOME_PER[per]} (${pct(top[per])}); ${fim.nome} fica na lanterna (${pct(fim[per])})`;
    } else $("ind-manchete").textContent = "Sem indicadores para o período.";
    const num = (x) => (x == null ? "—" : nf(2).format(x).replace("-", "−"));

    // quadro das classes do painel (média simples dos fundos), como no topo do painel antigo
    const tq = limpar($("tab-ind-classes"));
    tq.append(el("thead", {}, el("tr", {}, el("th", { scope: "col", text: "Classe (mediana dos fundos, %)" }),
      ...PERIODOS.map(([p, n]) => el("th", { class: "num" + (p === per ? " atual" : ""), scope: "col", text: n })))));
    const tbq = el("tbody");
    for (const cl of CLASSES)
      tbq.append(el("tr", {}, el("td", {}, el("span", { class: "ponto", style: `background:${CORES[cl]}` }), cl),
        ...PERIODOS.map(([p]) => tdNum((blocoDe(cl, p).total || {}).rent_mediana, num, p === per ? "atual" : ""))));
    tq.append(tbq);

    const alvo = limpar($("ind-grupos"));
    const nomesGrupos = est.dados.grupos_indicadores || [];
    const grupos = nomesGrupos.map((g) => [g, est.dados.indicadores.filter((i) => i.grupo === g)]);
    const outros = est.dados.indicadores.filter((i) => !nomesGrupos.includes(i.grupo));
    if (outros.length) grupos.push(["Outros", outros]);
    for (const [g, is] of grupos) {
      if (!is.length) continue;
      const sec = el("section", { class: "ind-grupo" }, el("h3", { class: "grupo-titulo", text: g }));
      const grade = el("div", { class: "ind-grade" });
      for (const i of is) {
        const t = el("table", { class: "mini-tab" });
        t.append(el("thead", {}, el("tr", {}, ...PERIODOS.map(([p, n]) => el("th", { scope: "col", class: p === per ? "atual" : "", text: n })))));
        t.append(el("tbody", {}, el("tr", {}, ...PERIODOS.map(([p]) => el("td", { class: (i[p] < 0 ? "neg " : "") + (p === per ? "atual" : ""), text: num(i[p]) })))));
        grade.append(el("div", { class: "ind-card" }, el("div", { class: "ind-nome", text: i.nome }), t,
          el("div", { class: "ind-fonte", text: i.fonte })));
      }
      sec.append(grade);
      alvo.append(sec);
    }
  }

  // =====================================================================
  // ETFs (seção própria: fora do universo, dos rankings e das medianas dos fundos)
  // =====================================================================
  const TIPO_ETF = { "Renda variável": "Renda variável", "Renda fixa": "Renda fixa", "Criptoativos": "Cripto", "Fundos imobiliários": "FII" };
  const EM_MOEDA = new Set(["sp500", "gld", "ncis"]);   // índice de referência na moeda própria; o ETF está em reais
  async function carregarEtfs() {
    const mes = est.dados.mes;
    if (!(mes in est.etfs)) {
      const r = await fetch(`dados/${mes}-etfs.json`, { cache: "no-cache" });
      est.etfs[mes] = r.ok ? await r.json() : null;
    }
    return est.etfs[mes];
  }
  const mediana = (v) => { const s = v.filter((x) => x != null).sort((a, b) => a - b); if (!s.length) return null;
    const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  async function visaoEtfs() {
    const per = est.periodo;
    $("etf-rotulo").textContent = "ETFs LISTADOS NA B3 · " + ROT_PER[per];
    const d = await carregarEtfs();
    if (est.visao !== "etfs") return;
    const grupos = limpar($("etf-grupos")), cards = limpar($("etf-cards"));
    limpar($("etf-mais")); limpar($("abas-etf"));
    if (!d) { $("etf-manchete").textContent = "Os ETFs ainda não foram calculados para este mês."; $("etf-nota").textContent = ""; return; }
    const todos = d.etfs, neg = todos.filter((x) => x.neg);
    const soma = (l, k) => l.reduce((s, x) => s + (x[k] || 0), 0);
    $("etf-manchete").textContent = `${inteiro(todos.length)} ETFs listados; ${inteiro(neg.length)} bem negociados no mês, com ${reais(soma(todos, "vm"))} negociados por pregão`;
    const card = (nome, valor, det) => el("div", { class: "card" }, el("div", { class: "nome", text: nome }), el("div", { class: "valor", text: valor }), el("div", { class: "det", text: det }));
    cards.append(card("ETFs listados", inteiro(todos.length), d.tipos.map((t) => `${TIPO_ETF[t]} ${todos.filter((x) => x.tipo === t).length}`).join(" · ")),
      card("Patrimônio", reais(soma(todos, "pl")), "soma do PL informado à CVM"),
      card("Negociação por pregão", reais(soma(todos, "vm")), "média do mês, todos os ETFs"),
      card("Bem negociados no mês", inteiro(neg.length), `negócios em ${pct(100 * (d.criterio.min_pregoes_mes || 0.8), 0)} dos pregões e média de ${reais(d.criterio.min_volume_medio || 1e5)}`));

    abas("abas-etf", d.tipos.map((t) => [t, `${TIPO_ETF[t]} (${todos.filter((x) => x.tipo === t).length})`]), est.etfTipo,
      (t) => { est.etfTipo = t; visaoEtfs(); });
    let escondidos = 0;
    for (const g of d.grupos.filter((x) => x.tipo === est.etfTipo)) {
      const l = todos.filter((x) => x.tipo === g.tipo && x.grupo === g.grupo);
      const bons = l.filter((x) => x.neg !== false && x.p[per] && x.p[per][0] != null);
      const sec = el("section", { class: "etf-grupo" }, el("h3", { text: g.grupo }));
      const ref = [];
      ref.push(`${inteiro(l.length)} ETFs, ${inteiro(bons.length)} bem negociados com retorno ${NOME_PER[per]}`);
      if (bons.length) ref.push(`mediana destes: ${pct(mediana(bons.map((x) => x.p[per][0])))}`);
      const linhaRef = el("div", { class: "etf-ref", text: ref.join(" · ") });
      const i = g.ref && ind(g.ref);
      if (i && i[per] != null) linhaRef.append(" · ", el("b", { text: `${i.nome}${EM_MOEDA.has(g.ref) ? " (em moeda própria)" : ""}: ${pct(i[per])}` }));
      const t = g.classe && (blocoDe(g.classe, per).total || {}).rent_mediana;
      if (t != null) linhaRef.append(" · ", el("b", { text: `mediana dos ${PLURAL[g.classe]}: ${pct(t)}` }));
      sec.append(linhaRef);
      const temR = (x) => (x.p[per] && x.p[per][0] != null ? 1 : 0);
      // neg: true = negociado, false = pouco negociado, null = cota patrimonial (liquidez de bolsa não medida)
      const nv = (x) => (x.neg === true ? 2 : x.neg === null ? 1 : 0);
      const vis = l.filter((x) => est.etfTodos || x.neg !== false).sort((a, b) => (nv(b) - nv(a)) || (temR(b) - temR(a)) || ((b.vm || 0) - (a.vm || 0)));
      escondidos += l.length - vis.length;
      if (vis.length) {
        const tab = el("table", { class: "tabela compacta" });
        cabecalho(tab, ["ETF", "Gestor", "Retorno", "Volatilidade", "Negociado por pregão", "Patrimônio"], 2);
        const tb = el("tbody");
        for (const x of vis) {
          const [r, v] = x.p[per] || [null, null];
          tb.append(el("tr", { class: x.neg === false ? "apagado" : "" },
            el("td", {}, el("span", { class: "tk", text: x.t }), " ", el("span", { text: x.n }),
              x.neg === false ? el("div", { class: "sub", text: `pouco negociado: negócios em ${inteiro(x.dn)} de ${inteiro(x.dp)} pregões` })
                : x.neg === null ? el("div", { class: "sub", text: "retorno pela cota patrimonial (Informe Diário)" }) : null),
            td(x.g || "—"), tdNum(r), tdNum(v), el("td", { class: "num", text: x.vm ? reais(x.vm) : "—" }), el("td", { class: "num", text: reais(x.pl) })));
        }
        tab.append(tb);
        sec.append(el("div", { class: "rolagem" }, tab));
      } else sec.append(el("div", { class: "nota", text: "Nenhum ETF bem negociado neste grupo no mês." }));
      grupos.append(sec);
    }
    if (escondidos || est.etfTodos) {
      const b = el("button", { type: "button", class: "botao-link",
        text: est.etfTodos ? "Mostrar só os bem negociados" : `Mostrar também os ${inteiro(escondidos)} pouco negociados` });
      b.onclick = () => { est.etfTodos = !est.etfTodos; visaoEtfs(); };
      $("etf-mais").append(b);
    }
    const cota = todos.some((x) => x.tipo === est.etfTipo && x.neg === null);
    $("etf-nota").textContent = "Retorno pelo preço de fechamento na bolsa (rendimentos distribuídos não entram). Volatilidade anualizada dos retornos diários. " +
      "Negociado por pregão: média do mês. Os ETFs não entram nos números dos fundos." +
      (cota ? " Os ETFs de renda fixa não estão nas séries históricas da B3: para eles o retorno é o da cota patrimonial, do Informe Diário entregue pelo administrador no Fundos.NET da B3, e a liquidez em bolsa não é medida." : "") +
      " Veja a nota metodológica.";
  }

  // ---------- rodapé do mês ----------
  function resumo() {
    const d = est.dados, u = d.universo;
    $("resumo-texto").textContent = `Data-base ${data(d.data_base)}. ${inteiro(u.n_fundos)} fundos no universo, com ${reais(u.pl)} de patrimônio e ${inteiro(u.cotistas)} posições de cotistas. Início dos períodos: mês ${data(d.d0.MES)}, ano ${data(d.d0.ANO)}, 12 meses ${data(d.d0["12M"])}, 36 meses ${data(d.d0["36M"])}.`;
    const dl = limpar($("downloads"));
    dl.append("Baixar os dados do mês (CSV): ");
    ["universo", "consolidados", "rankings", "indicadores"].concat(d.tem_etfs ? ["etfs"] : []).forEach((n, j) => {
      if (j) dl.append(" · ");
      dl.append(el("a", { href: `dados/${d.mes}/${n}.csv`, download: "", text: n }));
    });
    $("rodape-gerado").textContent = `Atualizado em ${d.gerado_em}`;
    // modo de teste (MVP): faixa fixa de "em desenvolvimento" no lugar do aviso de prévia
    $("faixa-teste").hidden = !d.modo_teste;
    $("aviso-previa").hidden = !d.previa || !!d.modo_teste;
  }

  // =====================================================================
  // DESTAQUE
  // =====================================================================
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro",
                 "novembro", "dezembro"];
  const nomeMes = (s) => { const [a, m] = s.split("-"); return `${MESES[+m - 1]} de ${a}`; };

  // texto de exemplo montado com os números do mês, usado enquanto os autores não enviam o destaque
  function destaqueExemplo() {
    const d = est.dados, gm = geral("MES"), ga = geral("ANO"), cdi = ind("cdi") || {}, ibov = ind("ibovespa") || {};
    const tot = (cl, p) => blocoDe(cl, p).total || {};
    const porRent = [...CLASSES].sort((a, b) => (tot(b, "ANO").rent_mediana ?? -1e9) - (tot(a, "ANO").rent_mediana ?? -1e9));
    const porCap = [...CLASSES].sort((a, b) => (tot(b, "MES").capliq ?? 0) - (tot(a, "MES").capliq ?? 0));
    const acimaRef = CLASSES.map((cl) => {
      const [bid, bnome] = bench(cl);
      const c = (blocoDe(cl, "ANO").comparacoes || {})[bid] || {}, a = (c.acima || {}).n_fundos || 0, n = a + ((c.abaixo || {}).n_fundos || 0);
      return `${cl} ${pct(n ? (100 * a) / n : null, 0)} (${bnome})`;
    });
    const im = d.indicadores.filter((i) => i.MES != null).sort((a, b) => b.MES - a.MES);
    const p = [
      `Em ${nomeMes(d.mes)}, os ${inteiro(gm.n_fundos)} fundos abertos às pessoas físicas acompanhados pelo painel somavam ${reais(gm.pl)} de patrimônio. ` +
      `A captação líquida foi de ${reais(gm.capliq)} no mês e de ${reais(ga.capliq)} no acumulado do ano.`,
      `No ano, o fundo típico (mediana) rendeu ${pct(ga.rent_mediana)} e o real aplicado nos fundos (média ponderada pelo patrimônio) ` +
      `${pct(ga.rent_ponderada)}, contra ${pct(cdi.ANO)} do CDI e ${pct(ibov.ANO)} do Ibovespa. ${porRent[0]} lidera entre as classes, ` +
      `com mediana de ${pct(tot(porRent[0], "ANO").rent_mediana)}; ${porRent[3]} tem a menor, ${pct(tot(porRent[3], "ANO").rent_mediana)}.`,
      `Parcela de fundos que igualou ou superou a referência da classe no ano: ${acimaRef.join("; ")}.`,
      `Na captação do mês, ${porCap[0]} recebeu mais recursos (${reais(tot(porCap[0], "MES").capliq)}), enquanto ` +
      `${porCap[3]} teve o pior saldo (${reais(tot(porCap[3], "MES").capliq)}).`,
    ];
    if (im.length) p.push(`Entre os indicadores de mercado, ${im[0].nome} teve a maior alta no mês (${pct(im[0].MES)}) e ` +
      `${im[im.length - 1].nome} o pior resultado (${pct(im[im.length - 1].MES)}).`);
    return { titulo: `Fundos para pessoas físicas: o que mudou em ${nomeMes(d.mes)}`, paragrafos: p };
  }

  function visaoDestaque() {
    const l = est.dados.leitura || {}, d = est.dados;
    const autores = (l.destaque || "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
    const ex = autores.length ? null : destaqueExemplo();
    $("destaque-titulo").textContent = autores.length ? (l.destaque_titulo || `A indústria de fundos em ${nomeMes(d.mes)}`) : ex.titulo;
    const t = limpar($("destaque-texto"));
    if (ex) t.append(el("div", { class: "selo-exemplo", text: "Texto de exemplo, montado automaticamente com os números do mês. " +
      "Neste espaço, como numa carta do gestor, um especialista em fundos traz sua análise do mês em texto e vídeo." }));
    for (const p of autores.length ? autores : ex.paragrafos) t.append(el("p", { text: p }));
    $("destaque-assinatura").textContent = autores.length ? (l.assinatura || "") : "";
    const v = $("destaque-video"), atual = v.dataset.video || "";
    if (atual !== (d.video_id || "-")) {
      limpar(v);
      v.dataset.video = d.video_id || "-";
      if (d.video_id) {
        // o YouTube (~1 MB) só é carregado quando a pessoa clica em assistir; domínio sem cookies de rastreamento
        const capa = el("button", { type: "button", class: "video-capa", "aria-label": "Assistir ao vídeo do especialista" },
          el("div", { class: "play", "aria-hidden": "true", text: "▶" }), el("div", { text: d.video_exemplo ? "Assistir ao vídeo (exemplo)" : "Assistir ao vídeo do especialista" }));
        capa.onclick = () => limpar(v).append(el("iframe", { src: `https://www.youtube-nocookie.com/embed/${d.video_id}?autoplay=1`,
          title: "Vídeo da palavra do especialista", allow: "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen",
          referrerpolicy: "strict-origin-when-cross-origin", allowfullscreen: "" }));
        v.append(capa);
      } else {
        v.append(el("div", { class: "video-vazio" }, el("div", { class: "play", "aria-hidden": "true", text: "▶" }),
          el("div", { text: "Espaço do vídeo do mês" })));
      }
    }
    $("destaque-video-nota").textContent = !d.video_id
      ? "O vídeo aparece aqui quando o link do YouTube é enviado no formulário da Leitura do mês."
      : d.video_exemplo ? "Vídeo de exemplo (versão de teste), só para mostrar como o vídeo roda nesta página."
      : "Vídeo do especialista (YouTube).";
  }

  function render() {
    esconder();
    botoes(); resumo();
    if (est.visao === "destaque") visaoDestaque();
    else if (est.visao === "geral") visaoGeral();
    else if (est.visao === "indicadores") visaoIndicadores();
    else if (est.visao === "classe") { rentabilidade(); ranking(); comparacao(); gestores(); subtipos(); }
    else if (est.visao === "risco") visaoRisco();
    else if (est.visao === "etfs") visaoEtfs().catch((e) => { $("etf-manchete").textContent = "Não foi possível carregar os ETFs: " + e.message; });
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
