const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "estadistica.html"), "utf8");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "Los identificadores deben ser únicos");

class Element {
  constructor() {
    this.children = [];
    this.style = {};
    this.attributes = {};
    this.listeners = {};
    this.textContent = "";
    this.hidden = true;
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
}

const nodes = Object.fromEntries(ids.map((id) => [id, new Element()]));
assert.ok(!/<select\b/i.test(html), "Los reportes deben verse sin selectores");
function findNode(id, elements = Object.values(nodes)) {
  for (const node of elements) {
    if (node.id === id) return node;
    const found = findNode(id, node.children);
    if (found) return found;
  }
}
const document = {
  createElement: () => new Element(),
  getElementById: (id) => {
    assert.ok(nodes[id], `El elemento ${id} debe existir en el HTML`);
    return nodes[id];
  }
};
const context = vm.createContext({ window: {}, document });
for (const file of ["estadistica-datos.js", "estadistica.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, "assets/js", file), "utf8"), context);
}
const data = context.window.estadisticaDatos;
assert.equal(nodes["reportes-estadisticos"].children.length, 2);
assert.equal(nodes["periodos-estadisticos"].children.length, 2);
const sum = (items) => items.reduce((total, item) => total + item.value, 0);
assert.equal(data.sources.ttug.records, 45);
assert.equal(data.sources.ttug.cases, 34);
assert.equal(data.sources.psvg.records, 40);
assert.equal(data.sources.psvg.cases, 29);

for (const [key, source] of Object.entries(data.sources)) {
  assert.equal(sum(source.outcomes), source.records);
  assert.equal(sum(source.initialByYear), source.cases);
  assert.equal(sum(source.complianceByYear), source.compliance);
  assert.equal(source.cases + source.compliance, source.records);
  assert.equal(sum(source.sentencesByYear), source.dated);
  assert.equal(findNode(`${key}-total-expedientes`).textContent, source.cases);
  assert.equal(findNode(`${key}-total-registros`).textContent, source.records);
  assert.equal(findNode(`${key}-grafica-sentidos`).children[0].children.length, source.outcomes.length);
}

for (const [period, detail] of Object.entries(data.details)) {
  assert.equal(sum(detail.qualities), detail.records);
  assert.ok(detail.behaviors.every((item) => item.value <= detail.records - detail.missingBehaviors));
  if (period !== "todos") {
    assert.equal(findNode(`${period}-grafica-conductas`).children[0].children.length, detail.behaviors.length);
    assert.equal(findNode(`${period}-grafica-calidad`).children[0].children.length, detail.qualities.length);
  }
}
assert.equal(data.details.todos.records, data.details["2025"].records + data.details["2026"].records);
assert.equal(data.details.todos.missingBehaviors, 2);
assert.equal(data.details.todos.behaviors.find((item) => item.label === "Psicológica").value, 9);
assert.equal(data.details.todos.behaviors.find((item) => item.label === "Digital").value, 7);

function checkBars(element) {
  if (element.style.width) {
    const width = parseFloat(element.style.width);
    assert.ok(Number.isFinite(width) && width >= 0 && width <= 100);
  }
  element.children.forEach(checkBars);
}
Object.values(nodes).forEach(checkBars);
assert.equal(nodes["estadistica-error"].hidden, true);

vm.runInNewContext(fs.readFileSync(path.join(root, "assets/js/estadistica.js"), "utf8"),
  { window: {}, document });
assert.equal(nodes["estadistica-error"].hidden, false, "Mostrar aviso si faltan datos");

for (const match of html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)) {
  assert.ok(fs.existsSync(path.join(root, match[1])), `Debe existir ${match[1]}`);
}
console.log("Correcto: cifras conciliadas, ambos reportes y periodos visibles sin selectores, barras y recursos.");
