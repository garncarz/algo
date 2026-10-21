"use strict";

// Java code-tracing question bank for quiz.html.
//
// Adding a question:
//   - id:          unique slug (stable; the live backend refers to questions by id)
//   - topic:       variables | arrays | conditions | loops | mutations | nested | algorithms | complexity
//   - difficulty:  1 (easy) .. 3 (moderately challenging)
//   - code:        optional Java fragment, shown in the code card ("ask" is printed beneath it)
//   - ask:         the actual question sentence
//   - options:     exactly four answer choices; the letter is the array position (A..D)
//   - correct:     "A" | "B" | "C" | "D"
//   - explanation: short reason; <br> separates steps of a trace (inserted as HTML)
//   - check:       optional executable main-method body; questions.test.mjs runs it with a
//                  real Java and asserts the printed output equals expectedOutput exactly.
//
// Keep questions 3-12 lines of Java, projector-friendly. Prefer plausible wrong answers
// that mirror common misunderstandings (off-by-one, index vs. value, assignment order).

const TOPICS = {
  variables: "Variables & assignments",
  arrays: "Arrays & indexing",
  conditions: "Conditions",
  loops: "Simple loops",
  mutations: "Array mutations",
  nested: "Nested loops",
  algorithms: "Algorithm fragments",
  complexity: "Time complexity"
};

const QUESTIONS = [
  // ---------- Variables and assignments ----------
  {
    id: "var-seq-assign",
    topic: "variables",
    difficulty: 1,
    code: "int x = 5;\nint y = x;\nx = 10;",
    ask: "What is the value of y after this code runs?",
    options: ["5", "10", "0", "y changes whenever x changes"],
    correct: "A",
    explanation: "y = x copies the value 5 into y. Reassigning x afterwards does not touch y — variables hold values, not links to each other.",
    check: { code: "int x = 5;\nint y = x;\nx = 10;\nSystem.out.println(y);", expectedOutput: "5" }
  },
  {
    id: "var-inc",
    topic: "variables",
    difficulty: 1,
    code: "int count = 7;\ncount++;\ncount++;",
    ask: "What is the final value of count?",
    options: ["7", "8", "9", "10"],
    correct: "C",
    explanation: "count++ adds one. It runs twice: 7 → 8 → 9.",
    check: { code: "int count = 7;\ncount++;\ncount++;\nSystem.out.println(count);", expectedOutput: "9" }
  },
  {
    id: "var-compound",
    topic: "variables",
    difficulty: 1,
    code: "int total = 20;\ntotal -= 5;\ntotal += 2;",
    ask: "What is the final value of total?",
    options: ["15", "17", "22", "27"],
    correct: "B",
    explanation: "total -= 5 gives 15; total += 2 gives 17.",
    check: { code: "int total = 20;\ntotal -= 5;\ntotal += 2;\nSystem.out.println(total);", expectedOutput: "17" }
  },
  {
    id: "var-self-assign",
    topic: "variables",
    difficulty: 1,
    code: "int a = 3;\nint b = 4;\na = b;",
    ask: "What are the values of a and b afterwards?",
    options: ["a = 3, b = 4", "a = 4, b = 4", "a = 4, b = 3", "a = 3, b = 3"],
    correct: "B",
    explanation: "a = b copies b's value into a; b itself is unchanged. Both now hold 4.",
    check: { code: "int a = 3;\nint b = 4;\na = b;\nSystem.out.println(a + \" \" + b);", expectedOutput: "4 4" }
  },
  {
    id: "var-swap",
    topic: "variables",
    difficulty: 2,
    code: "int a = 3;\nint b = 8;\nint temp = a;\na = b;\nb = temp;",
    ask: "What are the values of a and b afterwards?",
    options: ["a = 3, b = 8", "a = 8, b = 3", "a = 8, b = 8", "a = 3, b = 3"],
    correct: "B",
    explanation: "temp saves the old a (3). Then a takes 8 from b, and b takes the saved 3 — a classic swap.",
    check: { code: "int a = 3;\nint b = 8;\nint temp = a;\na = b;\nb = temp;\nSystem.out.println(a + \" \" + b);", expectedOutput: "8 3" }
  },
  {
    id: "var-int-division",
    topic: "variables",
    difficulty: 2,
    code: "int average = (7 + 8) / 2;",
    ask: "What value does average get?",
    options: ["7.5", "7", "8", "15"],
    correct: "B",
    explanation: "(7 + 8) / 2 = 15 / 2. Both operands are int, so Java does integer division and drops the fraction: 7.",
    check: { code: "int average = (7 + 8) / 2;\nSystem.out.println(average);", expectedOutput: "7" }
  },

  // ---------- Arrays and indexing ----------
  {
    id: "arr-read",
    topic: "arrays",
    difficulty: 1,
    code: "int[] numbers = {4, 7, 2, 9, 5};\nint x = numbers[2];",
    ask: "What value does x get?",
    options: ["7", "2", "9", "3"],
    correct: "B",
    explanation: "Indexing is zero-based: index 0 → 4, index 1 → 7, index 2 → 2.",
    check: { code: "int[] numbers = {4, 7, 2, 9, 5};\nint x = numbers[2];\nSystem.out.println(x);", expectedOutput: "2" }
  },
  {
    id: "arr-last",
    topic: "arrays",
    difficulty: 1,
    code: "int[] data = {10, 20, 30, 40};\nint last = data[data.length - 1];",
    ask: "What value does last get?",
    options: ["10", "30", "40", "An exception is thrown"],
    correct: "C",
    explanation: "data.length is 4, so data.length - 1 = 3, and data[3] is 40 — the last element.",
    check: { code: "int[] data = {10, 20, 30, 40};\nint last = data[data.length - 1];\nSystem.out.println(last);", expectedOutput: "40" }
  },
  {
    id: "arr-index-vs-value",
    topic: "arrays",
    difficulty: 1,
    code: "int[] values = {6, 1, 8, 3};\nint i = 2;\nint x = values[i];",
    ask: "What value does x get?",
    options: ["1", "2", "8", "3"],
    correct: "C",
    explanation: "i is 2, so values[i] is values[2], which is 8. The index (2) and the stored value (8) are different things.",
    check: { code: "int[] values = {6, 1, 8, 3};\nint i = 2;\nint x = values[i];\nSystem.out.println(x);", expectedOutput: "8" }
  },
  {
    id: "arr-oob",
    topic: "arrays",
    difficulty: 2,
    code: "int[] scores = {5, 9, 1};\nint x = scores[3];",
    ask: "What happens when this code runs?",
    options: ["x becomes 1", "x becomes 0", "x becomes 5", "An ArrayIndexOutOfBoundsException is thrown"],
    correct: "D",
    explanation: "Valid indices are 0, 1, 2 (length − 1 is the last). Index 3 does not exist, so Java throws ArrayIndexOutOfBoundsException.",
    check: {
      code: "int[] scores = {5, 9, 1};\ntry {\n    int x = scores[3];\n    System.out.println(\"no exception\");\n} catch (ArrayIndexOutOfBoundsException e) {\n    System.out.println(\"exception\");\n}",
      expectedOutput: "exception"
    }
  },
  {
    id: "arr-value-as-index",
    topic: "arrays",
    difficulty: 2,
    code: "int[] a = {10, 20, 30};\nint x = a[a[0] - 9];",
    ask: "What value does x get?",
    options: ["10", "20", "30", "An exception is thrown"],
    correct: "B",
    explanation: "Evaluate inside out: a[0] is 10, so the index is 10 − 9 = 1, and a[1] is 20.",
    check: { code: "int[] a = {10, 20, 30};\nint x = a[a[0] - 9];\nSystem.out.println(x);", expectedOutput: "20" }
  },
  {
    id: "arr-length",
    topic: "arrays",
    difficulty: 2,
    code: "int[] items = new int[5];\nSystem.out.println(items.length);\nSystem.out.println(items[0]);",
    ask: "What does this code print?",
    options: ["5 then 0", "4 then 0", "5 then null", "It throws an exception"],
    correct: "A",
    explanation: "new int[5] creates an array of length 5. Numeric array elements are automatically initialized to 0.",
    check: { code: "int[] items = new int[5];\nSystem.out.println(items.length);\nSystem.out.println(items[0]);", expectedOutput: "5\n0" }
  },

  // ---------- Conditions ----------
  {
    id: "cond-basic",
    topic: "conditions",
    difficulty: 1,
    code: "int age = 17;\nString msg;\nif (age >= 18) {\n    msg = \"adult\";\n} else {\n    msg = \"minor\";\n}",
    ask: "What value does msg get?",
    options: ["\"adult\"", "\"minor\"", "null", "The code does not compile"],
    correct: "B",
    explanation: "17 >= 18 is false, so the else branch runs and msg becomes \"minor\".",
    check: { code: "int age = 17;\nString msg;\nif (age >= 18) {\n    msg = \"adult\";\n} else {\n    msg = \"minor\";\n}\nSystem.out.println(msg);", expectedOutput: "minor" }
  },
  {
    id: "cond-equals",
    topic: "conditions",
    difficulty: 1,
    code: "int x = 5;\nboolean result = (x == 5);",
    ask: "What value does result get?",
    options: ["false", "true", "5", "The code does not compile"],
    correct: "B",
    explanation: "== compares values: x equals 5, so the comparison is true. (A single = would be assignment, not comparison.)",
    check: { code: "int x = 5;\nboolean result = (x == 5);\nSystem.out.println(result);", expectedOutput: "true" }
  },
  {
    id: "cond-not",
    topic: "conditions",
    difficulty: 2,
    code: "boolean ready = false;\nif (!ready) {\n    System.out.println(\"wait\");\n} else {\n    System.out.println(\"go\");\n}",
    ask: "What does this code print?",
    options: ["wait", "go", "false", "Nothing is printed"],
    correct: "A",
    explanation: "! flips the boolean: !ready is !false = true, so the if branch prints \"wait\".",
    check: { code: "boolean ready = false;\nif (!ready) {\n    System.out.println(\"wait\");\n} else {\n    System.out.println(\"go\");\n}", expectedOutput: "wait" }
  },
  {
    id: "cond-shortcircuit",
    topic: "conditions",
    difficulty: 2,
    code: "int[] a = {1, 2};\nint i = 5;\nif (i < a.length && a[i] > 0) {\n    System.out.println(\"yes\");\n} else {\n    System.out.println(\"no\");\n}",
    ask: "What does this code print?",
    options: ["yes", "no", "It throws ArrayIndexOutOfBoundsException", "It prints nothing"],
    correct: "B",
    explanation: "i < a.length is 5 < 2 = false. && short-circuits: the right side a[i] is never evaluated, so no exception — it prints \"no\".",
    check: { code: "int[] a = {1, 2};\nint i = 5;\nif (i < a.length && a[i] > 0) {\n    System.out.println(\"yes\");\n} else {\n    System.out.println(\"no\");\n}", expectedOutput: "no" }
  },
  {
    id: "cond-elseif",
    topic: "conditions",
    difficulty: 2,
    code: "int score = 85;\nString grade;\nif (score >= 90) {\n    grade = \"A\";\n} else if (score >= 80) {\n    grade = \"B\";\n} else {\n    grade = \"C\";\n}",
    ask: "What value does grade get?",
    options: ["\"A\"", "\"B\"", "\"C\"", "\"B\" and then \"C\""],
    correct: "B",
    explanation: "85 >= 90 is false, so the first branch is skipped. 85 >= 80 is true → grade = \"B\", and the chain ends; the else never runs.",
    check: { code: "int score = 85;\nString grade;\nif (score >= 90) {\n    grade = \"A\";\n} else if (score >= 80) {\n    grade = \"B\";\n} else {\n    grade = \"C\";\n}\nSystem.out.println(grade);", expectedOutput: "B" }
  },
  {
    id: "cond-dangling",
    topic: "conditions",
    difficulty: 3,
    code: "int x = 4;\nif (x > 5)\n    System.out.println(\"big\");\n    System.out.println(\"done\");",
    ask: "What does this code print?",
    options: ["big then done", "done only", "big only", "Nothing is printed"],
    correct: "B",
    explanation: "Without braces, the if guards only the very next statement. \"big\" is skipped, but \"done\" is an ordinary statement and always prints. Indentation does not matter to Java.",
    check: { code: "int x = 4;\nif (x > 5)\n    System.out.println(\"big\");\n    System.out.println(\"done\");", expectedOutput: "done" }
  },

  // ---------- Simple loops ----------
  {
    id: "loop-count",
    topic: "loops",
    difficulty: 1,
    code: "int count = 0;\nfor (int i = 0; i < 4; i++) {\n    count++;\n}",
    ask: "What is the final value of count?",
    options: ["3", "4", "5", "0"],
    correct: "B",
    explanation: "i takes the values 0, 1, 2, 3 — four turns — and stops when i reaches 4. count becomes 4.",
    check: { code: "int count = 0;\nfor (int i = 0; i < 4; i++) {\n    count++;\n}\nSystem.out.println(count);", expectedOutput: "4" }
  },
  {
    id: "loop-sum",
    topic: "loops",
    difficulty: 1,
    code: "int sum = 0;\nfor (int i = 1; i <= 3; i++) {\n    sum += i;\n}",
    ask: "What is the final value of sum?",
    options: ["3", "5", "6", "10"],
    correct: "C",
    explanation: "i runs 1, 2, 3 (note the <=). sum = 0 + 1 + 2 + 3 = 6.",
    check: { code: "int sum = 0;\nfor (int i = 1; i <= 3; i++) {\n    sum += i;\n}\nSystem.out.println(sum);", expectedOutput: "6" }
  },
  {
    id: "loop-print",
    topic: "loops",
    difficulty: 1,
    code: "for (int i = 0; i < 3; i++) {\n    System.out.print(i + \" \");\n}",
    ask: "What does this loop print?",
    options: ["0 1 2", "1 2 3", "0 1 2 3", "1 2"],
    correct: "A",
    explanation: "i starts at 0 and the condition is i < 3, so the printed values are 0, 1, 2.",
    check: { code: "for (int i = 0; i < 3; i++) {\n    System.out.print(i + \" \");\n}", expectedOutput: "0 1 2 " }
  },
  {
    id: "loop-while",
    topic: "loops",
    difficulty: 2,
    code: "int n = 1;\nwhile (n < 20) {\n    n = n * 2;\n}",
    ask: "What is the final value of n?",
    options: ["16", "20", "32", "The loop never ends"],
    correct: "C",
    explanation: "n goes 1 → 2 → 4 → 8 → 16 → 32. At 16 the condition 16 < 20 is still true, so the body runs once more and n becomes 32, which ends the loop.",
    check: { code: "int n = 1;\nwhile (n < 20) {\n    n = n * 2;\n}\nSystem.out.println(n);", expectedOutput: "32" }
  },
  {
    id: "loop-offbyone",
    topic: "loops",
    difficulty: 2,
    code: "int[] a = {5, 6, 7};\nint sum = 0;\nfor (int i = 0; i <= a.length - 1; i++) {\n    sum += a[i];\n}",
    ask: "What is the final value of sum?",
    options: ["11", "18", "13", "An exception is thrown"],
    correct: "B",
    explanation: "i goes 0, 1, 2 — exactly the valid indices. sum = 5 + 6 + 7 = 18. Writing i <= length (without the − 1) would be the classic off-by-one crash.",
    check: { code: "int[] a = {5, 6, 7};\nint sum = 0;\nfor (int i = 0; i <= a.length - 1; i++) {\n    sum += a[i];\n}\nSystem.out.println(sum);", expectedOutput: "18" }
  },
  {
    id: "loop-backwards",
    topic: "loops",
    difficulty: 2,
    code: "int[] a = {1, 2, 3};\nfor (int i = a.length - 1; i >= 0; i--) {\n    System.out.print(a[i] + \" \");\n}",
    ask: "What does this loop print?",
    options: ["1 2 3", "3 2 1", "2 1 0", "3 2 1 0"],
    correct: "B",
    explanation: "i starts at 2 and decreases: the elements print in reverse order — 3, 2, 1.",
    check: { code: "int[] a = {1, 2, 3};\nfor (int i = a.length - 1; i >= 0; i--) {\n    System.out.print(a[i] + \" \");\n}", expectedOutput: "3 2 1 " }
  },
  {
    id: "loop-scope",
    topic: "loops",
    difficulty: 2,
    code: "int total = 0;\nfor (int i = 0; i < 5; i++) {\n    total += i;\n}",
    ask: "What is the final value of total?",
    options: ["15", "10", "5", "4"],
    correct: "B",
    explanation: "The last executed turn is i = 4: total = 0 + 1 + 2 + 3 + 4 = 10. (The sum through 5 would be 15, but i never reaches 5 inside the body.)",
    check: { code: "int total = 0;\nfor (int i = 0; i < 5; i++) {\n    total += i;\n}\nSystem.out.println(total);", expectedOutput: "10" }
  },

  // ---------- Array mutations ----------
  {
    id: "mut-set",
    topic: "mutations",
    difficulty: 1,
    code: "int[] a = {1, 2, 3};\na[1] = 9;",
    ask: "What does the array look like afterwards?",
    options: ["[1, 2, 3]", "[1, 9, 3]", "[9, 2, 3]", "[1, 2, 9]"],
    correct: "B",
    explanation: "a[1] is the element at index 1 — the second slot. It changes from 2 to 9: [1, 9, 3].",
    check: { code: "int[] a = {1, 2, 3};\na[1] = 9;\nSystem.out.println(java.util.Arrays.toString(a));", expectedOutput: "[1, 9, 3]" }
  },
  {
    id: "mut-inc",
    topic: "mutations",
    difficulty: 1,
    code: "int[] counts = {0, 0, 0};\ncounts[2]++;\ncounts[2]++;",
    ask: "What does the array look like afterwards?",
    options: ["[0, 0, 0]", "[0, 0, 1]", "[0, 0, 2]", "[2, 0, 0]"],
    correct: "C",
    explanation: "counts[2]++ adds one to the slot at index 2, twice: [0, 0, 2].",
    check: { code: "int[] counts = {0, 0, 0};\ncounts[2]++;\ncounts[2]++;\nSystem.out.println(java.util.Arrays.toString(counts));", expectedOutput: "[0, 0, 2]" }
  },
  {
    id: "mut-swap",
    topic: "mutations",
    difficulty: 2,
    code: "int[] a = {4, 7};\nint temp = a[0];\na[0] = a[1];\na[1] = temp;",
    ask: "What does the array look like afterwards?",
    options: ["[4, 7]", "[7, 4]", "[7, 7]", "[4, 4]"],
    correct: "B",
    explanation: "temp saves a[0] (4). a[0] takes 7, then a[1] takes the saved 4: the two elements are swapped.",
    check: { code: "int[] a = {4, 7};\nint temp = a[0];\na[0] = a[1];\na[1] = temp;\nSystem.out.println(java.util.Arrays.toString(a));", expectedOutput: "[7, 4]" }
  },
  {
    id: "mut-alias",
    topic: "mutations",
    difficulty: 2,
    code: "int[] a = {1, 2, 3};\nint[] b = a;\nb[0] = 99;",
    ask: "What is a[0] afterwards?",
    options: ["1", "99", "0", "The code does not compile"],
    correct: "B",
    explanation: "b = a does not copy the array — both names refer to the same array. Changing b[0] changes a[0] too: 99.",
    check: { code: "int[] a = {1, 2, 3};\nint[] b = a;\nb[0] = 99;\nSystem.out.println(a[0]);", expectedOutput: "99" }
  },
  {
    id: "mut-shift",
    topic: "mutations",
    difficulty: 3,
    code: "int[] a = {3, 5, 7, 9};\nfor (int i = 0; i < a.length - 1; i++) {\n    a[i] = a[i + 1];\n}",
    ask: "What does the array look like afterwards?",
    options: ["[5, 7, 9, 9]", "[5, 7, 9, 3]", "[3, 3, 5, 7]", "[7, 9, 3, 5]"],
    correct: "A",
    explanation: "Each step copies the next element left:<br>i=0: [5, 5, 7, 9]<br>i=1: [5, 7, 7, 9]<br>i=2: [5, 7, 9, 9]<br>Everything shifts left; the last slot keeps its old value.",
    check: { code: "int[] a = {3, 5, 7, 9};\nfor (int i = 0; i < a.length - 1; i++) {\n    a[i] = a[i + 1];\n}\nSystem.out.println(java.util.Arrays.toString(a));", expectedOutput: "[5, 7, 9, 9]" }
  },

  // ---------- Nested loops ----------
  {
    id: "nest-count",
    topic: "nested",
    difficulty: 2,
    code: "int count = 0;\nfor (int i = 0; i < 2; i++) {\n    for (int j = 0; j < 3; j++) {\n        count++;\n    }\n}",
    ask: "What is the final value of count?",
    options: ["5", "6", "3", "2"],
    correct: "B",
    explanation: "The inner loop runs 3 times for each of the 2 outer turns: 2 × 3 = 6 increments.",
    check: { code: "int count = 0;\nfor (int i = 0; i < 2; i++) {\n    for (int j = 0; j < 3; j++) {\n        count++;\n    }\n}\nSystem.out.println(count);", expectedOutput: "6" }
  },
  {
    id: "nest-print",
    topic: "nested",
    difficulty: 2,
    code: "for (int i = 0; i < 2; i++) {\n    for (int j = 0; j < 2; j++) {\n        System.out.print(i + \"\" + j + \" \");\n    }\n}",
    ask: "What does this code print?",
    options: ["00 01 10 11", "00 10 01 11", "00 11", "01 10"],
    correct: "A",
    explanation: "i stays 0 while j runs 0, 1 → \"00 01\"; then i becomes 1 and j runs 0, 1 again → \"10 11\".",
    check: { code: "for (int i = 0; i < 2; i++) {\n    for (int j = 0; j < 2; j++) {\n        System.out.print(i + \"\" + j + \" \");\n    }\n}", expectedOutput: "00 01 10 11 " }
  },
  {
    id: "nest-triangle",
    topic: "nested",
    difficulty: 3,
    code: "int count = 0;\nfor (int i = 0; i < 3; i++) {\n    for (int j = 0; j <= i; j++) {\n        count++;\n    }\n}",
    ask: "What is the final value of count?",
    options: ["3", "6", "9", "4"],
    correct: "B",
    explanation: "The inner bound depends on the outer variable:<br>i=0 → j=0 (1 turn)<br>i=1 → j=0,1 (2 turns)<br>i=2 → j=0,1,2 (3 turns)<br>Total: 1 + 2 + 3 = 6, not 3 × 3 = 9.",
    check: { code: "int count = 0;\nfor (int i = 0; i < 3; i++) {\n    for (int j = 0; j <= i; j++) {\n        count++;\n    }\n}\nSystem.out.println(count);", expectedOutput: "6" }
  },

  // ---------- Algorithm fragments ----------
  {
    id: "algo-linsearch",
    topic: "algorithms",
    difficulty: 2,
    code: "int[] a = {4, 8, 15, 16, 23};\nint target = 15;\nint i = 0;\nwhile (i < a.length && a[i] != target) {\n    i++;\n}",
    ask: "What is the value of i when the loop ends?",
    options: ["1", "2", "3", "5"],
    correct: "B",
    explanation: "Linear search checks a[0]=4, a[1]=8, then stops at a[2]=15. The loop ends with i = 2.",
    check: { code: "int[] a = {4, 8, 15, 16, 23};\nint target = 15;\nint i = 0;\nwhile (i < a.length && a[i] != target) {\n    i++;\n}\nSystem.out.println(i);", expectedOutput: "2" }
  },
  {
    id: "algo-count",
    topic: "algorithms",
    difficulty: 2,
    code: "int[] a = {1, 7, 2, 7, 7, 3};\nint count = 0;\nfor (int i = 0; i < a.length; i++) {\n    if (a[i] == 7) {\n        count++;\n    }\n}",
    ask: "What is the final value of count?",
    options: ["2", "3", "4", "7"],
    correct: "B",
    explanation: "The if selects the elements equal to 7 — at indices 1, 3, and 4 — so count becomes 3.",
    check: { code: "int[] a = {1, 7, 2, 7, 7, 3};\nint count = 0;\nfor (int i = 0; i < a.length; i++) {\n    if (a[i] == 7) {\n        count++;\n    }\n}\nSystem.out.println(count);", expectedOutput: "3" }
  },
  {
    id: "algo-max",
    topic: "algorithms",
    difficulty: 2,
    code: "int[] a = {3, 9, 4};\nint max = a[0];\nfor (int i = 1; i < a.length; i++) {\n    if (a[i] > max) {\n        max = a[i];\n    }\n}",
    ask: "What is the final value of max?",
    options: ["3", "4", "9", "16"],
    correct: "C",
    explanation: "max starts at 3. i=1: 9 > 3 → max = 9. i=2: 4 > 9 is false. Final max = 9.",
    check: { code: "int[] a = {3, 9, 4};\nint max = a[0];\nfor (int i = 1; i < a.length; i++) {\n    if (a[i] > max) {\n        max = a[i];\n    }\n}\nSystem.out.println(max);", expectedOutput: "9" }
  },
  {
    id: "algo-insertion",
    topic: "algorithms",
    difficulty: 3,
    code: "int[] a = {5, 2, 9};\nint key = a[1];\nint j = 0;\nwhile (j >= 0 && a[j] > key) {\n    a[j + 1] = a[j];\n    j--;\n}\na[j + 1] = key;",
    ask: "What does the array look like afterwards?",
    options: ["[5, 2, 9]", "[2, 5, 9]", "[5, 5, 9]", "[2, 9, 5]"],
    correct: "B",
    explanation: "One insertion-sort step with key = 2:<br>j=0: a[0]=5 > 2 → a[1] becomes 5 ([5, 5, 9]), j = −1<br>The loop ends (j < 0) and a[0] = key → [2, 5, 9].",
    check: { code: "int[] a = {5, 2, 9};\nint key = a[1];\nint j = 0;\nwhile (j >= 0 && a[j] > key) {\n    a[j + 1] = a[j];\n    j--;\n}\na[j + 1] = key;\nSystem.out.println(java.util.Arrays.toString(a));", expectedOutput: "[2, 5, 9]" }
  },
  {
    id: "algo-merge",
    topic: "algorithms",
    difficulty: 3,
    code: "int[] left = {1, 3};\nint[] right = {2, 4};\nint[] merged = new int[4];\nint i = 0, j = 0, k = 0;\nwhile (i < left.length && j < right.length) {\n    if (left[i] < right[j]) {\n        merged[k] = left[i]; i++;\n    } else {\n        merged[k] = right[j]; j++;\n    }\n    k++;\n}",
    ask: "What does merged contain when this while loop ends? (The real merge would then copy the leftovers.)",
    options: ["[1, 2, 3, 4]", "[1, 2, 3, 0]", "[1, 3, 2, 4]", "[2, 4, 0, 0]"],
    correct: "B",
    explanation: "The loop runs while both sides have elements:<br>k=0: 1<2 → take 1 (i=1)<br>k=1: 3>2 → take 2 (j=1)<br>k=2: 3<4 → take 3 (i=2)<br>Now i == left.length, so the loop stops with merged = [1, 2, 3, 0] — the leftover 4 still has to be copied, which is why merge needs a follow-up loop.",
    check: { code: "int[] left = {1, 3};\nint[] right = {2, 4};\nint[] merged = new int[4];\nint i = 0, j = 0, k = 0;\nwhile (i < left.length && j < right.length) {\n    if (left[i] < right[j]) {\n        merged[k] = left[i]; i++;\n    } else {\n        merged[k] = right[j]; j++;\n    }\n    k++;\n}\nSystem.out.println(java.util.Arrays.toString(merged));", expectedOutput: "[1, 2, 3, 0]" }
  },

  // ---------- Time complexity ----------
  {
    id: "compl-single",
    topic: "complexity",
    difficulty: 2,
    code: "int sum = 0;\nfor (int i = 0; i < numbers.length; i++) {\n    sum += numbers[i];\n}",
    ask: "What is the time complexity of summing an array of n numbers like this?",
    options: ["O(1)", "O(log n)", "O(n)", "O(n²)"],
    correct: "C",
    explanation: "The loop body runs once per element — n turns total — so the work grows linearly with n: O(n)."
  },
  {
    id: "compl-binary",
    topic: "complexity",
    difficulty: 3,
    code: "int left = 0;\nint right = a.length - 1;\nwhile (left <= right) {\n    int mid = (left + right) / 2;\n    if (a[mid] == target) return mid;\n    if (a[mid] < target) left = mid + 1;\n    else right = mid - 1;\n}",
    ask: "What is the time complexity of this binary search on a sorted array of n elements?",
    options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    correct: "B",
    explanation: "Every iteration halves the remaining range: n → n/2 → n/4 → … → 1. That takes about log₂(n) steps."
  },
  {
    id: "compl-pairs",
    topic: "complexity",
    difficulty: 3,
    code: "for (int i = 0; i < n; i++) {\n    for (int j = 0; j < n; j++) {\n        System.out.println(i + \",\" + j);\n    }\n}",
    ask: "How many lines does this print, in terms of n?",
    options: ["n", "2n", "n²", "log n"],
    correct: "C",
    explanation: "For each of the n values of i, the inner loop prints n lines: n × n = n² lines in total."
  }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { TOPICS, QUESTIONS };
}
