const axios = require("axios");
const config = require("../config/classification");

class FaceDetectionService {
  async execute({ imagePath }) {
    const { host, classificationResource } = config.classificationApi;
    const classifyFace = await axios.post(`${host}${classificationResource}`, {
      imageUrl: `https://storage.googleapis.com/dermyah/${imagePath}`,
    });

    const statusCode =
      classifyFace.status == 200 &&
      classifyFace.data.status !== "internal error"
        ? 200
        : 400;
    return {
      status: statusCode,
      classification: classifyFace.data,
      success: statusCode === 200,
    };
  }
}

module.exports = FaceDetectionService;
