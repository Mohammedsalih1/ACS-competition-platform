import fs from "fs";
import { pipeline } from "stream/promises";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let s3ClientInstance = null;

export const isR2Configured = () => {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET_NAME,
  );
};

export const getR2Client = () => {
  if (!isR2Configured()) {
    return null;
  }

  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  return s3ClientInstance;
};

/**
 * Upload a local file to Cloudflare R2.
 * @param {object} params
 * @param {string} params.key - Destination key in R2 (e.g. submissions/<submissionId>/<fileId>.zip)
 * @param {string} params.filePath - Local file path to read
 * @param {string} [params.mimeType] - Content MIME type
 */
export const uploadFileToR2 = async ({ key, filePath, mimeType = "application/zip" }) => {
  const client = getR2Client();
  if (!client) {
    throw new Error("Cloudflare R2 is not configured");
  }

  const fileStream = fs.createReadStream(filePath);
  const fileStats = await fs.promises.stat(filePath);

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    Body: fileStream,
    ContentType: mimeType,
    ContentLength: fileStats.size,
  });

  await client.send(command);
  logger.info(`[R2] Successfully uploaded ${key} (${fileStats.size} bytes)`);
  return { key, size: fileStats.size };
};

/**
 * Get a readable stream for an object in Cloudflare R2.
 * @param {string} key
 * @returns {Promise<{ stream: import('stream').Readable, contentLength: number, contentType: string }>}
 */
export const downloadStreamFromR2 = async (key) => {
  const client = getR2Client();
  if (!client) {
    throw new Error("Cloudflare R2 is not configured");
  }

  const command = new GetObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
  });

  const response = await client.send(command);
  return {
    stream: response.Body,
    contentLength: response.ContentLength,
    contentType: response.ContentType,
  };
};

/**
 * Download an object from Cloudflare R2 to a local destination file.
 * @param {string} key
 * @param {string} destPath
 */
export const downloadFileFromR2 = async (key, destPath) => {
  const { stream } = await downloadStreamFromR2(key);
  const writeStream = fs.createWriteStream(destPath);
  await pipeline(stream, writeStream);
  logger.info(`[R2] Downloaded ${key} to ${destPath}`);
};

/**
 * Delete an object from Cloudflare R2.
 * @param {string} key
 */
export const deleteFileFromR2 = async (key) => {
  const client = getR2Client();
  if (!client) return;

  try {
    const command = new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    });
    await client.send(command);
    logger.info(`[R2] Deleted ${key}`);
  } catch (err) {
    logger.warn(`[R2] Failed to delete ${key}: ${err.message}`);
  }
};

/**
 * Check if an object exists in Cloudflare R2.
 * @param {string} key
 */
export const objectExistsInR2 = async (key) => {
  const client = getR2Client();
  if (!client) return false;

  try {
    const command = new HeadObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
    });
    await client.send(command);
    return true;
  } catch (err) {
    if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
};
