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
const chalk = require('chalk');
const execSync = require('child_process').execSync;
const spawn = require('react-dev-utils/crossSpawn');
const { defaultBrowsers } = require('react-dev-utils/browsersHelper');
const os = require('os');
const verifyTypeScriptSetup = require('./utils/verifyTypeScriptSetup');

function isInGitRepository() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function isInMercurialRepository() {
  try {
    execSync('hg --cwd . root', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function tryGitInit(appPath) {
  let didInit = false;
  try {
    execSync('git --version', { stdio: 'ignore' });
    if (isInGitRepository() || isInMercurialRepository()) {
      return false;
    }

    execSync('git init', { stdio: 'ignore' });
    didInit = true;

    execSync('git add -A', { stdio: 'ignore' });
    execSync('git commit -m "Commit inicial do aplicativo Anteros Create App"', {
      stdio: 'ignore',
    });
    return true;
  } catch (e) {
    if (didInit) {
      // Se inicializamos com sucesso, mas não conseguimos commitar,
      // talvez a configuração do autor commit não esteja definida.
      // No futuro, podemos fornecer nosso próprio committer
      // como o Ember CLI, mas por enquanto, vamos apenas
      // remove os arquivos do Git para evitar um estado incompleto.
      try {
        // unlinkSync () não funciona em diretórios.
        fs.removeSync(path.join(appPath, '.git'));
      } catch (removeErr) {
        // Ignorar
      }
    }
    return false;
  }
}

module.exports = function(
  appPath,
  appName,
  verbose,
  originalDirectory,
  template
) {
  const ownPath = path.dirname(
    require.resolve(path.join(__dirname, '..', 'package.json'))
  );
  const appPackage = require(path.join(appPath, 'package.json'));
  const useYarn = fs.existsSync(path.join(appPath, 'yarn.lock'));

  // Copie sobre algumas das devDependencies
  appPackage.dependencies = appPackage.dependencies || {};

  const useTypeScript = appPackage.dependencies['typescript'] != null;

  // Configurar as regras de script
  appPackage.scripts = {
    start: 'anteros-scripts start',
    build: 'anteros-scripts build',
    test: 'anteros-scripts test',
    eject: 'anteros-scripts eject',
  };

  // Configurar a configuração eslint
  appPackage.eslintConfig = {
    extends: 'react-app',
  };

  // Configurar a lista de navegadores
  appPackage.browserslist = defaultBrowsers;

  fs.writeFileSync(
    path.join(appPath, 'package.json'),
    JSON.stringify(appPackage, null, 2) + os.EOL
  );

  const readmeExists = fs.existsSync(path.join(appPath, 'README.md'));
  if (readmeExists) {
    fs.renameSync(
      path.join(appPath, 'README.md'),
      path.join(appPath, 'README.old.md')
    );
  }

  // Copie os arquivos para o usuário
  const templatePath = template
    ? path.resolve(originalDirectory, template)
    : path.join(ownPath, useTypeScript ? 'template-typescript' : 'template');
  if (fs.existsSync(templatePath)) {
    fs.copySync(templatePath, appPath);
  } else {
    console.error(
      `Não foi possível localizar o modelo fornecido: ${chalk.green(templatePath)}`
    );
    return;
  }

  // Renomeie gitignore após o fato para evitar que o npm renomeie-o para .npmignore
  // Veja: https://github.com/npm/npm/issues/1862
  try {
    fs.moveSync(
      path.join(appPath, 'gitignore'),
      path.join(appPath, '.gitignore'),
      []
    );
  } catch (err) {
    // Acrescente se já existe um arquivo `.gitignore`
    if (err.code === 'EEXIST') {
      const data = fs.readFileSync(path.join(appPath, 'gitignore'));
      fs.appendFileSync(path.join(appPath, '.gitignore'), data);
      fs.unlinkSync(path.join(appPath, 'gitignore'));
    } else {
      throw err;
    }
  }

  let command;
  let args;

  if (useYarn) {
    command = 'yarnpkg';
    args = ['add'];
  } else {
    command = 'npm';
    args = ['install', '--save', verbose && '--verbose'].filter(e => e);
  }
  args.push('react', 'react-dom');

  // Instalar dependências de modelo adicionais, se presentes
  const templateDependenciesPath = path.join(
    appPath,
    '.template.dependencies.json'
  );
  if (fs.existsSync(templateDependenciesPath)) {
    const templateDependencies = require(templateDependenciesPath).dependencies;
    args = args.concat(
      Object.keys(templateDependencies).map(key => {
        return `${key}@${templateDependencies[key]}`;
      })
    );
    fs.unlinkSync(templateDependenciesPath);
  }

  // Instalar react e react-dom para compatibilidade retroativa com o antigo cli Anteros Create App
  // que não instalava react e react-dom juntamente com anteros-scripts
  // ou modelo é predefinido (via --internal-testing-template)
  if (!isReactInstalled(appPackage) || template) {
    console.log(`Instalando react and react-dom usando ${command}...`);
    console.log();

    const proc = spawn.sync(command, args, { stdio: 'inherit' });
    if (proc.status !== 0) {
      console.error(`\`${command} ${args.join(' ')}\` failed`);
      return;
    }
  }

  if (useTypeScript) {
    verifyTypeScriptSetup();
  }

  if (tryGitInit(appPath)) {
    console.log();
    console.log('Inicializou um repositório git.');
  }

  // Exibe o caminho mais elegante para o cd.
  // Isso precisa manipular um originalDirectory indefinido para
  // compatibilidade retroativa com antigos cli's globais.
  let cdpath;
  if (originalDirectory && path.join(originalDirectory, appName) === appPath) {
    cdpath = appName;
  } else {
    cdpath = appPath;
  }

  // Alterar o comando exibido para o yarn em vez de yarnpkg
  const displayedCommand = useYarn ? 'yarn' : 'npm';

  console.log();
  console.log(`Sucesso! Criado ${appName} em ${appPath}`);
  console.log('Dentro desse diretório, você pode executar vários comandos:');
  console.log();
  console.log(chalk.cyan(`  ${displayedCommand} start`));
  console.log('    Inicia o servidor de desenvolvimento.');
  console.log();
  console.log(
    chalk.cyan(`  ${displayedCommand} ${useYarn ? '' : 'run '}build`)
  );
  console.log('    Gera o aplicativo em arquivos estáticos para produção.');
  console.log();
  console.log(chalk.cyan(`  ${displayedCommand} test`));
  console.log('    Inicia os testes.');
  console.log();
  console.log(
    chalk.cyan(`  ${displayedCommand} ${useYarn ? '' : 'run '}eject`)
  );
  console.log(
    '    Remove esta ferramenta e copia dependências de compilação, arquivos de configuração'
  );
  console.log(
    '    e scripts no diretório do aplicativo. Se você fizer isso, não poderá voltar!'
  );
  console.log();
  console.log('Sugerimos que você comece digitando:');
  console.log();
  console.log(chalk.cyan('  cd'), cdpath);
  console.log(`  ${chalk.cyan(`${displayedCommand} start`)}`);
  if (readmeExists) {
    console.log();
    console.log(
      chalk.yellow(
        'Você tinha um arquivo `README.md`, nós o renomeamos como` README.old.md`'
      )
    );
  }
  console.log();
  console.log('Bom trabalho!');
};

function isReactInstalled(appPackage) {
  const dependencies = appPackage.dependencies || {};

  return (
    typeof dependencies.react !== 'undefined' &&
    typeof dependencies['react-dom'] !== 'undefined'
  );
}
