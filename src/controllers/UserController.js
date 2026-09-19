const Yup = require("yup");
const bcryptjs = require("bcryptjs");
const mongoose = require("mongoose");

const User = require("../models/User");

class UserController {
  async create(req, res) {
    const schema = Yup.object().shape({
      name: Yup.string().required(),
      email: Yup.string().email().required(),
      password: Yup.string().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res
        .status(400)
        .json({ message: "Erro na validação dos campos enviados" });
    }

    const { email, password, name, config } = req.body;
    const emailLowerCase = email.toLowerCase();

    const userExists = await User.findOne({ email: emailLowerCase });

    if (userExists) {
      return res.status(400).json({ message: "Usuário já existe" });
    }

    let user = {
      email: emailLowerCase,
      password: await bcryptjs.hash(password, 8),
      name,
      config: config || { connectionType: "BLUETOOTH" },
    };

    user = await User.create(user);

    return res.json({
      id: user._id,
      email: emailLowerCase,
      name,
      config: user.config,
      admin: true,
    });
  }

  async get(req, res) {
    try {
      const { query } = req.query;

      let conditions = {};
      if (query) {
        conditions = {
          $or: [
            { name: new RegExp("^" + query + "$", "i") },
            { email: new RegExp("^" + query + "$", "i") },
          ],
        };
      }

      console.log("[User.get] - conditions ", conditions);

      const users = await User.find(conditions);
      return res.json(users);

      // return res.json(users.map(user => {
      //     const { id, name, email, createdAt, config } = user;
      //     return { id, name, email, createdAt, config };
      // }));
    } catch (error) {
      console.error("[User.Get] ERROR - ", error);
      return res.status(500).json({ message: "Erro ao listar usuários" });
    }
  }

  async getById(req, res) {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "ID do usuário inválido" });
    }

    const user = await User.findById(mongoose.Types.ObjectId(id));

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    return res.json(user);
  }

  async update(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID do usuário inválido" });
      }

      const user = await User.findById(mongoose.Types.ObjectId(id));

      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      if (req.body) {
        const { email, password, confirmPassword, name, config, admin } =
          req.body;

        if (email && email !== user.email) {
          console.log(`[user.update] - updating email to ${email}`);
          const existsByMail = await User.findOne({ email });
          console.log(`[user.update] - existsByMail ${existsByMail}`);
          if (existsByMail) {
            return res
              .status(400)
              .json({ error: true, message: "Usuário já existe" });
          }

          user.email = email;
        }

        if (password && confirmPassword && password === confirmPassword) {
          console.log(`[user.update] - updating password...`);
          user.password = await bcryptjs.hash(password, 8);
        }

        if (name && name !== user.name) {
          console.log(`[user.update] - updating name to ${name}`);
          user.name = name;
        }

        if (config) {
          console.log(
            `[user.update] - updating config to ${JSON.stringify(config)}`
          );
          user.config = { ...user.config, ...config };
        } else {
          user.config = {};
        }

        user.admin = admin;

        user.save();
      }

      return res.json(user);
    } catch (error) {
      console.error("[User.Update] ERROR - ", error);
      return res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  }

  async updateWebserver(req, res) {
    try {
      const { userId } = req.headers;
      const { webserver } = req.body;

      const user = await User.findById(mongoose.Types.ObjectId(userId));

      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      if (!user.config) user.config = {};

      user.config = { ...user.config, webserver };

      await user.save();

      return res.json(user);
    } catch (error) {
      console.error("[User.updateWebserver] ERROR - ", error);
      return res.status(500).json({ message: "Erro ao atualizar IP" });
    }
  }
}

module.exports = new UserController();
