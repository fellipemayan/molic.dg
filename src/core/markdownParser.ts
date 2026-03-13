import type {
	DocumentElement,
	DocumentationPage,
} from "../types/documentation";

export function parseMarkdown(content: string): DocumentElement[] {
	const lines = content.split("\n");
	const elements: DocumentElement[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];
		const trimmed = line.trim();

		// Skip empty lines
		if (!trimmed) {
			i++;
			continue;
		}

		// Headings
		if (trimmed.startsWith("####")) {
			elements.push({
				type: "heading4",
				content: trimmed.replace(/^#+\s*/, ""),
				level: 4,
			});
			i++;
		} else if (trimmed.startsWith("###")) {
			elements.push({
				type: "heading3",
				content: trimmed.replace(/^#+\s*/, ""),
				level: 3,
			});
			i++;
		} else if (trimmed.startsWith("##")) {
			elements.push({
				type: "heading2",
				content: trimmed.replace(/^#+\s*/, ""),
				level: 2,
			});
			i++;
		} else if (trimmed.startsWith("#")) {
			elements.push({
				type: "heading1",
				content: trimmed.replace(/^#+\s*/, ""),
				level: 1,
			});
			i++;
		}
		// Code blocks
		else if (trimmed.startsWith("```")) {
			const language = trimmed.slice(3).trim() || "molic";
			const codeLines: string[] = [];
			i++;

			while (i < lines.length && !lines[i].trim().startsWith("```")) {
				codeLines.push(lines[i]);
				i++;
			}

			// Verificar se é um diagram preview
			if (language === "diagram") {
				elements.push({
					type: "diagramPreview",
					content: codeLines.join("\n"),
					language: "diagram",
				});
			} else {
				elements.push({
					type: "codeblock",
					content: codeLines.join("\n"),
					language,
				});
			}

			i++; // Skip closing ```
		}
		// Alerts (blockquote style: > [!TYPE] message)
		else if (trimmed.startsWith(">")) {
			const alertMatch = trimmed.match(/>\s*\[!(\w+)\]\s*(.*)/);
			if (alertMatch) {
				const alertType = alertMatch[1].toLowerCase() as
					| "info"
					| "warning"
					| "success"
					| "error";
				let message = alertMatch[2];

				// Collect multi-line alert
				let j = i + 1;
				while (j < lines.length && lines[j].trim().startsWith(">")) {
					message += "\n" + lines[j].trim().replace(/^>\s*/, "");
					j++;
				}

				elements.push({
					type: "alert",
					content: message,
					alertType,
				});
				i = j;
			} else {
				i++;
			}
		}
		// Ordered lists (1. 2. 3.)
		else if (/^\d+\.\s/.test(trimmed)) {
			const listItems: DocumentElement[] = [];

			while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
				const itemContent = lines[i].trim().replace(/^\d+\.\s+/, "");
				listItems.push({
					type: "listitem",
					content: parseInlineElements(itemContent),
				});
				i++;
			}

			elements.push({
				type: "list",
				children: listItems,
				ordered: true,
			});
		}
		// Unordered lists (- or *)
		else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
			const listItems: DocumentElement[] = [];

			while (
				i < lines.length &&
				(lines[i].trim().startsWith("- ") ||
					lines[i].trim().startsWith("* "))
			) {
				const itemContent = lines[i].trim().slice(2);
				listItems.push({
					type: "listitem",
					content: parseInlineElements(itemContent),
				});
				i++;
			}

			elements.push({
				type: "list",
				children: listItems,
			});
		}
		// Paragraphs (with inline formatting)
		else {
			let paragraph = trimmed;
			i++;

			// Collect multi-line paragraphs
			while (
				i < lines.length &&
				lines[i].trim() &&
				!lines[i].trim().startsWith("#") &&
				!lines[i].trim().startsWith("```") &&
				!lines[i].trim().startsWith(">") &&
				!lines[i].trim().startsWith("-") &&
				!lines[i].trim().startsWith("*") &&
				!/^\d+\.\s/.test(lines[i].trim())
			) {
				paragraph += " " + lines[i].trim();
				i++;
			}

			elements.push({
				type: "paragraph",
				content: paragraph,
			});
		}
	}

	return elements;
}

function parseInlineElements(text: string): string {
	// Função que mantém compatibilidade com o renderizador
	// O renderizador (DocumentationRenderer) faz o parsing de:
	// - **bold**, __bold__
	// - *italic*, _italic_
	// - `code inline`
	// - [texto](url)
	// Aqui apenas retornamos o texto para processamento posterior
	return text;
}

export function parseMarkdownPage(
	content: string,
	id: string,
	title: string,
	slug: string,
): DocumentationPage {
	return {
		id,
		title,
		slug,
		elements: parseMarkdown(content),
	};
}
