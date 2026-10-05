const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");
// Temporary local-only page: exercises real components without submitting content.
const route = "app/comment-layout-check";
assert.ok(!fs.existsSync(route), "Do not overwrite an existing route");
fs.mkdirSync(route);
fs.writeFileSync(`${route}/page.tsx`, `
import { CommentThread } from "../components/CommentThread";
import { CommentForm } from "../components/CommentForm";
export default function Page() {
 const comments = Array.from({length:10}, (_, i) => ({id:"layout-"+i,parentId:i?"layout-"+(i-1):null,text:i===0?"Nice work. How did you build the community feed?":i===1?"It uses the communities you have joined. The server checks access before saving each reply.":i===4?"https://example.com/"+"long".repeat(60):"A deeper reply keeps the conversation connected.",userId:"qa",User:{userName:i%2?"community-member":"un1on"},createdAt:new Date("2026-10-05T12:00:00Z"),editedAt:null,deletedAt:null,removedAt:null}));
 return <main className="mx-auto max-w-2xl p-4"><h1 className="text-xl font-semibold">Community conversations</h1><CommentForm postId="layout-post"/><h2 className="mt-6 border-t pt-5 font-semibold">Discussion</h2><CommentThread comments={comments} postId="layout-post" userId="qa" canReply={true}/></main>;
}`);
async function main() {
 const browser = await chromium.launch({channel:"msedge"});
 fs.mkdirSync(".backups/ui", {recursive:true});
 try {
  for (const [name,width,height,theme] of [["desktop",1440,1000,"dark"],["mobile",390,844,"light"]]) {
   const page = await browser.newPage({viewport:{width,height}});
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.addInitScript(value=>localStorage.setItem("theme",value),theme);
   await page.goto("http://localhost:3000/comment-layout-check");
   await page.waitForLoadState("networkidle");
   const root=page.locator("#comment-layout-0");
   const reply=root.getByRole("button",{name:"Reply",exact:true}).first();
   await reply.click();
   const field=page.getByRole("textbox",{name:"Your reply",exact:true});
   assert.ok((await field.boundingBox()).width >= (width===390?280:520), "Reply composer should use the comment column");
   assert.equal(await field.evaluate(el=>el===document.activeElement),true);
   await field.fill("Retained reply draft");
   await page.getByRole("button",{name:"Cancel",exact:true}).click();
   assert.equal(await field.count(),0);
   assert.equal(await reply.evaluate(el=>el===document.activeElement),true,"Cancel returns keyboard focus to Reply");
   await reply.click();assert.equal(await field.inputValue(),"Retained reply draft");
   await page.getByRole("button",{name:"Cancel",exact:true}).click();
   const deep=page.locator("#comment-layout-8");
   await deep.getByRole("button",{name:"Reply",exact:true}).click();
   assert.ok((await field.boundingBox()).width >= (width===390?190:430),"Deep replies remain readable");
   await page.getByRole("button",{name:"Cancel",exact:true}).click();
   await root.locator(":scope > summary").click();assert.equal(await page.locator("#comment-layout-1").isVisible(),false);
   await root.locator(":scope > summary").press("Enter");assert.equal(await page.locator("#comment-layout-1").isVisible(),true);
   await reply.click();
   await page.screenshot({path:`.backups/ui/comment-layout-${name}.png`,fullPage:true,animations:"disabled"});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"No horizontal overflow");
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log("Comment layout passed: full-width composers, focus, Cancel/draft retention, deep nesting, keyboard collapse and mobile overflow.");
 } finally { await browser.close(); }
}
main().finally(()=>fs.rmSync(route,{recursive:true})).catch(e=>{console.error(e);process.exitCode=1;});
