export class ListNode {
  constructor(id, value) {
    this.id = id;
    this.value = value;
    this.next = null;
  }
}

export class LinkedListModel {
  constructor(initialValues = []) {
    this.nodes = new Map();
    this.head = null;
    this.nextId = 1;
    for (const value of initialValues) {
      const node = this.createNode(value);
      if (this.head === null) this.head = node;
      else this.chainTail().next = node;
    }
  }

  createNode(value) {
    if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) throw new TypeError("Node values must fit in a Java int.");
    const node = new ListNode(`node-${this.nextId}`, value);
    this.nextId += 1;
    this.nodes.set(node.id, node);
    return node;
  }

  getNode(id) {
    return this.nodes.get(id) ?? null;
  }

  chainTail() {
    const { nodes, cycle } = this.inspect();
    if (cycle) throw new Error("The reachable list contains a cycle.");
    return nodes.at(-1) ?? null;
  }

  setNext(sourceId, targetId) {
    const source = this.getNode(sourceId);
    const target = targetId === null ? null : this.getNode(targetId);
    if (!source || (targetId !== null && !target)) throw new Error("Choose existing nodes for this reference assignment.");
    source.next = target;
  }

  setHead(targetId) {
    const target = targetId === null ? null : this.getNode(targetId);
    if (targetId !== null && !target) throw new Error("The head must refer to an existing node or null.");
    this.head = target;
  }

  unlink(nodeId) {
    const selected = this.getNode(nodeId);
    if (!selected) throw new Error("Choose a node that still exists in memory.");
    const { nodes, cycle } = this.inspect();
    if (cycle) throw new Error("Break the cycle before unlinking a node.");
    const index = nodes.findIndex(node => node.id === nodeId);
    if (index < 0) throw new Error("That node is already unreachable from head.");
    if (index === 0) {
      this.head = selected.next;
      return { statement: "head = head.next;", explanation: "Move the separate head reference forward. The old first node still exists, but is no longer reachable from head." };
    }
    const previous = nodes[index - 1];
    previous.next = selected.next;
    return {
      statement: `${variableName(previous)}.next = ${selected.next ? variableName(selected.next) : "null"};`,
      explanation: `Bypass ${selected.value} by pointing ${previous.value}.next to its successor. The unlinked node still exists in memory.`,
    };
  }

  inspect() {
    const reachable = [];
    const seen = new Set();
    let current = this.head;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      reachable.push(current);
      current = current.next;
    }
    return { nodes: reachable, cycle: current !== null, cycleAt: current };
  }

  findCycle() {
    const fullyVisited = new Set();
    for (const start of this.nodes.values()) {
      if (fullyVisited.has(start.id)) continue;
      const path = new Set();
      let current = start;
      while (current && !fullyVisited.has(current.id)) {
        if (path.has(current.id)) return current;
        path.add(current.id);
        current = current.next;
      }
      for (const id of path) fullyVisited.add(id);
    }
    return null;
  }

  unreachableNodes() {
    const reachableIds = new Set(this.inspect().nodes.map(node => node.id));
    return [...this.nodes.values()].filter(node => !reachableIds.has(node.id));
  }

  snapshot() {
    return {
      headId: this.head?.id ?? null,
      nextId: this.nextId,
      nodes: [...this.nodes.values()].map(node => ({ id: node.id, value: node.value, nextId: node.next?.id ?? null })),
    };
  }

  restore(snapshot) {
    const restored = new Map(snapshot.nodes.map(data => [data.id, new ListNode(data.id, data.value)]));
    for (const data of snapshot.nodes) {
      restored.get(data.id).next = data.nextId === null ? null : restored.get(data.nextId) ?? null;
    }
    this.nodes = restored;
    this.head = snapshot.headId === null ? null : restored.get(snapshot.headId) ?? null;
    this.nextId = snapshot.nextId;
  }
}

export function variableName(node) {
  return `node${node.value}`;
}

export const CHALLENGES = [
  {
    id: "build", level: 1, title: "Build the chain", subtitle: "Every list begins with a reference, not a row of boxes.",
    instruction: "Make a chain: 8, then 16, then 24. Point head to 8 and connect the blue next arrows. End at null.",
    initial: [], targetValues: [8, 16, 24], unreachableValues: [], expectedNodes: 3,
    actions: ["create", "set-next", "change-head"],
    hints: ["Create each node first; creating a node does not put it in the list.", "Set head to the first node, then set 8.next to 16 and 16.next to 24.", "The last node's next reference should be null."],
    success: "You built a three-node chain. head refers to the first node, and null marks the end. A single-node list is the same idea: head points to one node whose next is null.",
  },
  {
    id: "insert", level: 2, title: "Insert a passenger", subtitle: "Preserve the old successor before you redirect the link.",
    instruction: "Insert a new node containing 30 between 25 and 40. Keep every existing node reachable.",
    initial: [12, 25, 40], targetValues: [12, 25, 30, 40], unreachableValues: [], expectedNodes: 4,
    actions: ["create", "set-next", "change-head"],
    hints: ["Create node 30 without changing the existing links.", "First assign node30.next = node40; then assign node25.next = node30.", "If 25.next is changed to 30 first, node 40 is disconnected until you reconnect it."],
    success: "Both links now form one chain. Setting the new node's next first preserves the old successor before the predecessor is redirected. These are pointer assignments; a general insertion method would also need to handle other positions and edge cases.",
  },
  {
    id: "remove-middle", level: 3, title: "Repair the chain", subtitle: "Change the link yourself; Java has no delete statement for objects.",
    instruction: "Make 25 unreachable from head by setting 12.next to 40. Keep 12 and 40 connected; 25 stays in memory.",
    initial: [12, 25, 40], targetValues: [12, 40], unreachableValues: [25], expectedNodes: 3,
    actions: ["set-next", "change-head"],
    hints: ["Pick up the next pocket on node 12, then drop it on node 40.", "Only node12.next changes. Node 25 still exists, but head can no longer reach it.", "Java does not have a delete statement for ordinary objects. Garbage collection reclaims objects only after they become unreachable."],
    success: "You changed the predecessor's next reference to bypass 25. The Node object remains allocated in this lesson model; Java's garbage collector may reclaim it later because it is unreachable.",
  },
  {
    id: "remove-head", level: 3, title: "Repair the chain: head", subtitle: "The head reference is separate from every node's next field.",
    instruction: "Remove the first node, 12. Keep 25 and 40 reachable.",
    initial: [12, 25, 40], targetValues: [25, 40], unreachableValues: [12], expectedNodes: 3,
    actions: ["set-next", "change-head"],
    hints: ["Drag the head arrow from node 12 to node 25.", "This changes head; it does not change node12.next.", "Java does not destroy node 12 directly. It becomes unreachable from head and may later be collected."],
    success: "You changed the separate head reference. Node 12 still exists in memory, but the list now starts at node 25.",
  },
  {
    id: "reverse", level: 4, title: "Reverse the chain", subtitle: "Keep a temporary next reference before turning each arrow around.",
    instruction: "Reverse 10 → 20 → 30 so head leads 30 → 20 → 10. Drag the arrows and head yourself, or use the optional guided flip button.",
    initial: [10, 20, 30], targetValues: [30, 20, 10], unreachableValues: [], expectedNodes: 3,
    actions: ["reverse-step"], guided: true,
    hints: ["At each step: save current.next, point current.next to previous, then advance previous and current.", "The temporary next value protects the part of the chain that has not been reversed yet.", "On the final flip, current becomes null and head moves to previous automatically."],
    success: "The reversed prefix grew one node at a time while the saved next reference kept the remaining suffix reachable. Finally, head was updated to previous.",
  },
  {
    id: "edge-empty", level: 5, title: "Edge-case challenge", subtitle: "Fewer hints now: reason about the actual references.",
    instruction: "Start with an empty list and create a one-node list containing 5.",
    initial: [], targetValues: [5], unreachableValues: [], expectedNodes: 1,
    actions: ["create", "set-next", "change-head"],
    hints: ["Create a node, then change head to point to it.", "The node's next reference is already null."],
    success: "An empty list has head == null. After the insertion, head refers to one node and that node's next remains null.",
  },
  {
    id: "edge-tail", level: 5, title: "Edge-case challenge", subtitle: "Fewer hints now: reason about the actual references.",
    instruction: "Remove the last node, 15, from 4 → 9 → 15. Keep 4 and 9 reachable.",
    initial: [4, 9, 15], targetValues: [4, 9], unreachableValues: [15], expectedNodes: 3,
    actions: ["create", "set-next", "change-head"],
    hints: ["Pick up the next pocket on node 9 and drop it on null.", "Node 15 remains an object in memory, but node 9.next no longer reaches it."],
    success: "Node 9 is now the last node because its next reference is null. Node 15 still exists as an unreachable object in this model.",
  },
  {
    id: "edge-single", level: 5, title: "Edge-case challenge", subtitle: "Fewer hints now: reason about the actual references.",
    instruction: "Remove the only node, 7, from this single-node list.",
    initial: [7], targetValues: [], unreachableValues: [7], expectedNodes: 1,
    actions: ["set-next", "change-head"],
    hints: ["Drag head away from node 7 and drop it on null.", "Node 7 remains an object in memory; the list is empty because head is null."],
    success: "After changing head to null, the list is empty. Node 7 is still an object in memory and may later be reclaimed by Java's garbage collector.",
  },
];

export function validateChallenge(model, challenge) {
  const inspected = model.inspect();
  if (model.findCycle()) return { ok: false, reason: "cycle", message: "A next reference loops back to an earlier node. Ordinary lists must end at null." };
  if (model.nodes.size !== challenge.expectedNodes) return { ok: false, reason: "node-count", message: `There should be ${challenge.expectedNodes} node${challenge.expectedNodes === 1 ? "" : "s"} in memory for this challenge.` };
  const values = inspected.nodes.map(node => node.value);
  if (values.length !== challenge.targetValues.length || values.some((value, index) => value !== challenge.targetValues[index])) {
    return { ok: false, reason: "chain", message: `From head, the chain should read ${formatValues(challenge.targetValues)} and end at null.` };
  }
  const actualUnreachable = model.unreachableNodes().map(node => node.value).sort((a, b) => a - b);
  const expectedUnreachable = [...challenge.unreachableValues].sort((a, b) => a - b);
  if (actualUnreachable.length !== expectedUnreachable.length || actualUnreachable.some((value, index) => value !== expectedUnreachable[index])) {
    return { ok: false, reason: "unreachable", message: "There are nodes in memory that are not reachable from head. Check whether a link was overwritten or a node should have been unlinked." };
  }
  return { ok: true, reason: "complete", message: "The structure matches the goal." };
}

export function formatValues(values) {
  return values.length ? values.join(" → ") : "an empty list";
}