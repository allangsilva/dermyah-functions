const { format } = require("util");
const { Storage } = require("@google-cloud/storage");
const credentials = require("../../firebaseServiceAccount.json");

class FileStorageService {
  async upload(file) {
    return new Promise((resolve, reject) => {
      const bucket = new Storage().bucket(credentials.storageBucket);

      console.log(`uploading file ${file.filename}`);
      // Create a new blob in the bucket and upload the file data.
      const blob = bucket.file(file.originalname);
      const blobStream = blob.createWriteStream();

      blobStream.on("error", (err) => {
        next(err);
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
    const [buffer] = await storage
      .bucket(credentials.storageBucket)
      .file(key)
      .download();
    const [metadata] = await storage
      .bucket(credentials.storageBucket)
      .file(key)
      .getMetadata();
    return { buffer, mimeType: metadata.contentType || "image/jpeg" };
  }

  async delete(key) {
    const storage = new Storage({ credentials });
    try {
      await storage.bucket(credentials.storageBucket).file(key).delete();
      console.log(`${credentials.storageBucket}/${key} --- deleted`);
    } catch (error) {
      console.log(`Error on delete file ${key}`, error);
      return error;
    }
  }
}

module.exports = FileStorageService;
