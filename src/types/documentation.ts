export type DocumentElementType =
	| "heading1"
	| "heading2"
	| "heading3"
	| "heading4"
	| "paragraph"
	| "code"
	| "codeblock"
	| "list"
	| "listitem"
	| "alert"
	| "diagramPreview"
	| "link";

export interface DocumentElement {
	type: DocumentElementType;
	content?: string;
	children?: DocumentElement[];
	level?: number; // Para headings
	language?: string; // Para codeblocks
	href?: string; // Para links
	ordered?: boolean; // Para listas ordenadas
	alertType?: "info" | "warning" | "success" | "error"; // Para alerts
}

export interface DocumentationPage {
	id: string;
	title: string;
	slug: string;
	elements: DocumentElement[];
}

export interface DocumentationSection {
	id: string;
	title: string;
	pages: DocumentationPage[];
}
