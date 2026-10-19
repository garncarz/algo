import { CHALLENGES, LinkedListModel, validateChallenge, variableName } from "./linked_list_model.mjs";

const $ = selector => document.querySelector(selector);
const ui = {
  title: $("#challenge-title"), subtitle: $("#challenge-subtitle"), instruction: $("#challenge-instruction"), number: $("#challenge-number"),
  level: $("#level-label"), progress: $("#progress-dots"), status: $("#status"), stage: $("#list-stage"), reverseTrack: $("#reverse-track"),
  actions: $("#action-controls"), picker: $("#target-picker"),
  selection: $("#selection-summary"), structure: $("#structure-summary"), structureNote: $(".structure-note"),
  code: $("#java-code"), codeStep: $("#code-step"),
  history: $("#history-list"), historyCount: $("#history-count"), moves: $("#move-count"), undo: $("#undo-button"),
  allocated: $("#allocated-count"), reachable: $("#reachable-count"), disconnected: $("#disconnected-count"),
  hint: $("#hint-button"), hintCount: $("#hint-count"),
  success: $("#success-banner"), successExplanation: $("#success-explanation"), next: $("#next-challenge"),
};

let challengeIndex = 0;
let model;
let selectedId = null;
let pickerMode = null;
let selectedConnectionId = null;
let nodePositions = new Map();
let history = [];
let undoStack = [];
let hintIndex = 0;
let reverseState = null;
let lastChangedId = null;
let completedChallenges = new Set();
let isComplete = false;
let draggedLink = null;
let draggedNode = null;
let suppressPortClickUntil = 0;
let suppressNodeClickUntil = 0;

function challenge() { return CHALLENGES[challengeIndex]; }

function initializeChallenge(index = challengeIndex) {
  challengeIndex = Math.max(0, Math.min(index, CHALLENGES.length - 1));
  const current = challenge();
  model = new LinkedListModel(current.initial);
  nodePositions = new Map();
  [...model.nodes.values()].forEach((node, index) => nodePositions.set(node.id, defaultNodePosition(index)));
  selectedId = null;
  pickerMode = null;
  selectedConnectionId = null;
  history = [];
  undoStack = [];
  hintIndex = 0;
  lastChangedId = null;
  isComplete = false;
  reverseState = current.id === "reverse" ? { previousId: null, currentId: model.head?.id ?? null, steps: 0 } : null;
  ui.success.hidden = true;
  ui.number.textContent = String(challengeIndex + 1).padStart(2, "0");
  ui.title.textContent = current.title;
  ui.subtitle.textContent = current.subtitle;
  ui.instruction.textContent = current.instruction;
  ui.level.textContent = `TASK ${challengeIndex + 1} / ${CHALLENGES.length}`;
  ui.hintCount.textContent = `1/${current.hints.length}`;
  ui.hint.disabled = false;
  ui.status.className = "status";
  ui.status.textContent = "Tap a blue next pocket to move an arrow. Tap head to choose the first node.";
  ui.codeStep.textContent = "READY";
  render();
}

function captureState() {
  return {
    model: model.snapshot(), selectedId, historyLength: history.length,
    reverseState: reverseState ? { ...reverseState } : null, lastChangedId, selectedConnectionId,
    nodePositions: [...nodePositions].map(([id, point]) => [id, { ...point }]),
    nodePositions: [...nodePositions].map(([id, point]) => [id, { ...point }]),
  };
}

function transact(label, statement, explanation, mutation, changedId = null) {
  const before = captureState();
  try {
    mutation();
  } catch (error) {
    setStatus(error.message, "error");
    return false;
  }
  undoStack.push(before);
  history.push({ label, statement, explanation });
  lastChangedId = changedId;
  selectedId = changedId ?? selectedId;
  selectedConnectionId = null;
  pickerMode = null;
  evaluateAndRender(explanation);
  return true;
}

function evaluateAndRender(explanation = "") {
  const result = validateChallenge(model, challenge());
  if (result.ok) {
    completeChallenge();
  } else if (result.reason === "cycle") {
    setStatus(`${result.message} Undo or change one of the references to repair it.`, "error");
  } else if (explanation) {
    setStatus(explanation, "");
  } else if (result.reason === "unreachable") {
    setStatus(result.message, "error");
  } else if (model.unreachableNodes().length) {
    setStatus("Some allocated nodes are disconnected from head. They still exist; reconnect a reference, undo, or restart.", "");
  } else {
    setStatus("Reference updated. Compare the chain from head with the objective.", "");
  }
  render();
}

function completeChallenge() {
  isComplete = true;
  completedChallenges.add(challenge().id);
  ui.status.className = "status success";
  ui.status.textContent = "Structure verified. The list matches the challenge goal.";
  ui.successExplanation.textContent = challenge().success;
  ui.success.hidden = false;
}

function setStatus(message, kind = "") {
  ui.status.className = `status${kind ? ` ${kind}` : ""}`;
  ui.status.textContent = message;
}

function render() {
  renderProgress();
  renderControls();
  renderStage();
  renderMemory();
  renderHistoryAndCode();
  renderReverseTrack();
  ui.moves.textContent = String(history.length);
  ui.undo.disabled = undoStack.length === 0;
}

function renderProgress() {
  const level = challenge().level;
  ui.progress.replaceChildren();
  for (let number = 1; number <= CHALLENGES.length; number += 1) {
    const dot = document.createElement("button");
    dot.type = "button";
    const taskIndex = number - 1;
    const task = CHALLENGES[taskIndex];
    dot.className = `progress-dot${taskIndex === challengeIndex ? " active" : ""}${completedChallenges.has(task.id) ? " done" : ""}`;
    dot.textContent = String(number);
    dot.setAttribute("aria-label", `Choose task ${number}${dot.classList.contains("done") ? ", complete" : ""}`);
    dot.setAttribute("aria-pressed", String(taskIndex === challengeIndex));
    dot.title = `Go to task ${number}: ${task.title}`;
    dot.addEventListener("click", () => {
      initializeChallenge(taskIndex);
    });
    ui.progress.append(dot);
  }
}

function makeButton(text, action, className = "action-button", extra = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.dataset.action = action;
  for (const [key, value] of Object.entries(extra)) button.setAttribute(key, value);
  return button;
}

function renderControls() {
  const current = challenge();
  ui.actions.replaceChildren();
  ui.picker.hidden = true;
  ui.picker.replaceChildren();
  if (current.actions.includes("create")) {
    ui.actions.append(makeButton("＋ Add a node", "create", "action-button primary"));
    if (pickerMode?.type === "create") {
      const neededValues = current.targetValues.filter(value => ![...model.nodes.values()].some(node => node.value === value));
      for (const value of neededValues) {
        const option = makeButton(String(value), "create-value", "value-choice");
        option.dataset.value = String(value);
        ui.actions.append(option);
      }
    }
  }
  if (selectedConnectionId) {
    const source = model.getNode(selectedConnectionId);
    if (source) ui.actions.append(makeButton(`Disconnect ${source.value}.next`, "disconnect", "action-button danger"));
  }
  if (current.actions.includes("reverse-step") && reverseState) {
    ui.actions.append(makeButton("Flip the next arrow", "reverse-step", "action-button primary"));
  }
  if (pickerMode && pickerMode.type !== "create") renderTargetPicker();
  if (!selectedId && !pickerMode && !current.guided) ui.selection.textContent = "Tap a blue next pocket, then tap where its arrow should go.";
  else if (pickerMode?.type === "next") ui.selection.textContent = `Moving node ${model.getNode(pickerMode.sourceId)?.value ?? "?"}.next. Tap a node or null.`;
  else if (pickerMode?.type === "head") ui.selection.textContent = "Moving head. Tap the first node or null.";
  else if (pickerMode?.type === "create") ui.selection.textContent = "Choose a number for your new node.";
  else if (selectedId) {
    const node = model.getNode(selectedId);
    if (node) ui.selection.textContent = `Node ${node.value} is picked up. Its next arrow points to ${node.next ? node.next.value : "null"}.`;
  } else if (current.guided) ui.selection.textContent = "Follow the highlighted current reference, one link at a time.";
}

function renderTargetPicker() {
  ui.picker.hidden = false;
  const label = document.createElement("p");
  label.className = "picker-label";
  label.textContent = "Choose where the arrow should point:";
  const nullButton = makeButton("null", "target-null", "target-option");
  ui.picker.replaceChildren(label, nullButton);
}

function defaultNodePosition(index) {
  return { x: 105 + (index % 3) * 178, y: 28 + Math.floor(index / 3) * 155 };
}

function renderStage() {
  const inspected = model.inspect();
  const anyCycle = model.findCycle();
  const allNodes = [...model.nodes.values()];
  const reachableIds = new Set(inspected.nodes.map(node => node.id));
  const disconnectedNodes = allNodes.filter(node => !reachableIds.has(node.id));
  allNodes.forEach((node, index) => {
    if (!nodePositions.has(node.id)) nodePositions.set(node.id, defaultNodePosition(index));
  });
  for (const id of nodePositions.keys()) if (!model.nodes.has(id)) nodePositions.delete(id);
  const positions = nodePositions;
  const width = Math.max(630, ...[...positions.values()].map(point => point.x + 240));
  const height = Math.max(285, ...[...positions.values()].map(point => point.y + 145));
  const inner = document.createElement("div");
  inner.className = "stage-inner";
  inner.style.width = `${width}px`;
  inner.style.minHeight = `${height}px`;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "reference-layer");
  svg.setAttribute("aria-label", "Selectable next connections");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.cssText = `position:absolute;inset:0;z-index:1;pointer-events:auto;overflow:visible`;
  const defs = document.createElementNS(svg.namespaceURI, "defs");
  const marker = document.createElementNS(svg.namespaceURI, "marker");
  marker.id = "arrowhead";
  marker.setAttribute("markerWidth", "8"); marker.setAttribute("markerHeight", "8");
  marker.setAttribute("refX", "7"); marker.setAttribute("refY", "4"); marker.setAttribute("orient", "auto");
  const tip = document.createElementNS(svg.namespaceURI, "path");
  tip.setAttribute("d", "M0,0 L8,4 L0,8 Z"); tip.setAttribute("fill", "context-stroke");
  marker.append(tip); defs.append(marker); svg.append(defs);
  for (const node of allNodes) {
    const from = positions.get(node.id);
    const startX = from.x + 104;
    const startY = from.y + 36;
    if (node.next && positions.has(node.next.id)) {
      const to = positions.get(node.next.id);
      const path = createReferencePath(svg, node, startX, startY, to.x, to.y + 36, node.next.id);
      svg.append(path.visible, path.hit);
    } else {
      const nullX = from.x + 145;
      const path = createReferencePath(svg, node, startX, startY, nullX, startY, "null");
      svg.append(path.visible, path.hit);
      const nullLabel = document.createElement("button");
      nullLabel.type = "button";
      nullLabel.className = `null-target${selectedConnectionId === node.id ? " selected" : ""}`;
      nullLabel.textContent = "null";
      nullLabel.dataset.nullSource = node.id;
      nullLabel.style.left = `${nullX + 5}px`; nullLabel.style.top = `${from.y + 25}px`;
      nullLabel.setAttribute("aria-label", `Null endpoint for node ${node.value}'s next reference`);
      nullLabel.addEventListener("click", () => {
        if (pickerMode?.type === "next") chooseTarget("null");
        else selectConnection(node.id);
      });
      inner.append(nullLabel);
    }
  }
  if (model.head) {
    const point = positions.get(model.head.id);
    const headLeft = Math.max(12, point.x - 86);
    const headEdge = document.createElementNS(svg.namespaceURI, "path");
    headEdge.setAttribute("class", "head-edge");
    headEdge.setAttribute("d", `M ${headLeft + 40} ${point.y + 36} L ${point.x - 7} ${point.y + 36}`);
    headEdge.setAttribute("marker-end", "url(#arrowhead)");
    headEdge.dataset.headReference = model.head.id;
    svg.append(headEdge);
  }
  inner.append(svg);
  if (!allNodes.length) {
    const empty = document.createElement("div"); empty.className = "empty-state"; empty.textContent = "Let’s add your first node!"; inner.append(empty);
  }
  const headLabel = document.createElement("button");
  headLabel.type = "button"; headLabel.className = "head-link"; headLabel.textContent = "head";
  headLabel.setAttribute("aria-label", `Head refers to ${model.head ? `node ${model.head.value}` : "null"}`);
  const headPosition = model.head ? positions.get(model.head.id) : null;
  headLabel.style.cssText = `position:absolute;left:${headPosition ? Math.max(12, headPosition.x - 86) : 12}px;top:${(headPosition?.y ?? 28) + 27}px;z-index:5`;
  headLabel.addEventListener("pointerdown", event => startHeadDrag(event, headLabel));
  headLabel.addEventListener("click", () => {
    if (Date.now() < suppressPortClickUntil) return;
    selectedConnectionId = null;
    if (pickerMode?.type === "head") { pickerMode = null; setStatus("Head move cancelled."); }
    else { selectedId = null; pickerMode = { type: "head" }; setStatus("Head is picked up. Tap the node that should be first, or choose null below."); }
    render();
  });
  inner.append(headLabel);
  for (const node of allNodes) {
    const point = positions.get(node.id);
    const unit = document.createElement("div");
    unit.className = `node-unit${!reachableIds.has(node.id) ? " disconnected" : ""}`;
    unit.dataset.nodeUnit = node.id;
    unit.style.cssText = `position:absolute;left:${point.x}px;top:${point.y}px;width:120px;height:125px;z-index:2`;
    const card = document.createElement("button");
    card.type = "button";
    card.className = `node-card${selectedId === node.id ? " selected" : ""}${lastChangedId === node.id ? " recent" : ""}`;
    card.dataset.nodeId = node.id;
    card.setAttribute("aria-label", `Node ${node.value}${model.head === node ? ", head points here" : ""}. Next points to ${node.next ? `node ${node.next.value}` : "null"}. Select node.`);
    card.style.cssText = "position:absolute;left:0;top:0";
    card.addEventListener("pointerdown", event => startNodeDrag(event, card, node));
    const valueLabel = document.createElement("span"); valueLabel.className = "node-value-label"; valueLabel.textContent = "value";
    const value = document.createElement("span"); value.className = "node-value"; value.textContent = String(node.value);
    card.append(valueLabel, value);
    card.addEventListener("click", () => {
      if (Date.now() < suppressNodeClickUntil) return;
      if (pickerMode?.type === "next" || pickerMode?.type === "head") { chooseTarget(node.id); return; }
      selectedId = node.id; selectedConnectionId = null; pickerMode = null; render();
      setStatus(`Node ${node.value} picked up. Tap its next pocket to move that arrow.`);
    });
    unit.append(card);
    const port = document.createElement("button");
    port.type = "button"; port.className = "next-port"; port.textContent = "next";
    port.dataset.sourceId = node.id;
    port.setAttribute("aria-label", `Pick up node ${node.value}'s next arrow, currently pointing to ${node.next ? node.next.value : "null"}`);
    port.addEventListener("pointerdown", event => startLinkDrag(event, port, node));
    port.addEventListener("click", () => {
      if (Date.now() < suppressPortClickUntil) return;
      selectedId = node.id;
      selectedConnectionId = null;
      pickerMode = pickerMode?.type === "next" && pickerMode.sourceId === node.id ? null : { type: "next", sourceId: node.id };
      render();
      setStatus(pickerMode ? `Node ${node.value}'s next arrow is picked up. Tap its new destination, or null.` : `Node ${node.value}'s arrow move cancelled.`);
    });
    unit.append(port);
    if (!reachableIds.has(node.id)) {
      const disconnected = document.createElement("span"); disconnected.className = "disconnected-label"; disconnected.textContent = "NOT REACHABLE FROM HEAD"; unit.append(disconnected);
    }
    inner.append(unit);
  }
  ui.stage.replaceChildren(inner);
  ui.structure.textContent = anyCycle ? "cycle detected" : `${inspected.nodes.length} reachable · ${disconnectedNodes.length} disconnected`;
  ui.structureNote.classList.toggle("broken", Boolean(anyCycle) || disconnectedNodes.length > 0);
  ui.stage.setAttribute("aria-label", anyCycle ? "Linked list visualization; cycle detected" : `${inspected.nodes.length} nodes reachable from head, ${disconnectedNodes.length} disconnected nodes`);
}

function createReferencePath(svg, source, startX, startY, endX, endY, targetId) {
  const pathData = targetId === "null"
    ? `M ${startX} ${startY} L ${endX} ${endY}`
    : referencePath(startX, startY, endX, endY);
  const visible = document.createElementNS(svg.namespaceURI, "path");
  visible.setAttribute("class", `reference-edge${selectedConnectionId === source.id ? " selected" : ""}${source.id === lastChangedId ? " changed" : ""}`);
  visible.setAttribute("d", pathData);
  visible.setAttribute("marker-end", "url(#arrowhead)");
  visible.dataset.edgeSource = source.id;
  visible.dataset.edgeTarget = targetId;
  const hit = document.createElementNS(svg.namespaceURI, "path");
  hit.setAttribute("class", "reference-edge-hit");
  hit.setAttribute("d", pathData);
  hit.dataset.edgeSource = source.id;
  hit.dataset.edgeTarget = targetId;
  hit.setAttribute("role", "button");
  hit.setAttribute("tabindex", "0");
  hit.setAttribute("aria-label", `Select connection from node ${source.value}.next to ${targetId === "null" ? "null" : `node ${model.getNode(targetId)?.value}`}`);
  hit.addEventListener("click", () => selectConnection(source.id));
  hit.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectConnection(source.id); }
  });
  return { visible, hit };
}

function referencePath(startX, startY, endX, endY) {
  if (Math.abs(endY - startY) < 2) {
    const direction = endX >= startX ? -1 : 1;
    const bend = direction * Math.min(12, Math.abs(endX - startX) * 0.08);
    const distance = endX - startX;
    return `M ${startX} ${startY} C ${startX + distance * 0.34} ${startY + bend}, ${startX + distance * 0.72} ${endY + bend}, ${endX - 6} ${endY}`;
  }
  const bend = endY >= startY ? 58 : -58;
  return `M ${startX} ${startY} C ${startX + 42} ${startY + bend}, ${endX - 42} ${endY + bend}, ${endX - 6} ${endY}`;
}

function dragPath(startX, startY, endX, endY) {
  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.max(1, Math.hypot(dx, dy));
  const bend = Math.min(14, length * 0.06);
  const controlX = (startX + endX) / 2 - (dy / length) * bend;
  const controlY = (startY + endY) / 2 + (dx / length) * bend;
  return `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`;
}

function randomNodePosition() {
  const boardWidth = Math.max(630, ui.stage.clientWidth);
  const boardHeight = Math.max(285, ui.stage.clientHeight);
  const maxX = Math.max(28, boardWidth - 155);
  const maxY = Math.max(24, boardHeight - 130);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const point = {
      x: 24 + Math.random() * Math.max(1, maxX - 24),
      y: 18 + Math.random() * Math.max(1, maxY - 18),
    };
    const overlaps = [...nodePositions.values()].some(existing => Math.abs(point.x - existing.x) < 132 && Math.abs(point.y - existing.y) < 92);
    if (!overlaps) return point;
  }
  return { x: Math.max(24, ...[...nodePositions.values()].map(point => point.x + 160)), y: 24 };
}

function startNodeDrag(event, card, node) {
  if (event.button !== 0 || pickerMode?.type === "next" || pickerMode?.type === "head") return;
  const unit = card.closest("[data-node-unit]");
  const inner = card.closest(".stage-inner");
  if (!unit || !inner) return;
  const point = nodePositions.get(node.id);
  draggedNode = {
    id: node.id, value: node.value, unit, inner, pointerId: event.pointerId,
    offsetX: event.clientX - unit.getBoundingClientRect().left,
    offsetY: event.clientY - unit.getBoundingClientRect().top,
    startX: point.x, startY: point.y, moved: false,
  };
  card.setPointerCapture(event.pointerId);
  selectedId = node.id;
  selectedConnectionId = null;
}

function updateReferenceGeometry(inner) {
  const svg = inner.querySelector(".reference-layer");
  const coordinates = [...nodePositions.values()];
  const width = Math.max(630, ...coordinates.map(point => point.x + 240));
  const height = Math.max(285, ...coordinates.map(point => point.y + 145));
  inner.style.width = `${width}px`;
  inner.style.minHeight = `${height}px`;
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  for (const path of svg.querySelectorAll("[data-edge-source]")) {
    const source = model.getNode(path.dataset.edgeSource);
    const from = source && nodePositions.get(source.id);
    if (!source || !from) continue;
    const to = path.dataset.edgeTarget === "null" ? null : nodePositions.get(path.dataset.edgeTarget);
    const startX = from.x + 104;
    const startY = from.y + 36;
    const endX = to ? to.x : startX + 34;
    const endY = to ? to.y + 36 : startY;
    path.setAttribute("d", referencePath(startX, startY, endX, endY));
  }
  const headEdge = svg.querySelector("[data-head-reference]");
  const headPosition = model.head && nodePositions.get(model.head.id);
  if (headEdge && headPosition) {
    const headLeft = Math.max(12, headPosition.x - 86);
    headEdge.setAttribute("d", `M ${headLeft + 40} ${headPosition.y + 36} L ${headPosition.x - 7} ${headPosition.y + 36}`);
  }
  for (const label of inner.querySelectorAll("[data-null-source]")) {
    const point = nodePositions.get(label.dataset.nullSource);
    if (point) { label.style.left = `${point.x + 150}px`; label.style.top = `${point.y + 25}px`; }
  }
  const headLabel = inner.querySelector(".head-link");
  const labelPosition = model.head && nodePositions.get(model.head.id);
  if (headLabel) {
    headLabel.style.left = `${labelPosition ? Math.max(12, labelPosition.x - 86) : 12}px`;
    headLabel.style.top = `${(labelPosition?.y ?? 28) + 27}px`;
  }
}

function selectConnection(sourceId) {
  selectedConnectionId = sourceId;
  selectedId = null;
  pickerMode = null;
  render();
  const source = model.getNode(sourceId);
  setStatus(`Selected node ${source.value}'s next connection. Press Delete or Backspace, or choose Disconnect.`);
}

function disconnectSelectedConnection() {
  const source = model.getNode(selectedConnectionId);
  if (!source) return;
  const targetDescription = source.next ? `node ${source.next.value}` : "null";
  const statement = `${variableName(source)}.next = null;`;
  const completed = transact(`Disconnect node ${source.value}.next`, statement, `Set node ${source.value}.next to null. The old target ${targetDescription} is no longer connected through this reference.`, () => {
    model.setNext(source.id, null);
    reverseState = null;
  }, source.id);
  if (completed) selectedConnectionId = null;
  render();
}

function startLinkDrag(event, port, source) {
  if (event.button !== 0 || pickerMode?.type === "head") return;
  event.preventDefault();
  const inner = port.closest(".stage-inner");
  const svg = inner?.querySelector(".reference-layer");
  if (!inner || !svg) return;
  const innerRect = inner.getBoundingClientRect();
  const portRect = port.getBoundingClientRect();
  const startX = portRect.left + portRect.width / 2 - innerRect.left;
  const startY = portRect.top + portRect.height / 2 - innerRect.top;
  const line = document.createElementNS(svg.namespaceURI, "path");
  line.setAttribute("class", "drag-link-line");
  line.setAttribute("d", `M ${startX} ${startY} L ${startX} ${startY}`);
  line.setAttribute("marker-end", "url(#arrowhead)");
  svg.append(line);
  draggedLink = { kind: "next", sourceId: source.id, sourceValue: source.value, inner, line, port, startX, startY, moved: false, pointerId: event.pointerId };
  port.classList.add("dragging");
  port.setPointerCapture(event.pointerId);
  selectedId = source.id;
  pickerMode = null;
  setStatus(`Arrow picked up from ${source.value}. Drag it onto another node.`);
}

function startHeadDrag(event, handle) {
  if (event.button !== 0) return;
  event.preventDefault();
  const inner = handle.closest(".stage-inner");
  const svg = inner?.querySelector(".reference-layer");
  if (!inner || !svg) return;
  const bounds = inner.getBoundingClientRect();
  const handleBounds = handle.getBoundingClientRect();
  const startX = handleBounds.right - bounds.left;
  const startY = handleBounds.top + handleBounds.height / 2 - bounds.top;
  const line = document.createElementNS(svg.namespaceURI, "path");
  line.setAttribute("class", "drag-link-line head-drag-line");
  line.setAttribute("d", `M ${startX} ${startY} L ${startX} ${startY}`);
  line.setAttribute("marker-end", "url(#arrowhead)");
  svg.append(line);
  draggedLink = { kind: "head", sourceValue: "head", inner, line, port: handle, startX, startY, moved: false, pointerId: event.pointerId };
  handle.classList.add("dragging");
  handle.setPointerCapture(event.pointerId);
  pickerMode = null;
  selectedId = null;
  setStatus("Head picked up. Drag it to the node that should start the list.");
}

window.addEventListener("pointermove", event => {
  if (draggedNode && event.pointerId === draggedNode.pointerId) {
    const bounds = draggedNode.inner.getBoundingClientRect();
    const x = Math.max(20, event.clientX - bounds.left - draggedNode.offsetX);
    const y = Math.max(18, event.clientY - bounds.top - draggedNode.offsetY);
    if (Math.hypot(x - draggedNode.startX, y - draggedNode.startY) > 5) draggedNode.moved = true;
    if (draggedNode.moved) {
      nodePositions.set(draggedNode.id, { x, y });
      draggedNode.unit.style.left = `${x}px`;
      draggedNode.unit.style.top = `${y}px`;
      updateReferenceGeometry(draggedNode.inner);
    }
    return;
  }
  if (!draggedLink || event.pointerId !== draggedLink.pointerId) return;
  const bounds = draggedLink.inner.getBoundingClientRect();
  const x = event.clientX - bounds.left;
  const y = event.clientY - bounds.top;
  if (Math.hypot(x - draggedLink.startX, y - draggedLink.startY) > 7) draggedLink.moved = true;
  draggedLink.line.setAttribute("d", dragPath(draggedLink.startX, draggedLink.startY, x, y));
  document.querySelectorAll(".drop-ready").forEach(target => target.classList.remove("drop-ready"));
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".node-card, .null-target");
  if (target && (!target.classList.contains("node-card") || target.dataset.nodeId !== draggedLink.sourceId)) target.classList.add("drop-ready");
});

window.addEventListener("pointerup", event => {
  if (draggedNode && event.pointerId === draggedNode.pointerId) {
    const drag = draggedNode;
    draggedNode = null;
    if (drag.moved) {
      suppressNodeClickUntil = Date.now() + 450;
      render();
      setStatus(`Node ${drag.value} moved. Its next arrow still points to the same node.`);
    }
    return;
  }
  if (!draggedLink || event.pointerId !== draggedLink.pointerId) return;
  const drag = draggedLink;
  draggedLink = null;
  drag.line.remove();
  drag.port.classList.remove("dragging");
  document.querySelectorAll(".drop-ready").forEach(target => target.classList.remove("drop-ready"));
  if (!drag.moved) return;
  suppressPortClickUntil = Date.now() + 450;
  const dropTarget = document.elementFromPoint(event.clientX, event.clientY);
  const nodeCard = dropTarget?.closest(".node-card");
  const nullTarget = dropTarget?.closest(".null-target");
  if (nodeCard?.dataset.nodeId && (drag.kind === "head" || nodeCard.dataset.nodeId !== drag.sourceId)) {
    selectedId = drag.sourceId ?? null;
    pickerMode = drag.kind === "head" ? { type: "head" } : { type: "next", sourceId: drag.sourceId };
    chooseTarget(nodeCard.dataset.nodeId);
  } else if (nullTarget) {
    selectedId = drag.sourceId ?? null;
    pickerMode = drag.kind === "head" ? { type: "head" } : { type: "next", sourceId: drag.sourceId };
    chooseTarget("null");
  } else {
    setStatus(`Arrow from ${drag.sourceValue} let go. Drop it on a node or null to connect it.`);
    render();
  }
});

window.addEventListener("pointercancel", () => {
  if (draggedNode) {
    const drag = draggedNode;
    draggedNode = null;
    nodePositions.set(drag.id, { x: drag.startX, y: drag.startY });
    render();
  }
  if (!draggedLink) return;
  draggedLink.line.remove();
  draggedLink.port.classList.remove("dragging");
  draggedLink = null;
  document.querySelectorAll(".drop-ready").forEach(target => target.classList.remove("drop-ready"));
  render();
});

function renderMemory() {
  const inspected = model.inspect();
  ui.allocated.textContent = String(model.nodes.size);
  ui.reachable.textContent = String(inspected.nodes.length);
  ui.disconnected.textContent = String(model.unreachableNodes().length);
}

function renderHistoryAndCode() {
  ui.historyCount.textContent = `${history.length} ${history.length === 1 ? "move" : "moves"}`;
  ui.history.replaceChildren();
  if (!history.length) {
    const empty = document.createElement("li"); empty.className = "history-empty"; empty.textContent = "No operations yet."; ui.history.append(empty);
  } else {
    history.forEach((operation, index) => {
      const item = document.createElement("li"); item.textContent = `${operation.label} — ${operation.statement.replaceAll("\n", " ")}`;
      if (index === history.length - 1) item.setAttribute("aria-current", "step");
      ui.history.append(item);
    });
  }
  const lines = javaScenarioLines();
  const latestStatement = history.at(-1)?.statement ?? "";
  const latestStatements = new Set(latestStatement.split("\n").map(line => line.trim()).filter(Boolean));
  const definitionLines = [
    "class Node {",
    "    int value;",
    "    Node next;",
    "",
    "    Node(int value) {",
    "        this.value = value;",
    "    }",
    "}",
  ];
  renderCodeLines(ui.code, [...definitionLines, "", ...lines], latestStatements);
  ui.codeStep.textContent = "LIVE SCENARIO";
}

function renderCodeLines(target, lines, latestStatements) {
  target.replaceChildren();
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const highlightsLatest = latestStatements.has(trimmed);
    const span = document.createElement("span"); span.className = `code-line${highlightsLatest ? " latest" : ""}`;
    const keyword = /^(class|public|static|void|String|Node|null|head)\b/.test(trimmed);
    if (keyword) {
      const match = line.match(/^(\s*)(class|public|static|void|String|Node|null|head)(.*)$/);
      if (match) {
        span.append(document.createTextNode(match[1]));
        const kw = document.createElement("span"); kw.className = "code-keyword"; kw.textContent = match[2]; span.append(kw, document.createTextNode(match[3]));
      } else span.textContent = line;
    } else span.textContent = line;
    target.append(span);
  });
}

function javaScenarioLines() {
  const lines = [
    "class TaskScenario {",
    "    public static void main(String[] args) {",
  ];
  const declared = new Set();
  for (const value of challenge().initial) {
    const name = `node${value}`;
    lines.push(`        Node ${name} = new Node(${value});`);
    declared.add(name);
  }
  if (challenge().initial.length) {
    lines.push("");
    challenge().initial.forEach((value, index) => {
      const nextName = challenge().initial[index + 1];
      lines.push(`        node${value}.next = ${nextName === undefined ? "null" : `node${nextName}`};`);
    });
  }
  lines.push(`        Node head = ${challenge().initial.length ? `node${challenge().initial[0]}` : "null"};`);
  for (const operation of history) {
    if (!operation.statement) continue;
    for (const statement of operation.statement.split("\n")) {
      let line = statement.trim();
      const declaration = line.match(/^Node\s+(\w+)\s*=/);
      if (declaration && declared.has(declaration[1])) line = line.replace(/^Node\s+/, "");
      else if (declaration) declared.add(declaration[1]);
      lines.push(`        ${line}`);
    }
  }
  lines.push("    }");
  lines.push("}");
  return lines;
}

function renderReverseTrack() {
  if (!reverseState) { ui.reverseTrack.hidden = true; return; }
  ui.reverseTrack.hidden = false;
  ui.reverseTrack.replaceChildren();
  const label = document.createElement("span"); label.textContent = "Algorithm state:"; ui.reverseTrack.append(label);
  const addToken = (name, id, className) => {
    const token = document.createElement("span"); token.className = `track-token ${className}`;
    token.textContent = `${name} → ${id ? model.getNode(id)?.value ?? "null" : "null"}`; ui.reverseTrack.append(token);
  };
  addToken("previous", reverseState.previousId, "previous");
  addToken("current", reverseState.currentId, "current");
  if (reverseState.currentId) addToken("saved next", model.getNode(reverseState.currentId)?.next?.id ?? null, "");
}

function beginCreate() {
  pickerMode = pickerMode?.type === "create" ? null : { type: "create" };
  render();
  setStatus(pickerMode ? "Choose a value. Your new node will appear in memory, ready to connect." : "Node creation cancelled.");
}

function createNode(value) {
  if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) { setStatus("Choose a whole number that fits in a Java int.", "error"); return; }
  if ([...model.nodes.values()].some(node => node.value === value)) { setStatus(`A node with value ${value} already exists.`, "error"); return; }
  const name = variableName({ value });
  transact(`Create node ${value}`, `Node ${name} = new Node(${value});`, `Node ${value} now exists in memory. It is not connected to head until you link it.`, () => {
    const node = model.createNode(value);
    nodePositions.set(node.id, randomNodePosition());
    selectedId = node.id;
  }, null);
}

function chooseTarget(targetId) {
  const target = targetId === "null" ? null : model.getNode(targetId);
  if (pickerMode.type === "next") {
    const source = model.getNode(pickerMode.sourceId);
    const oldTarget = source?.next ?? null;
    const targetName = target ? variableName(target) : "null";
    const statement = `${variableName(source)}.next = ${targetName};`;
    const explanation = oldTarget && oldTarget !== target
      ? `This overwrote node ${source.value}.next. Its old target ${oldTarget.value} is no longer referenced by that field and may now be unreachable.`
      : `This changes only node ${source.value}.next; it does not change head or any other node's next reference.`;
    transact(`Set node ${source.value}.next`, statement, explanation, () => { model.setNext(source.id, target?.id ?? null); reverseState = null; }, source.id);
  } else {
    const statement = `head = ${target ? variableName(target) : "null"};`;
    const explanation = `This changes the separate head reference to ${target ? `node ${target.value}` : "null"}. It does not alter any node's next field.`;
    transact("Change head", statement, explanation, () => { model.setHead(target?.id ?? null); reverseState = null; }, target?.id ?? null);
  }
}

function reverseOneStep() {
  if (!reverseState) return;
  if (reverseState.currentId === null) return;
  const current = model.getNode(reverseState.currentId);
  const previous = model.getNode(reverseState.previousId);
  const next = current.next;
  const firstStep = reverseState.steps === 0;
  const isFinalStep = next === null;
  const statement = `${firstStep ? "Node previous = null;\nNode current = head;\n" : ""}Node nextTemp = current.next;\ncurrent.next = previous;\nprevious = current;\ncurrent = nextTemp;${isFinalStep ? "\nhead = previous;" : ""}`;
  const explanation = isFinalStep
    ? `Saved null from current.next, reversed the final link, and moved head to previous. The chain is now reversed.`
    : `Saved ${next ? `node ${next.value}` : "null"} from current.next before reversing node ${current.value}'s link. The unprocessed suffix remains available through nextTemp.`;
  transact(`Reverse link at ${current.value}`, statement, explanation, () => {
    current.next = previous;
    reverseState.previousId = current.id;
    reverseState.currentId = next?.id ?? null;
    reverseState.steps += 1;
    if (isFinalStep) model.setHead(current.id);
  }, current.id);
}

ui.actions.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  switch (button.dataset.action) {
    case "create": beginCreate(); break;
    case "create-value": createNode(Number(button.dataset.value)); break;
    case "disconnect": disconnectSelectedConnection(); break;
    case "reverse-step": reverseOneStep(); break;
  }
});

window.addEventListener("keydown", event => {
  if (!selectedConnectionId || (event.key !== "Delete" && event.key !== "Backspace")) return;
  if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
  event.preventDefault();
  disconnectSelectedConnection();
});

ui.picker.addEventListener("click", event => {
  if (event.target.closest('[data-action="target-null"]')) chooseTarget("null");
});

ui.hint.addEventListener("click", () => {
  const hints = challenge().hints;
  const message = hints[Math.min(hintIndex, hints.length - 1)];
  hintIndex += 1;
  ui.hintCount.textContent = `${Math.min(hintIndex + 1, hints.length)}/${hints.length}`;
  ui.hint.disabled = hintIndex >= hints.length;
  setStatus(message);
});

ui.undo.addEventListener("click", () => {
  const snapshot = undoStack.pop();
  if (!snapshot) return;
  model.restore(snapshot.model);
  selectedId = snapshot.selectedId;
  selectedConnectionId = snapshot.selectedConnectionId;
  nodePositions = new Map(snapshot.nodePositions.map(([id, point]) => [id, { ...point }]));
  history.length = snapshot.historyLength;
  reverseState = snapshot.reverseState;
  lastChangedId = snapshot.lastChangedId;
  isComplete = false;
  completedChallenges.delete(challenge().id);
  ui.success.hidden = true;
  setStatus("Last operation undone. The references are back to their previous state.");
  render();
});

$("#restart-button").addEventListener("click", () => initializeChallenge(challengeIndex));
ui.next.addEventListener("click", () => {
  if (challengeIndex < CHALLENGES.length - 1) initializeChallenge(challengeIndex + 1);
  else {
    ui.success.hidden = true;
    initializeChallenge(0);
  }
});

initializeChallenge();