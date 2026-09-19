module.exports = {
  faceShapeModel: "gemini-flash-latest",
  useEnterprise: process.env.GOOGLE_GENAI_USE_ENTERPRISE === "true",
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION,
};
