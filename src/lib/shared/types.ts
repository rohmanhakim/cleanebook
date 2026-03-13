// TypeScript types matching DB schema

export type UserRole = 'user' | 'admin';
export type UserPlan = 'anonymous' | 'free' | 'reader' | 'collector';
export type JobStatus =
	| 'queued'
	| 'processing'
	| 'needs_review'
	| 'resuming'
	| 'complete'
	| 'failed'
	| 'cancelled';

export type RegionLabel =
	| 'chrome' // header/footer/page numbers → IGNORE
	| 'content' // main body text → OCR
	| 'heading' // chapter/section title → OCR as heading
	| 'figure' // image/illustration → CROP as image
	| 'caption' // figure caption → OCR as caption
	| 'code' // code block → OCR as <pre>
	| 'footnote'; // footnote → OCR as footnote

export type RegionAction =
	| 'ignore'
	| 'ocr'
	| 'ocr-heading'
	| 'crop-image'
	| 'ocr-code'
	| 'ocr-caption'
	| 'ocr-footnote';

export interface RegionRule {
	id: string;
	label: RegionLabel;
	action: RegionAction;
	match: {
		// Geometric signals (from PDF.js getTextContent)
		yRange?: [number, number]; // normalized 0–1 (y / pageHeight)
		xRange?: [number, number]; // normalized 0–1 (x / pageWidth)
		fontSizeRatio?: [number, number]; // ratio to page median font size
		fontNames?: string[]; // e.g. ['Times-Bold', 'Helvetica-Bold']
		// Visual signals (fallback for scanned PDFs)
		visualSimilarityThreshold?: number; // 0.0–1.0
		sampleRegionBounds?: {
			// pixel coords on sample page
			x: number;
			y: number;
			w: number;
			h: number;
		};
	};
	confidence: number; // 1.0 = user-confirmed, 0.0–0.9 = inferred
}

export interface Template {
	id: string;
	userId: string;
	name: string;
	description: string | null;
	rules: RegionRule[];
	samplePageIndex: number;
	isPublic: boolean;
	useCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface Job {
	id: string;
	userId: string;
	status: JobStatus;
	pdfKey: string;
	epubKey: string | null;
	templateId: string | null;
	pdfPageCount: number;
	pdfFilename: string;
	errorMessage: string | null;
	reviewPages: number[] | null; // page indexes needing user review
	pipelineStep: string | null;
	ocrModel: string;
	layoutModel: string;
	createdAt: string;
	updatedAt: string;
}

export interface User {
	id: string;
	email: string;
	name: string;
	role: UserRole;
	plan: UserPlan;
	isAnonymous: boolean;
	hfApiKeyEncrypted: string | null;
	polarCustomerId: string | null;
	conversionsThisMonth: number;
	conversionsTotal: number;
	conversionsResetAt: string;
	createdAt: string;
}

export interface Session {
	id: string;
	userId: string;
	expiresAt: Date;
}

export interface OAuthAccount {
	providerId: 'github' | 'google';
	providerUserId: string;
	userId: string;
}