const Minio = require("minio");
const path = require("path");
const crypto = require("crypto");

class MinIOService {
  constructor() {
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || "localhost",
      port: parseInt(process.env.MINIO_PORT) || 9000,
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
      secretKey: process.env.MINIO_SECRET_KEY || "minioadmin123",
    });

    this.bucketName = process.env.MINIO_BUCKET || "Errorlytic-uploads";
    this.initializeBucket();
  }

  async initializeBucket() {
    try {
      const exists = await this.client.bucketExists(this.bucketName);
      if (!exists) {
        await this.client.makeBucket(this.bucketName, "us-east-1");
        console.log(
          `✅ MinIO bucket '${this.bucketName}' created successfully`
        );
      } else {
        console.log(`✅ MinIO bucket '${this.bucketName}' already exists`);
      }
    } catch (error) {
      console.error("❌ Error initializing MinIO bucket:", error);
    }
  }

  /**
   * Generate a unique file key for uploads
   * @param {string} originalName - Original filename
   * @param {string} userId - User ID
   * @param {string} orgId - Organization ID (optional)
   * @returns {string} Unique file key
   */
  generateFileKey(originalName, userId, orgId = null) {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString("hex");
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);

    // Create organized folder structure: orgId/userId/timestamp-randomString.ext
    const folder = orgId ? `${orgId}/${userId}` : `individual/${userId}`;
    return `${folder}/${timestamp}-${randomString}-${baseName}${extension}`;
  }

  /**
   * Upload file to MinIO
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} fileKey - File key/path
   * @param {string} mimeType - MIME type
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Upload result
   */
  async uploadFile(fileBuffer, fileKey, mimeType, metadata = {}) {
    try {
      const uploadResult = await this.client.putObject(
        this.bucketName,
        fileKey,
        fileBuffer,
        fileBuffer.length,
        {
          "Content-Type": mimeType,
          ...metadata,
        }
      );

      return {
        success: true,
        key: fileKey,
        bucket: this.bucketName,
        size: fileBuffer.length,
        etag: uploadResult.etag,
        url: this.getFileUrl(fileKey),
      };
    } catch (error) {
      console.error("❌ Error uploading file to MinIO:", error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Get file URL (presigned URL for private access)
   * @param {string} fileKey - File key
   * @param {number} expiry - URL expiry in seconds (default: 1 hour)
   * @returns {Promise<string>} Presigned URL
   */
  async getFileUrl(fileKey, expiry = 3600) {
    try {
      return await this.client.presignedGetObject(
        this.bucketName,
        fileKey,
        expiry
      );
    } catch (error) {
      console.error("❌ Error generating file URL:", error);
      throw new Error(`Failed to generate file URL: ${error.message}`);
    }
  }

  /**
   * Delete file from MinIO
   * @param {string} fileKey - File key
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(fileKey) {
    try {
      await this.client.removeObject(this.bucketName, fileKey);
      return true;
    } catch (error) {
      console.error("❌ Error deleting file from MinIO:", error);
      return false;
    }
  }

  /**
   * Get file metadata
   * @param {string} fileKey - File key
   * @returns {Promise<Object>} File metadata
   */
  async getFileMetadata(fileKey) {
    try {
      const stat = await this.client.statObject(this.bucketName, fileKey);
      return {
        size: stat.size,
        etag: stat.etag,
        lastModified: stat.lastModified,
        contentType: stat.metaData["content-type"],
        metadata: stat.metaData,
      };
    } catch (error) {
      console.error("❌ Error getting file metadata:", error);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  /**
   * List files in a folder
   * @param {string} prefix - Folder prefix
   * @returns {Promise<Array>} List of files
   */
  async listFiles(prefix = "") {
    try {
      const objectsList = [];
      const stream = this.client.listObjects(this.bucketName, prefix, true);

      return new Promise((resolve, reject) => {
        stream.on("data", (obj) => {
          objectsList.push({
            name: obj.name,
            size: obj.size,
            lastModified: obj.lastModified,
            etag: obj.etag,
          });
        });

        stream.on("end", () => {
          resolve(objectsList);
        });

        stream.on("error", (error) => {
          reject(error);
        });
      });
    } catch (error) {
      console.error("❌ Error listing files:", error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Get file content from MinIO
   * @param {string} fileKey - File key
   * @returns {Promise<string>} File content as string
   */
  async getFileContent(fileKey) {
    try {
      const dataStream = await this.client.getObject(this.bucketName, fileKey);

      return new Promise((resolve, reject) => {
        const chunks = [];
        dataStream.on('data', (chunk) => {
          chunks.push(chunk);
        });
        dataStream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer.toString('utf-8'));
        });
        dataStream.on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      console.error("❌ Error getting file content from MinIO:", error);
      throw new Error(`Failed to get file content: ${error.message}`);
    }
  }

  /**
   * Check if file exists
   * @param {string} fileKey - File key
   * @returns {Promise<boolean>} File existence
   */
  async fileExists(fileKey) {
    try {
      await this.client.statObject(this.bucketName, fileKey);
      return true;
    } catch (error) {
      if (error.code === "NotFound") {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get storage usage statistics
   * @returns {Promise<Object>} Storage statistics
   */
  async getStorageStats() {
    try {
      const objectsList = await this.listFiles();
      const totalSize = objectsList.reduce((sum, obj) => sum + obj.size, 0);
      const fileCount = objectsList.length;

      return {
        totalSize,
        fileCount,
        totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
        totalSizeGB: Math.round((totalSize / (1024 * 1024 * 1024)) * 100) / 100,
      };
    } catch (error) {
      console.error("❌ Error getting storage stats:", error);
      throw new Error(`Failed to get storage stats: ${error.message}`);
    }
  }
}

module.exports = new MinIOService();
