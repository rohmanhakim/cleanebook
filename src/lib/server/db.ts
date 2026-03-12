// D1 database query helpers
// Stub file - actual implementations will be added later

import type { D1Database } from '@cloudflare/workers-types';
import type { Job, User, Session, Template } from '$lib/shared/types';

// Always pass DB as first arg — never import platform directly in helpers

export async function getJobById(db: D1Database, id: string): Promise<Job | null> {
	// TODO: Implement
	console.log('getJobById stub called with:', id);
	return null;
}

export async function getJobsByUserId(db: D1Database, userId: string): Promise<Job[]> {
	// TODO: Implement
	console.log('getJobsByUserId stub called with:', userId);
	return [];
}

export async function createJob(
	db: D1Database,
	job: Omit<Job, 'createdAt' | 'updatedAt'>
): Promise<void> {
	// TODO: Implement
	console.log('createJob stub called with:', job.id);
}

export async function updateJobStatus(
	db: D1Database,
	id: string,
	status: Job['status'],
	extra?: Partial<Pick<Job, 'epubKey' | 'errorMessage' | 'reviewPages' | 'pipelineStep'>>
): Promise<void> {
	// TODO: Implement
	console.log('updateJobStatus stub called with:', id, status);
}

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
	// TODO: Implement
	console.log('getUserById stub called with:', id);
	return null;
}

export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
	// TODO: Implement
	console.log('getUserByEmail stub called with:', email);
	return null;
}

export async function getTemplateById(db: D1Database, id: string): Promise<Template | null> {
	// TODO: Implement
	console.log('getTemplateById stub called with:', id);
	return null;
}

export async function incrementUserConversions(db: D1Database, userId: string): Promise<void> {
	// TODO: Implement
	console.log('incrementUserConversions stub called with:', userId);
}