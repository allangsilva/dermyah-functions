const Yup = require("yup");
const bcryptjs = require("bcryptjs");

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
      id: user.id,
      _id: user.id,
      email: emailLowerCase,
      name,
      config: user.config,
      admin: true,
    });
  }

  async get(req, res) {
    try {
      const { query } = req.query;

      console.log("[User.get] - query ", query);

      let users = await User.find({});
      if (query) {
        const needle = query.toLowerCase();
        users = users.filter(
          (user) =>
            user.name?.toLowerCase() === needle ||
            user.email?.toLowerCase() === needle
        );
      }

      return res.json(users);
    } catch (error) {
      console.error("[User.Get] ERROR - ", error);
      return res.status(500).json({ message: "Erro ao listar usuários" });
    }
  }

  async getById(req, res) {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    return res.json(user);
  }

  async update(req, res) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);

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

        if (admin !== undefined) {
          user.admin = admin;
        }

        await user.save();
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
      console.log("[User.updateWebserver] - webserver ", webserver);

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      if (!user.config) user.config = {};

      // Updating the webserver IP means the device is now connecting over
      // IP, whether it had no connectionType yet or was previously BLUETOOTH.
      user.config = { ...user.config, webserver, connectionType: "IP" };

      await user.save();

      return res.json(user);
    } catch (error) {
      console.error("[User.updateWebserver] ERROR - ", error);
      return res.status(500).json({ message: "Erro ao atualizar IP" });
    }
  }
}

module.exports = new UserController();
