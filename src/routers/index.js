const express = require("express");
const Multer = require("multer");

const sessionController = require("../controllers/SessionController");
const userController = require("../controllers/UserController");
const fileController = require("../controllers/FileController");
const classificationController = require("../controllers/ClassificationController");
const printController = require("../controllers/PrintController");
const backupController = require("../controllers/BackupController");
const appVersionController = require("../controllers/AppVersionController");

const checkIfAdmin = require("../middlewares/admin");
const auth = require("../middlewares/auth");
const router = express.Router();
// Multer is required to process file uploads and make them available via
// req.files.
const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // no larger than 10mb, you can change as needed.
  },
});

router.get("/infra/backup", backupController.exec);

// public
router.post("/login", sessionController.login);
router.post("/admin/login", sessionController.loginAdmin);
router.post("/classify", classificationController.classifyFace);
router.post("/upload", multer.single("image"), fileController.upload);
router.get("/users/:id", userController.getById);

router.post("/print/save", printController.save);

router.get("/appversion/:platform?", appVersionController.get);

// only logged user
router.use(auth);

router.put("/users/webserver", userController.updateWebserver);

// only admin user
router.use(checkIfAdmin);

router.post("/users", userController.create);
router.get("/users", userController.get);

router.put("/users/:id", userController.update);

router.get("/print", printController.get);

router.put("/appversion", appVersionController.update);

module.exports = router;
