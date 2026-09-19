const { format } = require("util");
const { Storage } = require("@google-cloud/storage");
const credentials = require("../../firebaseServiceAccount.json");

const BUCKET_NAME = (
  process.env.GCS_BUCKET ||
  process.env.GCLOUD_STORAGE_BUCKET ||
  ""
).replace(/^gs:\/\//, "");

class FileStorageService {
  async upload(file) {
    return new Promise((resolve, reject) => {
      const bucket = new Storage({ credentials }).bucket(BUCKET_NAME);

      console.log(`uploading file ${file.originalname}`);
      // Create a new blob in the bucket and upload the file data.
      const blob = bucket.file(file.originalname);
      const blobStream = blob.createWriteStream();

      blobStream.on("error", (err) => {
        reject(err);
      });

      blobStream.on("finish", () => {
        // The public URL can be used to directly access the file via HTTP.
        const publicUrl = format(
          `https://storage.googleapis.com/${bucket.name}/${blob.name}`
        );
        resolve({
          name: blob.name,
          url: publicUrl,
        });
      });

      blobStream.end(file.buffer);
    });
  }

  async downloadBytes(key) {
    const storage = new Storage({ credentials });
    const [buffer] = await storage.bucket(BUCKET_NAME).file(key).download();
    const [metadata] = await storage
      .bucket(BUCKET_NAME)
      .file(key)
      .getMetadata();
    return { buffer, mimeType: metadata.contentType || "image/jpeg" };
  }

  async delete(key) {
    const storage = new Storage({ credentials });
    try {
      await storage.bucket(BUCKET_NAME).file(key).delete();
      console.log(`${BUCKET_NAME}/${key} --- deleted`);
    } catch (error) {
      console.log(`Error on delete file ${key}`, error);
      return error;
    }
  }
}

module.exports = FileStorageService;
