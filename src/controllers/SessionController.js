const Yup = require("yup");
const jwt = require("jsonwebtoken");
const bcryptjs = require("bcryptjs");

const User = require("../models/User");
const authConfig = require("../config/auth");

class SessionController {
  async login(req, res) {
    const schema = Yup.object().shape({
      email: Yup.string().email().required(),
      password: Yup.string().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ message: "Validation fails" });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(400).json({ error: "User not exists" });
    }

    if (!(await bcryptjs.compare(password, user.password))) {
      return res.status(401).json({ error: "Password does not match" });
    }

    const { id, name, config } = user;

    return res.json({
      user: {
        id,
        _id: id,
        name,
        email: user.email,
        config,
      },
      token: jwt.sign({ userId: id }, authConfig.jwtSecret, {
        expiresIn: authConfig.jwtExpiresIn,
      }),
    });
  }

  async loginAdmin(req, res) {
    const schema = Yup.object().shape({
      email: Yup.string().email().required(),
      password: Yup.string().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ message: "Validation fails" });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ error: "Usuário não existe" });
    }

    if (!(await bcryptjs.compare(password, user.password))) {
      return res.status(401).json({ error: "Senha inválida" });
    }

    console.log("user admin", user);

    if (!user.admin) {
      return res
        .status(400)
        .json({ error: "Você não tem permissão para acessar esse recurso" });
    }

    const { id, name, config } = user;

    return res.json({
      user: {
        id,
        _id: id,
        name,
        email,
        config,
      },
      token: jwt.sign({ userId: id }, authConfig.jwtSecret, {
        expiresIn: authConfig.jwtExpiresIn,
      }),
    });
  }
}

module.exports = new SessionController();
