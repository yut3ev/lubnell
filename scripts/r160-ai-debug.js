// r160-ai-debug.js — dump raw agent responses for the two failing flows.
const BASE = "http://127.0.0.1:3000";

async function main() {
  const loginRes = await fetch(`${BASE}/api/admin/auth`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", username: "owner", password: "lubnel1234", verificationCode: "7777" }),
  });
  const setCookie = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie().join("; ") : "";
  const cookie = (setCookie.match(/lubnel_admin_session=[^;]+/) || [])[0];
  const H = { "Content-Type": "application/json", cookie };

  const agent = async (message, mode) => {
    const res = await fetch(`${BASE}/api/admin/ai`, {
      method: "POST", headers: H,
      body: JSON.stringify({ message, history: [], mode, images: [] }),
    });
    return res.json().catch(() => ({ parse: "error" }));
  };

  console.log("=== get_catalog raw ===");
  console.log(JSON.stringify(await agent("دوريلي على منتجات بوكس", "execute"), null, 1).slice(0, 1200));
  console.log("=== plan mode raw ===");
  console.log(JSON.stringify(await agent("أضيفي منتج اسمه فحص R160 — القسم Makeup — السعر 111", "plan"), null, 1).slice(0, 1200));
}

main().catch(e => { console.error("DEBUG-ERR", e.message); process.exit(1); });
