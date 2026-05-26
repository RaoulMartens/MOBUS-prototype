const tokens = [
  { id: "seed-001", text: "Slijm telefoon", position: { x: 1113, y: 584 } },
  { id: "seed-002", text: "Quatro Telefoon", position: { x: 1227, y: 253 } },
  { id: "seed-003", text: "Digitale Pizzasnijder", position: { x: 1112, y: 284 } },
  { id: "seed-004", text: "Messi", position: { x: 1043, y: 691 } },
  { id: "seed-005", text: "Ronaldo", position: { x: 633, y: 382 } },
  { id: "seed-006", text: "Neymar", position: { x: 743, y: 333 } },
  { id: "seed-007", text: "Voetbal", position: { x: 728, y: 450 } },
  { id: "seed-008", text: "Teckel", position: { x: 335, y: 593 } },
  { id: "seed-009", text: "Michiel Kramer", position: { x: 291, y: 477 } }
];

const SNAP_DISTANCE = 140;
const dist = (a, b) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);

const adj = {};
tokens.forEach(t => { adj[t.id] = []; });

for (let i = 0; i < tokens.length; i++) {
  for (let j = i + 1; j < tokens.length; j++) {
    const d = dist(tokens[i].position, tokens[j].position);
    if (d < SNAP_DISTANCE) {
      adj[tokens[i].id].push(tokens[j].id);
      adj[tokens[j].id].push(tokens[i].id);
      console.log(`Connected: ${tokens[i].text} and ${tokens[j].text} (distance: ${d.toFixed(1)})`);
    }
  }
}

const visited = new Set();
const components = [];

tokens.forEach(t => {
  if (visited.has(t.id)) return;
  const comp = [];
  const queue = [t.id];
  visited.add(t.id);
  while (queue.length > 0) {
    const cid = queue.shift();
    const tk = tokens.find(x => x.id === cid);
    if (tk) comp.push(tk);
    adj[cid].forEach(nid => {
      if (!visited.has(nid)) { visited.add(nid); queue.push(nid); }
    });
  }
  if (comp.length >= 2) components.push(comp);
});

console.log(`\nDetected ${components.length} components:`);
components.forEach((comp, idx) => {
  console.log(`Component ${idx + 1}: ${comp.map(t => t.text).join(", ")}`);
});
