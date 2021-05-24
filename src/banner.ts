import chalk from 'chalk';
import Figlet from 'figlet';
import fs from 'fs';

const packageJson = JSON.parse(fs.readFileSync('package.json', { encoding: 'utf-8' }));

export function showBanner() {
  console.log(Figlet.textSync('ACME Wizard', 'Small Slant'));
  console.log();
  console.log(
    `${chalk.bold('ACME Wizard')} for ${chalk.bold('Stella IT Console')} - ${chalk.italic(
      `ver. ${packageJson.version}`,
    )}`,
  );
  console.log(chalk.cyan(chalk.underline(packageJson.repository)));
  console.log();
  console.log(`Copyright © ${chalk.bold(`${chalk.cyan('Stella')} ${chalk.blue('IT')} ${chalk.magenta('Inc.')}`)}`);
  console.log(`Distributed under ${packageJson.license} License`);
  console.log();
}
