import chalk from 'chalk';
import Figlet from 'figlet';
import fs from 'fs';

export function showBanner() {
  console.log(Figlet.textSync('ACME Wizard', 'Small Slant'));
  console.log();
  console.log(
    `${chalk.bold('ACME Wizard')} for ${chalk.bold('Stella IT Console')} - ${chalk.italic(
      `ver. 0.1.0`,
    )}`,
  );
  console.log(chalk.cyan(chalk.underline("https://github.com/Stella-IT/acme-wizard")));
  console.log();
  console.log(`Copyright © ${chalk.bold(`${chalk.cyan('Stella')} ${chalk.blue('IT')} ${chalk.magenta('Inc.')}`)}`);
  console.log(`Distributed under MIT License`);
  console.log();
}
