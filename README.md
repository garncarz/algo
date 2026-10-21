# Algorithms course

A helper for my tutoring of two groups on osu.cz. Accessible on https://garncarz.github.io/algo/.
Done with GitHub Copilot, using prompts discussed with ChatGPT.

## Java code-tracing quiz

[quiz.html](https://garncarz.github.io/algo/quiz.html) is a multiple-choice
"trace this Java code" quiz with an optional live classroom voting mode.

- **Standalone:** everything works without a backend; questions live in
  [questions.js](questions.js) (see its header comment for how to add more;
  `node --test questions.test.mjs` verifies every answer key by executing the
  snippets with a real Java).
- **Live mode:** an optional Flask backend in [backend/](backend/README.md)
  synchronizes one question across the class, collects anonymous votes, and
  lets the teacher reveal a histogram and the answer. The teacher authenticates
  via the ⚙ button in the footer; the projected screen never shows answers or
  results unless they are explicitly revealed.
