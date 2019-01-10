// @remove-file-on-eject
/*******************************************************************************
 * Copyright 2019 Anteros Tecnologia
 *  
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *  
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *******************************************************************************/
'use strict';

// Faz o script travar em rejeições não tratadas em vez de silenciosamente
// ignorando-os. No futuro, rejeições que não forem tratadas
// terminam o processo Node.js com um código de saída diferente de zero.
process.on('unhandledRejection', err => {
  throw err;
});

const fs = require('fs-extra');
const path = require('path');
const execSync = require('child_process').execSync;
const chalk = require('chalk');
const paths = require('../config/paths');
const createJestConfig = require('./utils/createJestConfig');
const inquirer = require('react-dev-utils/inquirer');
const spawnSync = require('react-dev-utils/crossSpawn').sync;
const os = require('os');

const green = chalk.green;
const cyan = chalk.cyan;

function getGitStatus() {
  try {
    let stdout = execSync(`git status --porcelain`, {
      stdio: ['pipe', 'pipe', 'ignore'],
    }).toString();
    return stdout.trim();
  } catch (e) {
    return '';
  }
}

console.log(
  chalk.cyan.bold(
    'NOTE: Anteros Create App suporta TypeScript, Sass, CSS Módulos e mais sem ejetar. '
  )
);
console.log();

inquirer
  .prompt({
    type: 'confirm',
    name: 'shouldEject',
    message: 'Tem certeza de que deseja ejetar? Esta ação é permanente.',
    default: false,
  })
  .then(answer => {
    if (!answer.shouldEject) {
      console.log(cyan('Feche um! Ejetar abortado.'));
      return;
    }

    const gitStatus = getGitStatus();
    if (gitStatus) {
      console.error(
        chalk.red(
          'Este repositório git tem arquivos não rastreados ou alterações não confirmadas:'
        ) +
          '\n\n' +
          gitStatus
            .split('\n')
            .map(line => line.match(/ .*/g)[0].trim())
            .join('\n') +
          '\n\n' +
          chalk.red(
            'Remover arquivos não acompanhados, ocultar ou confirmar alterações e tentar novamente.'
          )
      );
      process.exit(1);
    }

    console.log('Ejetando...');

    const ownPath = paths.ownPath;
    const appPath = paths.appPath;

    function verifyAbsent(file) {
      if (fs.existsSync(path.join(appPath, file))) {
        console.error(
          `\`${file}\` já existe na sua pasta de aplicativos. Nós não podemos ` +
            'continue como você perderia todas as alterações nesse arquivo ou diretório. ' +
            'Por favor, mova ou apague-o (talvez faça uma cópia para backup) e execute este ' +
            'comando novamente.'
        );
        process.exit(1);
      }
    }

    const folders = ['config', 'config/jest', 'scripts'];

    // Faça uma matriz superficial de caminhos de arquivos
    const files = folders.reduce((files, folder) => {
      return files.concat(
        fs
          .readdirSync(path.join(ownPath, folder))
          // definir caminho completo
          .map(file => path.join(ownPath, folder, file))
          // omit dirs from file list
          .filter(file => fs.lstatSync(file).isFile())
      );
    }, []);

    // Certifique-se de que a pasta do aplicativo esteja limpa e não substituiremos nenhum arquivo
    folders.forEach(verifyAbsent);
    files.forEach(verifyAbsent);

    // Prepare a configuração Jest no início, caso isso ocorra
    const jestConfig = createJestConfig(
      filePath => path.posix.join('<rootDir>', filePath),
      null,
      true
    );

    console.log();
    console.log(cyan(`Copiando arquivos para ${appPath}`));

    folders.forEach(folder => {
      fs.mkdirSync(path.join(appPath, folder));
    });

    files.forEach(file => {
      let content = fs.readFileSync(file, 'utf8');

      // Ignorar arquivos sinalizados
      if (content.match(/\/\/ @remove-file-on-eject/)) {
        return;
      }
      content =
        content
          // Remover código morto dos arquivos .js na ejeção
          .replace(
            /\/\/ @remove-on-eject-begin([\s\S]*?)\/\/ @remove-on-eject-end/gm,
            ''
          )
          // Remover código morto de arquivos .applescript em ejetar
          .replace(
            /-- @remove-on-eject-begin([\s\S]*?)-- @remove-on-eject-end/gm,
            ''
          )
          .trim() + '\n';
      console.log(`  Adding ${cyan(file.replace(ownPath, ''))} to the project`);
      fs.writeFileSync(file.replace(ownPath, appPath), content);
    });
    console.log();

    const ownPackage = require(path.join(ownPath, 'package.json'));
    const appPackage = require(path.join(appPath, 'package.json'));

    console.log(cyan('Atualizando as dependências'));
    const ownPackageName = ownPackage.name;
    if (appPackage.devDependencies) {
      // Nós costumávamos colocar anteros-scripts em devDependencies
      if (appPackage.devDependencies[ownPackageName]) {
        console.log(`  Removendo ${cyan(ownPackageName)} das devDependencies`);
        delete appPackage.devDependencies[ownPackageName];
      }
    }
    appPackage.dependencies = appPackage.dependencies || {};
    if (appPackage.dependencies[ownPackageName]) {
      console.log(`  Removendo ${cyan(ownPackageName)} das dependências`);
      delete appPackage.dependencies[ownPackageName];
    }
    Object.keys(ownPackage.dependencies).forEach(key => {
      // Por algum motivo opcionalDependencies acabam em dependências após a instalação
      if (ownPackage.optionalDependencies[key]) {
        return;
      }
      console.log(`  Adicionando ${cyan(key)} para dependências`);
      appPackage.dependencies[key] = ownPackage.dependencies[key];
    });
    // Ordenar os deps
    const unsortedDependencies = appPackage.dependencies;
    appPackage.dependencies = {};
    Object.keys(unsortedDependencies)
      .sort()
      .forEach(key => {
        appPackage.dependencies[key] = unsortedDependencies[key];
      });
    console.log();

    console.log(cyan('Atualizando os Scripts'));
    delete appPackage.scripts['eject'];
    Object.keys(appPackage.scripts).forEach(key => {
      Object.keys(ownPackage.bin).forEach(binKey => {
        const regex = new RegExp(binKey + ' (\\w+)', 'g');
        if (!regex.test(appPackage.scripts[key])) {
          return;
        }
        appPackage.scripts[key] = appPackage.scripts[key].replace(
          regex,
          'node scripts/$1.js'
        );
        console.log(
          `  Substituindo ${cyan(`"${binKey} ${key}"`)} com ${cyan(
            `"node scripts/${key}.js"`
          )}`
        );
      });
    });

    console.log();
    console.log(cyan('Configurando package.json'));
    // Adicionar configuração de Jest
    console.log(`  Adicionando configuração ${cyan('Jest')}`);
    appPackage.jest = jestConfig;

    // Adicionar configuração do Babel
    console.log(`  Adicionando preset ${cyan('Babel')} `);
    appPackage.babel = {
      presets: ['react-app'],
    };

    // Adicionar configuração do ESlint
    console.log(`  Adding ${cyan('ESLint')} configuration`);
    appPackage.eslintConfig = {
      extends: 'react-app',
    };

    fs.writeFileSync(
      path.join(appPath, 'package.json'),
      JSON.stringify(appPackage, null, 2) + os.EOL
    );
    console.log();

    if (fs.existsSync(paths.appTypeDeclarations)) {
      try {
        // Leia o arquivo de declarações do aplicativo
        let content = fs.readFileSync(paths.appTypeDeclarations, 'utf8');
        const ownContent =
          fs.readFileSync(paths.ownTypeDeclarations, 'utf8').trim() + os.EOL;

        // Remova a referência anteros-scripts desde que eles estejam obtendo uma cópia dos tipos em seu projeto
        content =
          content
            // Remover tipos de anteros-scripts
            .replace(
              /^\s*\/\/\/\s*<reference\s+types.+?"anteros-scripts".*\/>.*(?:\n|$)/gm,
              ''
            )
            .trim() + os.EOL;

        fs.writeFileSync(
          paths.appTypeDeclarations,
          (ownContent + os.EOL + content).trim() + os.EOL
        );
      } catch (e) {
        // Não é essencial que isso seja bem-sucedido, o usuário TypeScript deve
        // e poderá recriar esses tipos com facilidade.
      }
    }

    // "Não destrua o que não é nosso"
    if (ownPath.indexOf(appPath) === 0) {
      try {
        // remove os binários anteros-scripts e anteros-scripts do aplicativo node_modules
        Object.keys(ownPackage.bin).forEach(binKey => {
          fs.removeSync(path.join(appPath, 'node_modules', '.bin', binKey));
        });
        fs.removeSync(ownPath);
      } catch (e) {
        // Não é essencial que isso tenha sucesso
      }
    }

    if (fs.existsSync(paths.yarnLockFile)) {
      const windowsCmdFilePath = path.join(
        appPath,
        'node_modules',
        '.bin',
        'react-scripts.cmd'
      );
      let windowsCmdFileContent;
      if (process.platform === 'win32') {
        try {
          windowsCmdFileContent = fs.readFileSync(windowsCmdFilePath);
        } catch (err) {
         // Se isso falhar, não estamos piores do que se não tentássemos consertá-lo.
        }
      }

      console.log(cyan('Executando yarn...'));
      spawnSync('yarnpkg', ['--cwd', process.cwd()], { stdio: 'inherit' });

      if (windowsCmdFileContent && !fs.existsSync(windowsCmdFilePath)) {
        try {
          fs.writeFileSync(windowsCmdFilePath, windowsCmdFileContent);
        } catch (err) {
          // Se isso falhar, não estamos piores do que se não tentássemos consertá-lo.
        }
      }
    } else {
      console.log(cyan('Executando npm install...'));
      spawnSync('npm', ['install', '--loglevel', 'error'], {
        stdio: 'inherit',
      });
    }
    console.log(green('Ejetado com sucesso!'));
    console.log();

    console.log(
      green('Por favor, considere compartilhar por que você ejetado nesta pesquisa:')
    );
    console.log(green('  http://goo.gl/forms/Bi6CZjk1EqsdelXk1'));
    console.log();
  });
