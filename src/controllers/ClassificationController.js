const FaceDetectionService = require("../services/FaceDetectionService");
const FileStorageService = require("../services/FileStorageService");

class ClassificationController {
  async classifyFace(req, res) {
    const { imagePath } = req.body;
    try {
      const faceDetectionService = new FaceDetectionService();
      const classification = await faceDetectionService.execute({ imagePath });

      if (classification.status === 200) {
        // deleta o arquivo em paralelo
        const fileService = new FileStorageService();
        fileService.delete(imagePath);
      }

      return res.status(classification.status).json(classification);
    } catch (ex) {
      console.error("ERROR ON ClassifyFace - ", ex);
      return res.status(500).json({ error: true, message: "Erro interno" });
    }
  }
}

module.exports = new ClassificationController();
