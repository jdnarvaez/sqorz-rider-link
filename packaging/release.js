const pkg = require("../package.json");
const bumpVersion = require("semver-increment");
const { exec } = require("child_process");
const { promisify } = require("util");
const { writeFileSync } = require("fs");
const execAsync = promisify(exec);

const runCommand = async (cmd) => {
  const { stderr, stdout } = await execAsync(cmd);

  if (stderr && stderr.trim() !== "") {
    console.error(stderr);
  }

  if (stdout && stdout.trim() !== "") {
    console.log(stdout);
  }
};

const release = async (major, minor, bugfix) => {
  await runCommand("git checkout main");
  await runCommand("git pull");
  await runCommand("git reset");
  const MAJOR = major ? 1 : 0;
  const MINOR = minor ? 1 : 0;
  const BUGFIX = bugfix ? 1 : 0;
  const masks = [MAJOR, MINOR, BUGFIX];
  const nextVersion = bumpVersion(masks, pkg.version);
  pkg.version = nextVersion;
  const tag = `v${nextVersion}`;
  writeFileSync("package.json", JSON.stringify(pkg, null, 2));
  await runCommand("git add package.json");
  await runCommand("git add package-lock.json");
  await runCommand(`git commit -m "Update version for Release ${nextVersion}"`);
  await runCommand("git push");
  await runCommand(`git tag ${tag}`);
  await runCommand(`git push origin ${tag}`);
};

module.exports = {
  release,
};
