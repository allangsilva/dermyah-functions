require("dotenv").config();

const express = require("express");
const cors = require("cors");
const port = process.env.PORT || 3000;

const routes = require("./routers");

require("./database");

const app = express();

app.use(cors());
app.use(express.json());

app.use(routes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;
