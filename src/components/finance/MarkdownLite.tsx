/** Sehr schlanke Darstellung für die Verfahrensdokumentation (Überschriften, Listen, Tabellen, Fettdruck). */
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="rounded bg-muted px-1 py-0.5 text-[11px]">{p.slice(1, -1)}</code>;
    return <span key={i}>{p}</span>;
  });
}

export function MarkdownLite({ content }: { content: string }) {
  const lines = content.split('\n');
  const out: JSX.Element[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();

    if (!t) { i++; continue; }

    if (t.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
        if (!cells.every(c => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        <div key={key++} className="my-3 overflow-x-auto">
          <table className="w-full text-xs border border-border/40">
            {head && <thead className="bg-muted/50"><tr>{head.map((c, j) => <th key={j} className="border border-border/40 p-2 text-left font-medium">{inline(c)}</th>)}</tr></thead>}
            <tbody>{body.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} className="border border-border/40 p-2 align-top">{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }

    if (t.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('- ')) { items.push(lines[i].trim().slice(2)); i++; }
      out.push(<ul key={key++} className="my-2 list-disc space-y-1 pl-5 text-sm">{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>);
      continue;
    }

    if (/^\d+\.\s/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+\.\s/, '')); i++; }
      out.push(<ol key={key++} className="my-2 list-decimal space-y-1 pl-5 text-sm">{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>);
      continue;
    }

    if (t.startsWith('### ')) out.push(<h4 key={key++} className="mt-4 text-sm font-semibold">{inline(t.slice(4))}</h4>);
    else if (t.startsWith('## ')) out.push(<h3 key={key++} className="mt-5 text-base font-semibold">{inline(t.slice(3))}</h3>);
    else if (t.startsWith('# ')) out.push(<h2 key={key++} className="mt-2 text-lg font-bold">{inline(t.slice(2))}</h2>);
    else out.push(<p key={key++} className="my-2 text-sm leading-relaxed text-muted-foreground">{inline(t)}</p>);
    i++;
  }

  return <div className="max-w-4xl">{out}</div>;
}

export default MarkdownLite;
