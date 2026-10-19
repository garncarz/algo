import test from "node:test";
import assert from "node:assert/strict";
import { CHALLENGES, LinkedListModel, validateChallenge } from "./linked_list_model.mjs";

const challenge = id => CHALLENGES.find(item => item.id === id);

test("head and next are independent references", () => {
  const list = new LinkedListModel([12, 25, 40]);
  const [first, middle, last] = list.inspect().nodes;
  list.setNext(first.id, last.id);
  assert.equal(list.head, first);
  assert.deepEqual(list.inspect().nodes.map(node => node.value), [12, 40]);
  list.setHead(middle.id);
  assert.equal(first.next, last);
  assert.equal(list.head, middle);
});

test("unlinked nodes remain allocated and challenge results are structural", () => {
  const list = new LinkedListModel([12, 25, 40]);
  const middle = list.inspect().nodes[1];
  list.unlink(middle.id);
  assert.deepEqual(list.inspect().nodes.map(node => node.value), [12, 40]);
  assert.deepEqual(list.unreachableNodes().map(node => node.value), [25]);
  assert.equal(validateChallenge(list, challenge("remove-middle")).ok, true);
});

test("overwriting next can disconnect the old suffix", () => {
  const list = new LinkedListModel([12, 25, 40]);
  const [first, middle] = list.inspect().nodes;
  const inserted = list.createNode(30);
  list.setNext(middle.id, inserted.id);
  assert.deepEqual(list.inspect().nodes.map(node => node.value), [12, 25, 30]);
  assert.deepEqual(list.unreachableNodes().map(node => node.value), [40]);
  assert.equal(validateChallenge(list, challenge("insert")).ok, false);
  list.setNext(inserted.id, list.getNode("node-3").id);
  assert.equal(validateChallenge(list, challenge("insert")).ok, true);
  assert.equal(first.value, 12);
});

test("cycle detection terminates and reports invalid ordinary lists", () => {
  const list = new LinkedListModel([3, 6]);
  const [first, second] = list.inspect().nodes;
  list.setNext(second.id, first.id);
  assert.equal(list.inspect().cycle, true);
  assert.equal(validateChallenge(list, { expectedNodes: 2, targetValues: [3, 6], unreachableValues: [] }).reason, "cycle");
});

test("cycles disconnected from head are still detected", () => {
  const list = new LinkedListModel();
  const first = list.createNode(3);
  const second = list.createNode(6);
  list.setNext(first.id, second.id);
  list.setNext(second.id, first.id);
  assert.equal(list.inspect().cycle, false);
  assert.equal(list.findCycle(), first);
  assert.equal(validateChallenge(list, { expectedNodes: 2, targetValues: [], unreachableValues: [3, 6] }).reason, "cycle");
});

test("head removal, empty list and single-node removal validate", () => {
  const headList = new LinkedListModel([12, 25, 40]);
  headList.unlink(headList.head.id);
  assert.equal(validateChallenge(headList, challenge("remove-head")).ok, true);

  const empty = new LinkedListModel();
  const only = empty.createNode(5);
  empty.setHead(only.id);
  assert.equal(validateChallenge(empty, challenge("edge-empty")).ok, true);

  const single = new LinkedListModel([7]);
  single.unlink(single.head.id);
  assert.equal(validateChallenge(single, challenge("edge-single")).ok, true);
});

test("snapshots restore references and allocation state", () => {
  const list = new LinkedListModel([10, 20, 30]);
  const snapshot = list.snapshot();
  const oldHead = list.head;
  list.setNext(oldHead.id, null);
  list.createNode(99);
  list.restore(snapshot);
  assert.deepEqual(list.inspect().nodes.map(node => node.value), [10, 20, 30]);
  assert.equal(list.nodes.size, 3);
  assert.equal(list.nextId, 4);
});

test("guided reverse produces the target order without losing its suffix", () => {
  const list = new LinkedListModel([10, 20, 30]);
  let previous = null;
  let current = list.head;
  while (current) {
    const next = current.next;
    current.next = previous;
    previous = current;
    current = next;
  }
  list.setHead(previous.id);
  assert.equal(validateChallenge(list, challenge("reverse")).ok, true);
  assert.deepEqual(list.inspect().nodes.map(node => node.value), [30, 20, 10]);
});