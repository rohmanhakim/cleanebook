/**
 * R2 S3-compatible API client for presigned URL generation
 * R2 provides an S3-compatible API for generating presigned URLs
 * that allow clients to download files directly from R2
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PDF_PRESIGNED_URL_EXPIRY_SECONDS } from '$lib/shared/constants';

/**
 * Create S3 client for R2
 * R2 uses S3-compatible API with account-specific endpoint
 */
export function createR2Client(env: {
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
}): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Generate a presigned URL for downloading a PDF from R2
 * URL is valid for PDF_PRESIGNED_URL_EXPIRY_SECONDS seconds
 */
export async function generatePresignedUrl(
  client: S3Client,
  bucketName: string,
  key: string
): Promise<{ url: string; expiresAt: Date }> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const url = await getSignedUrl(client, command, {
    expiresIn: PDF_PRESIGNED_URL_EXPIRY_SECONDS,
  });

  const expiresAt = new Date(Date.now() + PDF_PRESIGNED_URL_EXPIRY_SECONDS * 1000);

  return { url, expiresAt };
}
