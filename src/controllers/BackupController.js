const User = require("../models/User");
const UserBackup = require("../models/UserBackup");

class BackupController {
  async exec(req, res) {
    try {
      console.log("Rodando job de backup");

      const users = await User.find({});

      console.log("deletando todos os documentos do backup");
      await UserBackup.deleteMany({});

      console.log("populando collection de backup");
      for (const user of users) {
        let { email, name, admin, config, password, createdAt, updatedAt } =
          user;

        if (!config) config = {};

        updatedAt = new Date();

        const newUser = {
          email,
          name,
          admin,
          config,
          password,
          createdAt,
          updatedAt,
        };
        await UserBackup.create(newUser);
      }

      return res.json({ ok: true });
    } catch (error) {
      console.error("ERROR ON RUN JOB ", error);
      return res.status(500).json({ ok: false, error });
    }
  }
}

module.exports = new BackupController();
