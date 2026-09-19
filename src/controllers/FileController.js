const FileStorageService = require("../services/FileStorageService");
class FileController {
  async upload(req, res) {
    if (!req.file) {
      res.status(400).send("No file uploaded.");
      return;
    }

    const fileService = new FileStorageService();
    try {
      const uploadResponse = await fileService.upload(req.file);
      res.send(uploadResponse);
    } catch (error) {
      console.error(error);
      res.send({ message: "erro ao carregar imagem", error });
    }
  }
}

module.exports = new FileController();
