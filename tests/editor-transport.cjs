const assert = require("node:assert/strict");
const { Schema } = require("@tiptap/pm/model");
const { load } = require("./load-ts.cjs");
// encodeReply does not load chunks; supply only its module-loader initialization hook.
global.__webpack_require__ = { u: () => "" };
const {
  encodeReply,
} = require("next/dist/compiled/react-server-dom-webpack/client.browser");
const { serializeEditorContent } = load("app/lib/editor-content.ts");
const validation = load("app/lib/validation.ts");
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    text: { group: "inline" },
    paragraph: { content: "inline*", group: "block" },
    heading: {
      content: "inline*",
      group: "block",
      attrs: { level: { default: 1 } },
    },
    orderedList: {
      content: "listItem+",
      group: "block",
      attrs: { start: { default: 1 } },
    },
    listItem: { content: "paragraph+" },
  },
  marks: { bold: {}, italic: {}, strike: {} },
});
async function main() {
  for (const level of [1, 2, 3]) {
    const text = schema.text(`Heading ${level}`, [
      schema.marks.bold.create(),
      schema.marks.italic.create(),
      schema.marks.strike.create(),
    ]);
    const raw = schema
      .node("doc", null, [schema.node("heading", { level }, [text])])
      .toJSON();
    assert.equal(Object.getPrototypeOf(raw.content[0].attrs), null);
    await assert.rejects(
      () => encodeReply([raw]),
      /null prototypes are not supported/,
    );
    const normalized = serializeEditorContent(raw);
    assert.deepEqual(
      JSON.parse(JSON.stringify(normalized)),
      JSON.parse(JSON.stringify(raw)),
    );
    await encodeReply([{ jsonContent: normalized }]);
    assert.equal(
      validation.postBody(normalized).textContent.content[0].attrs.level,
      level,
    );
    assert.equal(validation.postBody(normalized).bodyText, `Heading ${level}`);
  }
  const list = schema
    .node("doc", null, [
      schema.node("orderedList", { start: 1 }, [
        schema.node("listItem", null, [
          schema.node("paragraph", null, [schema.text("List item")]),
        ]),
      ]),
    ])
    .toJSON();
  await encodeReply([serializeEditorContent(list)]);
  assert.equal(
    validation.postBody(serializeEditorContent(list)).bodyText,
    "List item",
  );
  assert.equal(serializeEditorContent(null), null);
  assert.throws(
    () =>
      validation.postBody(
        serializeEditorContent({
          type: "doc",
          content: [{ type: "script", text: "unsafe" }],
        }),
      ),
    /Invalid/,
  );
  console.log(
    "Real ProseMirror H1/H2/H3 and list JSON survives React server-action encoding; validation remains enforced",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
