// Compiles the Claude Design component (Main.dc.html) into plain JS:
// a render function per top-level block ("chunk"), plus the component logic.
// The output runs both in Node (pre-rendering) and in the browser (updates).
const { parseDocument } = require('htmlparser2');

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;

function splitHoles(str) {
  const parts = [];
  let last = 0;
  str.replace(HOLE, (m, p, idx) => {
    if (idx > last) parts.push({ s: str.slice(last, idx) });
    parts.push({ h: p.trim() });
    last = idx + m.length;
    return m;
  });
  if (last < str.length) parts.push({ s: str.slice(last) });
  return parts;
}

const lit = (s) => JSON.stringify(s);
const look = (p, sv) => (p === 'true' ? 'true' : p === 'false' ? 'false' : `L(${sv},${lit(p)})`);

function compileTemplate(src) {
  let body = src.split('<x-dc>')[1].split('</x-dc>')[0];
  const helmet = body.split('<helmet>')[1].split('</helmet>')[0];
  body = body.replace(/<helmet>[\s\S]*?<\/helmet>/, '');
  const js = src.split(/<script type="text\/x-dc"[^>]*>/)[1].split('</script>')[0];
  const propsMatch = src.match(/data-props='([^']*)'/) || src.match(/data-props="([^"]*)"/);
  const propDefs = propsMatch ? JSON.parse(propsMatch[1].replace(/&quot;/g, '"')) : {};

  const doc = parseDocument(body, { lowerCaseAttributeNames: false, lowerCaseTags: false, recognizeSelfClosing: true, decodeEntities: false });
  const tags = (n) => (n.children || []).filter((c) => c.type === 'tag');
  const root = tags(doc)[0];
  const page = tags(root).find((c) => /\bta-page\b/.test(c.attribs.class || ''));
  const afterPage = tags(root).filter((c) => c !== page);

  let varN = 0;
  function genNodes(nodes, sv, ctx) {
    let code = '';
    for (const n of nodes) code += genNode(n, sv, ctx);
    return code;
  }
  function genText(str, sv) {
    let code = '';
    for (const p of splitHoles(str)) code += p.s != null ? `o+=${lit(p.s)};` : `o+=T(${look(p.h, sv)});`;
    return code;
  }
  function genNode(n, sv, ctx) {
    if (n.type === 'text') return genText(n.data, sv);
    if (n.type === 'comment' || n.type === 'directive') return '';
    if (n.type !== 'tag' && n.type !== 'script' && n.type !== 'style') return '';
    const name = n.name;
    const a = n.attribs || {};
    if (name === 'sc-if') {
      const p = (a.value || '').replace(HOLE, '$1').trim();
      return `if(${look(p, sv)}){${genNodes(n.children, sv, ctx)}}`;
    }
    if (name === 'sc-for') {
      const p = (a.list || '').replace(HOLE, '$1').trim();
      const as = a.as || 'item';
      const v = 's' + ++varN, arr = 'a' + varN, i = 'i' + varN;
      return `{const ${arr}=${look(p, sv)}||[];for(let ${i}=0;${i}<${arr}.length;${i}++){const ${v}=Object.create(${sv});${v}[${lit(as)}]=${arr}[${i}];${v}.$index=${i};${genNodes(n.children, v, ctx)}}}`;
    }
    let code = `o+=${lit('<' + name)};`;
    let selVar = null;
    let textareaVal = null;
    const isImg = name === 'img';
    for (const [k, raw] of Object.entries(a)) {
      if (k.startsWith('hint-')) continue;
      if (k === 'onClick' || k === 'onChange') {
        const p = raw.replace(HOLE, '$1').trim();
        const ev = k === 'onClick' ? 'click' : name === 'select' ? 'change' : 'input';
        code += `{const h=H(${look(p, sv)});if(h!=='')o+=' data-h-${ev}="'+h+'"';}`;
        continue;
      }
      if (name === 'textarea' && k === 'value') { textareaVal = raw; continue; }
      if (isImg && k === 'src') {
        const parts = splitHoles(raw);
        const expr = parts.map((p) => (p.s != null ? lit(p.s) : `S2(${look(p.h, sv)})`)).join('+') || "''";
        code += `o+=IMG(${expr},${lit(a.class || '')});`;
        continue;
      }
      if (name === 'source' && k === 'srcset') {
        const parts = splitHoles(raw);
        const expr = parts.map((p) => (p.s != null ? lit(p.s) : `S2(${look(p.h, sv)})`)).join('+') || "''";
        code += `o+=SRCSET(${expr});`;
        continue;
      }
      if (name === 'select' && k === 'value') {
        selVar = 'sv' + ++varN;
        const parts = splitHoles(raw);
        const expr = parts.map((p) => (p.s != null ? lit(p.s) : `S2(${look(p.h, sv)})`)).join('+') || "''";
        code += `const ${selVar}=${expr};o+=' data-value="'+A(${selVar})+'"';`;
        continue;
      }
      const parts = splitHoles(raw);
      const aria = k.startsWith('aria-');
      if (parts.length === 1 && parts[0].h != null) {
        const vv = 'v' + ++varN;
        code += `{const ${vv}=${look(parts[0].h, sv)};if(${vv}!=null&&(${vv}!==false||${aria})&&typeof ${vv}!=='function')o+=${lit(' ' + k + '="')}+A(${vv})+'"';}`;
      } else if (parts.some((p) => p.h != null)) {
        code += `o+=${lit(' ' + k + '="')};` + parts.map((p) => (p.s != null ? `o+=${lit(p.s.replace(/"/g, '&quot;'))};` : `o+=A(S2(${look(p.h, sv)}));`)).join('') + `o+='"';`;
      } else {
        code += raw === '' && !['alt', 'value'].includes(k) ? `o+=${lit(' ' + k)};` : `o+=${lit(' ' + k + '="' + raw.replace(/"/g, '&quot;') + '"')};`;
      }
    }
    if (name === 'option' && ctx.sel) {
      const ov = a.value != null ? a.value : (n.children || []).map((c) => c.data || '').join('');
      code += `if(String(${ctx.sel})===${lit(ov)})o+=' selected';`;
    }
    code += `o+='>';`;
    if (VOID.has(name)) return code;
    if (name === 'textarea') {
      if (textareaVal != null) {
        const parts = splitHoles(textareaVal);
        code += parts.map((p) => (p.s != null ? `o+=${lit(p.s)};` : `o+=T(${look(p.h, sv)});`)).join('');
      }
    } else {
      const c2 = selVar ? { ...ctx, sel: selVar } : ctx;
      code += genNodes(n.children, sv, c2);
    }
    code += `o+=${lit('</' + name + '>')};`;
    return code;
  }

  const openTag = (n) => '<' + n.name + Object.entries(n.attribs).filter(([k]) => !k.startsWith('hint-')).map(([k, v]) => ` ${k}="${v.replace(/"/g, '&quot;')}"`).join('') + '>';
  for (const n of [root, page]) if (/\{\{/.test(openTag(n))) throw new Error('dynamic root attributes are not supported: ' + openTag(n));

  const chunkNodes = [...tags(page), ...afterPage];
  // Keep sc-if/sc-for wrappers as whole chunks; whitespace between chunks is dropped.
  const chunks = chunkNodes.map((n) => `function(S,H){let o='';${genNode(n, 'S', {})}return o;}`);
  const inPage = tags(page).length;

  const moduleCode = `
const L=(s,p)=>{const k=p.split('.');let v=s;for(let i=0;i<k.length;i++){if(v==null)return undefined;v=v[k[i]];}return v;};
const ESC=/[&<>"]/g, EM={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'};
const S2=(v)=>v==null||typeof v==='function'?'':String(v);
const T=(v)=>v==null||v===false||v===true||typeof v==='function'?'':String(v).replace(ESC,(c)=>EM[c]);
const A=(v)=>S2(v).replace(ESC,(c)=>EM[c]);
let IMG=(src,cls)=>' src="'+A(src)+'"';
let SRCSET=(src)=>' srcset="'+A(src)+'"';
export function setImg(f,g){IMG=f;if(g)SRCSET=g;}
export const CHUNKS=[${chunks.join(',\n')}];
export const IN_PAGE=${inPage};
export const ROOT_OPEN=${lit(openTag(root))};
export const PAGE_OPEN=${lit(openTag(page))};
export const PROP_DEFAULTS=${JSON.stringify(Object.fromEntries(Object.entries(propDefs).filter(([k]) => !k.startsWith('$')).map(([k, v]) => [k, v.default])))};
export function makeComponent(DCLogic){
${js}
;return Component;}
`;
  return { moduleCode, helmet, chunkCount: chunks.length, inPage };
}

module.exports = { compileTemplate };
