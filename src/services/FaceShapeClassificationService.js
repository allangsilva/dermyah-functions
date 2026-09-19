const { GoogleGenAI } = require("@google/genai");
const genaiConfig = require("../config/genai");
const FileStorageService = require("./FileStorageService");
const {
  SHAPE_LABELS,
  EDGE_CASE_LABELS,
  FACE_SHAPE_RUBRIC,
  FACE_SHAPE_RESPONSE_SCHEMA,
} = require("../prompts/faceShapeRubric");

const RESPONSE = {
  success: (type, precision) => ({
    status: 200,
    classification: {
      status: "ok",
      type,
      precision: precision.toFixed(2),
    },
    success: true,
  }),
  domainError: (type) => ({
    status: 400,
    classification: { status: "error", type, precision: "0" },
    success: false,
  }),
  unavailable: () => ({
    status: 503,
    classification: {
      status: "error",
      type: "classification_unavailable",
      precision: "0",
    },
    success: false,
  }),
};

class FaceShapeClassificationService {
  async execute({ imagePath }) {
    let buffer, mimeType;
    try {
      const fileStorageService = new FileStorageService();
      ({ buffer, mimeType } = await fileStorageService.downloadBytes(
        imagePath
      ));
    } catch (error) {
      console.error("ERROR downloading image for classification -", error);
      return RESPONSE.unavailable();
    }

    let response;
    try {
      const ai = new GoogleGenAI({
        enterprise: genaiConfig.useEnterprise,
        project: genaiConfig.project,
        location: genaiConfig.location,
      });

      response = await ai.models.generateContent({
        model: genaiConfig.faceShapeModel,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: buffer.toString("base64"),
                  mimeType,
                },
              },
            ],
          },
        ],
        config: {
          systemInstruction: FACE_SHAPE_RUBRIC,
          responseMimeType: "application/json",
          responseSchema: FACE_SHAPE_RESPONSE_SCHEMA,
        },
      });
    } catch (error) {
      console.error("ERROR calling Gemini for classification -", error);
      return RESPONSE.unavailable();
    }

    let result;
    try {
      result = JSON.parse(response.text);
    } catch (error) {
      console.error("ERROR parsing Gemini classification response -", error);
      return RESPONSE.domainError("classification_failed");
    }

    if (!result || typeof result.shape !== "string") {
      return RESPONSE.domainError("classification_failed");
    }

    if (EDGE_CASE_LABELS.includes(result.shape)) {
      return RESPONSE.domainError(result.shape);
    }

    if (!SHAPE_LABELS.includes(result.shape)) {
      return RESPONSE.domainError("classification_failed");
    }

    const precision = Number(result.confidence);
    return RESPONSE.success(
      result.shape,
      Number.isFinite(precision) ? precision : 0
    );
  }
}

module.exports = FaceShapeClassificationService;
