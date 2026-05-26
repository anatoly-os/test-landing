// Generate an ADMIN_PASSWORD_HASH for production use.
//   node bin/set-password.js "your-password"
import { hashPassword } from "../lib/auth.js";

const pw = process.argv[2];
if (!pw) {
  console.error('Usage: node bin/set-password.js "your-password"');
  process.exit(1);
}
console.log("\nAdd this line to dnevnik/.env on the server:\n");
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(pw)}\n`);
