(() => {
  "use strict";

  const data = window.estadisticaDatos;
  if (!data) {
    document.getElementById("estadistica-error").hidden = false;
    return;
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function chart(parent, id, title, description, wide = false) {
    const article = element("article", "estadistica-chart"
      + (wide ? " estadistica-chart--wide" : ""));
    const heading = element("h5", "", title);
    heading.id = `${id}-title`;
    const container = element("div");
    container.id = id;
    container.setAttribute("aria-labelledby", heading.id);
    article.append(heading, element("p", "", description), container);
    parent.append(article);
    return container;
  }

  // Las cifras visibles y las etiquetas accesibles representan el mismo dato.
  function renderBars(container, groups, series) {
    container.replaceChildren();
    const maximum = Math.max(1, ...groups.flatMap((group) => group.values));
    const list = document.createElement("ul");
    list.className = "estadistica-bars";

    groups.forEach((group) => {
      const row = document.createElement("li");
      const label = document.createElement("p");
      label.className = "estadistica-bar-label";
      label.textContent = group.label;
      row.append(label);

      group.values.forEach((value, index) => {
        const bar = document.createElement("div");
        bar.className = "estadistica-bar-series";
        bar.setAttribute("role", "img");
        bar.setAttribute("aria-label", `${group.label}, ${series[index]}: ${value}`);

        const track = document.createElement("div");
        track.className = "estadistica-bar-track";
        track.setAttribute("aria-hidden", "true");
        const fill = document.createElement("div");
        fill.className = "estadistica-bar-fill"
          + (index === 1 ? " estadistica-bar-fill--secondary" : "");
        fill.style.width = `${value / maximum * 100}%`;
        track.append(fill);

        const count = document.createElement("span");
        count.className = "estadistica-bar-value";
        count.textContent = value;
        count.setAttribute("aria-hidden", "true");
        bar.append(track, count);
        row.append(bar);
      });
      list.append(row);
    });

    const scale = document.createElement("div");
    scale.className = "estadistica-scale";
    scale.setAttribute("aria-hidden", "true");
    const zero = document.createElement("span");
    zero.textContent = "0";
    const max = document.createElement("span");
    max.textContent = `${maximum} registros`;
    scale.append(zero, max);
    container.append(list, scale);
  }

  function renderSingle(container, values, unit) {
    renderBars(container, values.map(({ label, value }) => ({
      label, values: [value]
    })), [unit]);
  }

  function renderSource(key, source) {
    const section = element("section", "estadistica-report");
    const heading = element("h4", "estadistica-report-title",
      key === "ttug" ? "Reporte PSVG TTUG · 2020–2026" : "Reporte PSVG · 2020–2025");
    heading.id = `reporte-${key}-title`;
    section.setAttribute("aria-labelledby", heading.id);
    section.append(heading, element("p", "estadistica-source", `Fuente: ${source.name}`));
    const summary = element("div", "estadistica-summary");
    [
      ["expedientes", "Expedientes", source.cases, "Cada expediente se cuenta una vez"],
      ["registros", "Registros", source.records, "Iniciales y cumplimentadoras"],
      ["cumplimentadoras", "Cumplimentadoras", source.compliance, "Registros adicionales del expediente"],
      ["sentencias", "Con fecha de sentencia", source.dated, "Fecha disponible en el reporte"]
    ].forEach(([id, label, value, description]) => {
      const metric = element("div", "estadistica-metric");
      const count = element("strong", "", value);
      count.id = `${key}-total-${id}`;
      metric.append(element("span", "", label), count, element("small", "", description));
      summary.append(metric);
    });
    const charts = element("div", "estadistica-charts");
    const byYear = chart(charts, `${key}-grafica-expedientes`,
      "Registros por año del expediente",
      "Registros iniciales y cumplimentadoras según el año de la clave.");
    const legend = element("ul", "estadistica-legend");
    legend.setAttribute("aria-label", "Series");
    ["Iniciales", "Cumplimentadoras"].forEach((label, index) => {
      const item = element("li");
      const dot = element("span", "legend-dot" + (index ? " legend-dot--secondary" : ""));
      dot.setAttribute("aria-hidden", "true");
      item.append(dot, element("span", "", label));
      legend.append(item);
    });
    byYear.append(legend);
    const barsByYear = element("div");
    byYear.append(barsByYear);

    const initial = new Map(source.initialByYear.map((item) => [item.label, item.value]));
    const compliance = new Map(source.complianceByYear.map((item) => [item.label, item.value]));
    const years = [...new Set([...initial.keys(), ...compliance.keys()])].sort();
    renderBars(barsByYear, years.map((year) => ({
      label: year,
      values: [initial.get(year) || 0, compliance.get(year) || 0]
    })), ["Iniciales", "Cumplimentadoras"]);
    renderSingle(chart(charts, `${key}-grafica-sentencias`,
      "Sentencias por año de resolución",
      "Registros con fecha de sentencia, incluidas las cumplimentadoras."),
    source.sentencesByYear, "Con fecha de sentencia");
    renderSingle(chart(charts, `${key}-grafica-sentidos`,
      "Sentido de las resoluciones",
      "Categorías del reporte, incluidos los registros pendientes o sin información.", true),
    source.outcomes, "Registros");
    section.append(summary, charts);
    document.getElementById("reportes-estadisticos").append(section);
  }

  function renderDetail(period) {
    const detail = data.details[period];
    const section = element("section", "estadistica-report");
    const heading = element("h4", "estadistica-report-title", `Periodo ${period}`);
    heading.id = `periodo-${period}-title`;
    section.setAttribute("aria-labelledby", heading.id);
    section.append(heading, element("p", "estadistica-source",
      `${detail.records} registros consultados`
      + (detail.missingBehaviors
        ? ` · ${detail.missingBehaviors} con el campo de conducta sin información.`
        : ".")));
    const charts = element("div", "estadistica-charts");
    renderSingle(chart(charts, `${period}-grafica-calidad`, "Perfil de las denunciantes",
      "Según la categoría del reporte. “Sin dato” indica un campo sin información."),
    detail.qualities, "Registros");
    renderSingle(chart(charts, `${period}-grafica-conductas`, "Conductas mencionadas",
      "Un registro puede incluir varias menciones; estas no implican que la conducta haya sido acreditada."),
    detail.behaviors, "Registros que mencionan esta conducta");
    section.append(charts);
    document.getElementById("periodos-estadisticos").append(section);
  }

  Object.entries(data.sources).forEach(([key, source]) => renderSource(key, source));
  ["2025", "2026"].forEach(renderDetail);
})();
