import React from "react";

// Ответ ИИ — простой текст с «**жирным**» и списками. Разбираем сами и строим элементы React: HTML из ответа не вставляется никогда.
const inline = (text: string): React.ReactNode[] =>
	text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong> : <React.Fragment key={i}>{part}</React.Fragment>));

export default function Markdown({ text }: { text: string }) {
	const blocks: React.ReactNode[] = [];
	let list: string[] = [];
	const flush = () => {
		if (list.length) blocks.push(<ul key={`l${blocks.length}`} className="my-6 list-disc pl-20">{list.map((li, i) => <li key={i}>{inline(li)}</li>)}</ul>);
		list = [];
	};
	for (const raw of text.split("\n")) {
		const line = raw.trimEnd();
		const item = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
		if (item) list.push(item[1]);
		else {
			flush();
			if (line.trim()) blocks.push(<p key={`p${blocks.length}`} className="my-6">{inline(line.replace(/^#{1,4}\s+/, ""))}</p>);
		}
	}
	flush();
	return <>{blocks}</>;
}
