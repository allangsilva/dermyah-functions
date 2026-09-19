require("dotenv").config();

const bcryptjs = require("bcryptjs");

const User = require("../models/User");

const DEV_EMAIL = "allan@dermyah.com";
const DEV_PASSWORD = "asd123";

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error(
      `[seedDevUser] Refusing to run: FIRESTORE_EMULATOR_HOST is not set. ` +
        "This script is for dev/local use only, against the Firestore emulator."
    );
    process.exit(1);
  }

  const password = await bcryptjs.hash(DEV_PASSWORD, 8);

  let user = await User.findOne({ email: DEV_EMAIL });

  if (user) {
    user.email = DEV_EMAIL;
    user.password = password;
    user.name = "Allan (dev)";
    user.admin = true;
    await user.save();
  } else {
    user = await User.create({
      email: DEV_EMAIL,
      password,
      name: "Allan (dev)",
      admin: true,
      config: { connectionType: "BLUETOOTH" },
    });
  }

  console.log(`[seedDevUser] Seeded dev user: ${user.email} (password: ${DEV_PASSWORD})`);
}

main().catch((error) => {
  console.error("[seedDevUser] Failed to seed dev user:", error);
  process.exit(1);
});
