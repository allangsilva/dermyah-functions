module.exports = {
  faceShapeModel: "gemini-2.5-flash",
  useEnterprise: process.env.GOOGLE_GENAI_USE_ENTERPRISE === "true",
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION,
};
