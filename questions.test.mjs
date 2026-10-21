import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { TOPICS, QUESTIONS } = await import(`data:text/javascript;base64,${Buffer.from(
  readFileSync(new URL("./questions.js", import.meta.url), "utf8")
    .replace('"use strict";', "")
    .concat("\nexport { TOPICS, QUESTIONS };")
).toString("base64")}`);

const LETTERS = ["A", "B", "C", "D"];

test("question bank structure is valid", () => {
  const ids = new Set();
  for (const q of QUESTIONS) {
    assert.ok(q.id && !ids.has(q.id), `duplicate or missing id: ${q.id}`);
    ids.add(q.id);
    assert.ok(TOPICS[q.topic], `${q.id}: unknown topic ${q.topic}`);
    assert.ok([1, 2, 3].includes(q.difficulty), `${q.id}: bad difficulty`);
    assert.equal(q.options.length, 4, `${q.id}: needs exactly four options`);
    assert.ok(LETTERS.includes(q.correct), `${q.id}: bad correct letter`);
    assert.ok(q.ask && q.ask.length < 200, `${q.id}: question text missing or too long`);
    assert.ok(q.explanation && q.explanation.length >= 20, `${q.id}: explanation missing`);
    if (q.code) {
      const lines = q.code.split("\n").length;
      assert.ok(lines <= 14, `${q.id}: ${lines} code lines, too long for projection`);
    }
  }
  assert.ok(QUESTIONS.length >= 25, `expected at least 25 questions, got ${QUESTIONS.length}`);
});

test("all topics from the assignment are covered", () => {
  const covered = new Set(QUESTIONS.map(q => q.topic));
  for (const topic of ["variables", "arrays", "conditions", "loops", "mutations", "nested", "algorithms", "complexity"]) {
    assert.ok(covered.has(topic), `topic missing: ${topic}`);
  }
  const complexity = QUESTIONS.filter(q => q.topic === "complexity");
  assert.ok(complexity.length >= 2 && complexity.length <= 6, "a few, but not many, complexity questions");
});

test("wrong answers are plausible (no correct option duplicated)", () => {
  for (const q of QUESTIONS) {
    const unique = new Set(q.options.map(o => o.trim().toLowerCase()));
    assert.equal(unique.size, 4, `${q.id}: duplicate options would confuse students`);
  }
});

function javaAvailable() {
  try {
    execFileSync("java", ["-version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

test("executable questions produce their keyed answers under real Java", { skip: !javaAvailable() }, () => {
  const checked = QUESTIONS.filter(q => q.check);
  assert.ok(checked.length >= 30, `expected most questions to be machine-checked, got ${checked.length}`);
  for (const q of checked) {
    const dir = mkdtempSync(join(tmpdir(), "quiz-check-"));
    const file = join(dir, "Snippet.java");
    writeFileSync(file, `public class Snippet {\n  public static void main(String[] args) {\n${q.check.code}\n  }\n}\n`);
    let output;
    try {
      output = execFileSync("java", [file], { encoding: "utf8", timeout: 30000, cwd: dir });
    } catch (error) {
      assert.fail(`${q.id}: Java run failed: ${error.stderr || error.message}`);
    }
    assert.equal(
      output.replace(/\r\n/g, "\n").replace(/\n$/, ""),
      q.check.expectedOutput.replace(/\n$/, ""),
      `${q.id}: output does not match expectedOutput (answer key "${q.correct}" may be wrong)`
    );
  }
});

test("the keyed correct option is consistent with the verified output", () => {
  // For questions asking for a printed or final value, the check output should
  // literally appear in the correct option text.
  for (const q of QUESTIONS.filter(item => item.check)) {
    const correctText = q.options[LETTERS.indexOf(q.correct)];
    const out = q.check.expectedOutput.trim();
    const asksForValue = ["prints", "print", "look like", "value", "what does this code print"].some(w => q.ask.toLowerCase().includes(w));
    if (!asksForValue) continue;
    if (!/^[\[\]0-9a-zA-Z ,.:_"-]+$/.test(correctText) || correctText.length > 30) continue;
    const compact = s => s.replace(/[\s"']/g, "");
    const outParts = out.split("\n").map(compact).filter(Boolean);
    const correctCompact = compact(correctText);
    const matched = outParts.some(part => part.includes(correctCompact) || correctCompact.includes(part)) ||
      correctText.toLowerCase().includes("then") && outParts.every(part => correctText.includes(part));
    assert.ok(matched, `${q.id}: check output "${out}" vs correct option "${correctText}" — verify consistency`);
  }
});
