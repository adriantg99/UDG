const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const code = fs.readFileSync(path.join(root, "assets/js/actividades.js"), "utf8");

function setup({ reduced = false, rejected = false, supported = true } = {}) {
  class Element {
    constructor() { this.events = {}; this.hidden = true; this.open = false; this.focused = false; }
    addEventListener(event, fn) { this.events[event] = fn; }
    fire(event, value = {}) { this.events[event]?.(value); }
    focus() { this.focused = true; }
    showModal() { this.open = true; }
    close() { this.open = false; this.fire("close"); }
    play() { this.played = true; return rejected ? Promise.reject(new Error("Blocked")) : Promise.resolve(); }
    pause() { this.paused = true; }
    getBoundingClientRect() { return { left: 10, top: 10, right: 100, bottom: 100 }; }
  }
  const html = fs.readFileSync(path.join(root, "actividades.html"), "utf8");
  const nodes = Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)]
    .map((match) => [match[1], new Element()]));
  const modal = nodes["actividad-modal"];
  const player = nodes["actividad-player"];
  const close = new Element();
  modal.querySelector = () => close;
  if (!supported) modal.showModal = undefined;
  const links = ["naranja_principal.mp4", "dia_naranja.mp4"].map((file) => {
    const link = new Element();
    link.href = `assets/videos/${file}`;
    link.dataset = { videoTitle: file };
    link.querySelector = () => ({ src: "poster.jpg" });
    return link;
  });
  const classes = new Set();
  const document = {
    getElementById: (id) => nodes[id],
    querySelectorAll: () => links,
    body: { classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) } }
  };
  vm.runInNewContext(code, { document, window: { matchMedia: () => ({ matches: reduced }) } });
  return { nodes, links, modal, player, close, classes };
}

async function main() {
  const app = setup();
  assert.ok(app.modal.open);
  assert.ok(app.player.src.endsWith("naranja_principal.mp4"));
  assert.equal(app.player.muted, true);
  assert.equal(app.player.played, true);
  app.player.fire("ended");
  assert.equal(app.modal.open, false);
  assert.equal(app.player.paused, true);
  assert.equal(app.classes.size, 0);
  assert.ok(app.links[0].focused);
  let prevented = false;
  app.links[1].fire("click", { preventDefault: () => { prevented = true; }, button: 0 });
  assert.ok(prevented && app.modal.open);
  assert.ok(app.player.src.endsWith("dia_naranja.mp4"));
  assert.equal(app.player.muted, false);
  app.player.fire("error");
  assert.equal(app.nodes["actividad-video-error"].hidden, false);
  app.close.fire("click");
  assert.equal(app.modal.open, false);
  assert.ok(app.links[1].focused);
  app.links[0].fire("click", { preventDefault() {}, button: 0 });
  app.modal.fire("click", { target: app.modal, clientX: 0, clientY: 0 });
  assert.equal(app.modal.open, false);
  const reduced = setup({ reduced: true });
  assert.ok(reduced.modal.open);
  assert.equal(reduced.player.played, undefined);
  const blocked = setup({ rejected: true });
  await Promise.resolve();
  assert.match(blocked.nodes["actividad-modal-note"].textContent, /Pulsa reproducir/);
  assert.equal(setup({ supported: false }).modal.open, false);
  const html = fs.readFileSync(path.join(root, "actividades.html"), "utf8");
  for (const match of html.matchAll(/(?:src|href|poster)="(assets\/[^"]+)"/g)) {
    assert.ok(fs.existsSync(path.join(root, match[1])), `Debe existir ${match[1]}`);
  }
  console.log("Correcto: apertura inicial, fin de video, cierre manual y exterior, reapertura, foco, movimiento reducido y recursos.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
