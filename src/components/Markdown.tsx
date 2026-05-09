"use client";
/**
 * Hafif markdown render: paragraf, satır sonu, **kalın**, *italik*, `kod`,
 * - madde, # / ## başlık. Harici bağımlılık eklemeden chat için yeterli.
 */
import { ReactNode } from "react";

export default function Markdown({ text }: { text: string }) {
  const lines = (text || "").split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listBuf: string[] = [];

  function flushList(key: string) {
    if (listBuf.length === 0) return;
    blocks.push(
      <ul key={`ul-${key}`} className="list-disc pl-5 space-y-1 my-1">
        {listBuf.map((li, i) => (
          <li key={i}>{renderInline(li)}</li>
        ))}
      </ul>
    );
    listBuf = [];
  }

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const liMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (liMatch) {
      listBuf.push(liMatch[1]);
      return;
    }
    flushList(String(i));
    if (!line.trim()) {
      blocks.push(<div key={`sp-${i}`} className="h-1" />);
      return;
    }
    const h2 = line.match(/^##\s+(.*)$/);
    const h1 = line.match(/^#\s+(.*)$/);
    if (h2) {
      blocks.push(
        <h4 key={i} className="font-semibold mt-2">
          {renderInline(h2[1])}
        </h4>
      );
      return;
    }
    if (h1) {
      blocks.push(
        <h3 key={i} className="font-semibold text-base mt-2">
          {renderInline(h1[1])}
        </h3>
      );
      return;
    }
    blocks.push(
      <p key={i} className="my-1">
        {renderInline(line)}
      </p>
    );
  });
  flushList("end");

  return <div className="text-sm leading-relaxed">{blocks}</div>;
}

function renderInline(s: string): ReactNode {
  // **bold**, *italic*, `code` desteği
  const tokens: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(s))) {
    if (m.index > lastIndex) tokens.push(s.slice(lastIndex, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      tokens.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      tokens.push(
        <code key={key++} className="px-1 py-0.5 rounded bg-slate-100 text-[0.85em]">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("*")) {
      tokens.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    }
    lastIndex = m.index + tok.length;
  }
  if (lastIndex < s.length) tokens.push(s.slice(lastIndex));
  return tokens;
}
