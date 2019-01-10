
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

const validateProjectName = require('validate-npm-package-name');
const chalk = require('chalk');
const commander = require('commander');
const fs = require('fs-extra');
const path = require('path');
const execSync = require('child_process').execSync;
const spawn = require('cross-spawn');
const semver = require('semver');
const dns = require('dns');
const tmp = require('tmp');
const unpack = require('tar-pack').unpack;
const url = require('url');
const hyperquest = require('hyperquest');
const envinfo = require('envinfo');
const os = require('os');

const packageJson = require('./package.json');

// These files should be allowed to remain on a failed install,
// but then silently removed during the next create.
const errorLogFilePatterns = [
  'npm-debug.log',
  'yarn-error.log',
  'yarn-debug.log',
];

let projectName;

const program = new commander.Command(packageJson.name)
  .version(packageJson.version)
  .arguments('<project-directory>')
  .usage(`${chalk.green('<project-directory>')} [options]`)
  .action(name => {
    projectName = name;
  })
  .option('--verbose', 'mostra log adicionais')
  .option('--info', 'mostra informações de depuração do ambiente')
  .option(
    '--scripts-version <pacote-alternativo>',
    'use uma versão não oficial de anteros-scripts'
  )
  .option('--use-npm')
  .option('--use-pnp')
  .option('--typescript')
  .allowUnknownOption()
  .on('--help', () => {
    console.log(`    somente ${chalk.green('<project-directory>')} é requerido.`);
    console.log();
    console.log(
      `    Uma versão customizada ${chalk.cyan('--scripts-version')} pode ser:`
    );
    console.log(`      - uma versão específica npm : ${chalk.green('0.8.2')}`);
    console.log(`      - uma tag específica npm : ${chalk.green('@next')}`);
    console.log(
      `      - um fork publicado no npm: ${chalk.green(
        'my-anteros-scripts'
      )}`
    );
    console.log(
      `      - um local relativo para o diretório corrente de trabalho : ${chalk.green(
        'file:../my-react-scripts'
      )}`
    );
    console.log(
      `      - um arquivo .tgz : ${chalk.green(
        'https://mysite.com/my-anteros-scripts-0.8.2.tgz'
      )}`
    );
    console.log(
      `      - um arquivo .tar.gz : ${chalk.green(
        'https://mysite.com/my-anteros-scripts-0.8.2.tar.gz'
      )}`
    );
    console.log(
      `    Não é necessário a menos que você queira usar especificamente um fork.`
    );
    console.log();
    console.log(
      `    Se você tiver algum problema, não hesite em registrar um issue:`
    );
    console.log(
      `      ${chalk.cyan(
        'https://github.com/anterostecnologia/anteros-create-app/issues/new'
      )}`
    );
    console.log();
  })
  .parse(process.argv);

if (program.info) {
  console.log(chalk.bold('\nInformações sobre o ambiente:'));
  return envinfo
    .run(
      {
        System: ['OS', 'CPU'],
        Binaries: ['Node', 'npm', 'Yarn'],
        Browsers: ['Chrome', 'Edge', 'Internet Explorer', 'Firefox', 'Safari'],
        npmPackages: ['react', 'react-dom', 'anteros-scripts'],
        npmGlobalPackages: ['anteros-create-app'],
      },
      {
        clipboard: false,
        duplicates: true,
        showNotFound: true,
      }
    )
    .then(console.log);
}

if (typeof projectName === 'undefined') {
  console.error('Por favor especifique o diretório do projeto:');
  console.log(
    `  ${chalk.cyan(program.name())} ${chalk.green('<project-directory>')}`
  );
  console.log();
  console.log('Por example:');
  console.log(`  ${chalk.cyan(program.name())} ${chalk.green('my-react-app')}`);
  console.log();
  console.log(
    `Rode ${chalk.cyan(`${program.name()} --help`)} para ver todas as opções.`
  );
  process.exit(1);
}

function printValidationResults(results) {
  if (typeof results !== 'undefined') {
    results.forEach(error => {
      console.error(chalk.red(`  *  ${error}`));
    });
  }
}

const hiddenProgram = new commander.Command()
  .option(
    '--internal-testing-template <path-to-template>',
    '(apenas para uso interno) ' +
      'usar um modelo de aplicativo não padrão'
  )
  .parse(process.argv);

createApp(
  projectName,
  program.verbose,
  program.scriptsVersion,
  program.useNpm,
  program.usePnp,
  program.typescript,
  hiddenProgram.internalTestingTemplate
);

function createApp(
  name,
  verbose,
  version,
  useNpm,
  usePnp,
  useTypescript,
  template
) {
  const root = path.resolve(name);
  const appName = path.basename(root);

  checkAppName(appName);
  fs.ensureDirSync(name);
  if (!isSafeToCreateProjectIn(root, name)) {
    process.exit(1);
  }

  console.log(`Criando uma nova aplicação React com Anteros em ${chalk.green(root)}.`);
  console.log();

  const packageJson = {
    name: appName,
    version: '0.1.0',
    private: true,
  };
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify(packageJson, null, 2) + os.EOL
  );

  const useYarn = useNpm ? false : shouldUseYarn();
  const originalDirectory = process.cwd();
  process.chdir(root);
  if (!useYarn && !checkThatNpmCanReadCwd()) {
    process.exit(1);
  }

  if (!semver.satisfies(process.version, '>=6.0.0')) {
    console.log(
      chalk.yellow(
        `Você está usando Node ${
          process.version
        } então o projeto será inicializado com uma versão antiga não suportada de ferramentas.\n\n` +
          `Por favor, atualize para o Nde 6 ou superior para ter experiência melhor e totalmente suportada..\n`
      )
    );
    // Fall back to latest supported anteros-scripts on Node 8
    version = 'anteros-scripts@1.0.x';
  }

  if (!useYarn) {
    const npmInfo = checkNpmVersion();
    if (!npmInfo.hasMinNpm) {
      if (npmInfo.npmVersion) {
        console.log(
          chalk.yellow(
            `Você está usando npm ${
              npmInfo.npmVersion
            } então o projeto será inicializado com uma versão antiga não suportada de ferramentas.\n\n` +
              `Por favor, atualize para o npm 3 ou superior para uma experiência melhor e totalmente suportada.\n`
          )
        );
      }
      // Fall back to latest supported anteros-scripts for npm 3
      version = 'anteros-scripts@1.0.x';
    }
  } else if (usePnp) {
    const yarnInfo = checkYarnVersion();
    if (!yarnInfo.hasMinYarnPnp) {
      if (yarnInfo.yarnVersion) {
        chalk.yellow(
          `Você está usando Yarn ${
            yarnInfo.yarnVersion
          } juntamente com a opção --use-pnp, mas o Plug'n'Play só é suportado a partir da versão 1.12.\n\n` +
            `Por favor, atualize para o Yarn 1.12 ou superior para uma experiência melhor e totalmente suportada..\n`
        );
      }
      // 1.11 had an issue with webpack-dev-middleware, so better not use PnP with it (never reached stable, but still)
      usePnp = false;
    }
  }

  if (useYarn) {
    fs.copySync(
      require.resolve('./yarn.lock.cached'),
      path.join(root, 'yarn.lock')
    );
  }

  run(
    root,
    appName,
    version,
    verbose,
    originalDirectory,
    template,
    useYarn,
    usePnp,
    useTypescript
  );
}

function shouldUseYarn() {
  try {
    execSync('yarnpkg --version', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

function install(root, useYarn, usePnp, dependencies, verbose, isOnline) {
  return new Promise((resolve, reject) => {
    let command;
    let args;
    if (useYarn) {
      command = 'yarnpkg';
      args = ['add', '--exact'];
      if (!isOnline) {
        args.push('--offline');
      }
      if (usePnp) {
        args.push('--enable-pnp');
      }
      [].push.apply(args, dependencies);
   
      args.push('--cwd');
      args.push(root);

      if (!isOnline) {
        console.log(chalk.yellow('Você parece estar off-line.'));
        console.log(chalk.yellow('Voltando no cache local do Yarn.'));
        console.log();
      }
    } else {
      command = 'npm';
      args = [
        'install',
        '--save',
        '--save-exact',
        '--loglevel',
        'error',
      ].concat(dependencies);

      if (usePnp) {
        console.log(chalk.yellow("NPM não suporta PnP."));
        console.log(chalk.yellow('Voltando às instalações normais.'));
        console.log();
      }
    }

    if (verbose) {
      args.push('--verbose');
    }

    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('close', code => {
      if (code !== 0) {
        reject({
          command: `${command} ${args.join(' ')}`,
        });
        return;
      }
      resolve();
    });
  });
}

function run(
  root,
  appName,
  version,
  verbose,
  originalDirectory,
  template,
  useYarn,
  usePnp,
  useTypescript
) {
  const packageToInstall = getInstallPackage(version, originalDirectory);
  const allDependencies = ['react', 'react-dom', packageToInstall];
  if (useTypescript) {
    // TODO: get user's node version instead of installing latest
    allDependencies.push(
      '@types/node',
      '@types/react',
      '@types/react-dom',
      '@types/jest',
      'typescript'
    );
  }

  console.log('Instalando pacotes. Isso pode levar alguns minutos.');
  getPackageName(packageToInstall)
    .then(packageName =>
      checkIfOnline(useYarn).then(isOnline => ({
        isOnline: isOnline,
        packageName: packageName,
      }))
    )
    .then(info => {
      const isOnline = info.isOnline;
      const packageName = info.packageName;
      console.log(
        `Instalando ${chalk.cyan('react')}, ${chalk.cyan(
          'react-dom'
        )}, and ${chalk.cyan(packageName)}...`
      );
      console.log();

      return install(
        root,
        useYarn,
        usePnp,
        allDependencies,
        verbose,
        isOnline
      ).then(() => packageName);
    })
    .then(async packageName => {
      checkNodeVersion(packageName);
      setCaretRangeForRuntimeDeps(packageName);

      const pnpPath = path.resolve(process.cwd(), '.pnp.js');

      const nodeArgs = fs.existsSync(pnpPath) ? ['--require', pnpPath] : [];

      await executeNodeScript(
        {
          cwd: process.cwd(),
          args: nodeArgs,
        },
        [root, appName, verbose, originalDirectory, template],
        `
        var init = require('${packageName}/scripts/init.js');
        init.apply(null, JSON.parse(process.argv[1]));
      `
      );

      if (version === 'anteros-scripts@1.0.x') {
        console.log(
          chalk.yellow(
            `\nNota: o projeto foi inicializado com uma versão antiga não suportada de ferramentas.\n` +
              `Por favor, atualize para o Node >= 6 e npm >= 3 para obter ferramentas suportadas em novos projetos.\n`
          )
        );
      }
    })
    .catch(reason => {
      console.log();
      console.log('Abortando instalação.');
      if (reason.command) {
        console.log(`  ${chalk.cyan(reason.command)} falhou.`);
      } else {
        console.log(chalk.red('Erro inesperado. Por favor reporte como um erro(bug):'));
        console.log(reason);
      }
      console.log();

      // Ao sair, vamos excluir esses arquivos do diretório de destino.
      const knownGeneratedFiles = ['package.json', 'yarn.lock', 'node_modules'];
      const currentFiles = fs.readdirSync(path.join(root));
      currentFiles.forEach(file => {
        knownGeneratedFiles.forEach(fileToMatch => {
          // Isso remove todos knownGeneratedFiles.
          if (file === fileToMatch) {
            console.log(`Removendo arquivo gerado... ${chalk.cyan(file)}`);
            fs.removeSync(path.join(root, file));
          }
        });
      });
      const remainingFiles = fs.readdirSync(path.join(root));
      if (!remainingFiles.length) {
        // Delete target folder if empty
        console.log(
          `Removendo ${chalk.cyan(`${appName}/`)} de ${chalk.cyan(
            path.resolve(root, '..')
          )}`
        );
        process.chdir(path.resolve(root, '..'));
        fs.removeSync(path.join(root));
      }
      console.log('Feito.');
      process.exit(1);
    });
}

function getInstallPackage(version, originalDirectory) {
  let packageToInstall = 'anteros-scripts';
  const validSemver = semver.valid(version);
  if (validSemver) {
    packageToInstall += `@${validSemver}`;
  } else if (version) {
    if (version[0] === '@' && version.indexOf('/') === -1) {
      packageToInstall += version;
    } else if (version.match(/^file:/)) {
      packageToInstall = `file:${path.resolve(
        originalDirectory,
        version.match(/^file:(.*)?$/)[1]
      )}`;
    } else {
      // para tar.gz ou arquivos alternativos
      packageToInstall = version;
    }
  }
  return packageToInstall;
}

function getTemporaryDirectory() {
  return new Promise((resolve, reject) => {
    // A limpeza não segura nos permite excluir recursivamente o diretório se ele contiver
    // conteúdo; por padrão, só permite a remoção se estiver vazia
    tmp.dir({ unsafeCleanup: true }, (err, tmpdir, callback) => {
      if (err) {
        reject(err);
      } else {
        resolve({
          tmpdir: tmpdir,
          cleanup: () => {
            try {
              callback();
            } catch (ignored) {
              // Callback pode lançar e falhar, já que é um diretório temporário
              // SO irá limpá-lo eventualmente...
            }
          },
        });
      }
    });
  });
}

function extractStream(stream, dest) {
  return new Promise((resolve, reject) => {
    stream.pipe(
      unpack(dest, err => {
        if (err) {
          reject(err);
        } else {
          resolve(dest);
        }
      })
    );
  });
}

// Extrai o nome do pacote do URL ou caminho do tarball.
function getPackageName(installPackage) {
  if (installPackage.match(/^.+\.(tgz|tar\.gz)$/)) {
    return getTemporaryDirectory()
      .then(obj => {
        let stream;
        if (/^http/.test(installPackage)) {
          stream = hyperquest(installPackage);
        } else {
          stream = fs.createReadStream(installPackage);
        }
        return extractStream(stream, obj.tmpdir).then(() => obj);
      })
      .then(obj => {
        const packageName = require(path.join(obj.tmpdir, 'package.json')).name;
        obj.cleanup();
        return packageName;
      })
      .catch(err => {
        // O nome do pacote pode ser com ou sem versão semver, por ex. anteros-scripts-0.2.0-alpha.1.tgz
        // No entanto, esta função retorna o nome do pacote somente sem a versão semverver.
        console.log(
          `Não foi possível extrair o nome do pacote do arquivo: ${err.message}`
        );
        const assumedProjectName = installPackage.match(
          /^.+\/(.+?)(?:-\d+.+)?\.(tgz|tar\.gz)$/
        )[1];
        console.log(
          `Com base no nome do arquivo, supondo que seja "${chalk.cyan(
            assumedProjectName
          )}"`
        );
        return Promise.resolve(assumedProjectName);
      });
  } else if (installPackage.indexOf('git+') === 0) {
    // Extrair o nome do pacote das URLs git, por exemplo:
    // git+https://github.com/mycompany/anteros-scripts.git
    // git+ssh://github.com/mycompany/anteros-scripts.git#v1.2.3
    return Promise.resolve(installPackage.match(/([^/]+)\.git(#.*)?$/)[1]);
  } else if (installPackage.match(/.+@/)) {
    // Não corresponde a @scope/ ao retirar o @version ou o @tag
    return Promise.resolve(
      installPackage.charAt(0) + installPackage.substr(1).split('@')[0]
    );
  } else if (installPackage.match(/^file:/)) {
    const installPackagePath = installPackage.match(/^file:(.*)?$/)[1];
    const installPackageJson = require(path.join(
      installPackagePath,
      'package.json'
    ));
    return Promise.resolve(installPackageJson.name);
  }
  return Promise.resolve(installPackage);
}

function checkNpmVersion() {
  let hasMinNpm = false;
  let npmVersion = null;
  try {
    npmVersion = execSync('npm --version')
      .toString()
      .trim();
    hasMinNpm = semver.gte(npmVersion, '3.0.0');
  } catch (err) {
    // ignore
  }
  return {
    hasMinNpm: hasMinNpm,
    npmVersion: npmVersion,
  };
}

function checkYarnVersion() {
  let hasMinYarnPnp = false;
  let yarnVersion = null;
  try {
    yarnVersion = execSync('yarnpkg --version')
      .toString()
      .trim();
    let trimmedYarnVersion = /^(.+?)[-+].+$/.exec(yarnVersion);
    if (trimmedYarnVersion) {
      trimmedYarnVersion = trimmedYarnVersion.pop();
    }
    hasMinYarnPnp = semver.gte(trimmedYarnVersion || yarnVersion, '1.12.0');
  } catch (err) {
    // ignore
  }
  return {
    hasMinYarnPnp: hasMinYarnPnp,
    yarnVersion: yarnVersion,
  };
}

function checkNodeVersion(packageName) {
  const packageJsonPath = path.resolve(
    process.cwd(),
    'node_modules',
    packageName,
    'package.json'
  );

  if (!fs.existsSync(packageJsonPath)) {
    return;
  }

  const packageJson = require(packageJsonPath);
  if (!packageJson.engines || !packageJson.engines.node) {
    return;
  }

  if (!semver.satisfies(process.version, packageJson.engines.node)) {
    console.error(
      chalk.red(
        'Você está rodando Node %s.\n' +
          'Anteros Create App requer Node %s ou superior. \n' +
          'Por favor atualize sua versão do Node.'
      ),
      process.version,
      packageJson.engines.node
    );
    process.exit(1);
  }
}

function checkAppName(appName) {
  const validationResult = validateProjectName(appName);
  if (!validationResult.validForNewPackages) {
    console.error(
      `Não é possível criar um projeto chamado ${chalk.red(
        `"${appName}"`
      )} por causa das restrições de nomenclatura npm:`
    );
    printValidationResults(validationResult.errors);
    printValidationResults(validationResult.warnings);
    process.exit(1);
  }

  // TODO: deve haver um único local que contenha as dependências
  const dependencies = ['react', 'react-dom', 'anteros-scripts'].sort();
  if (dependencies.indexOf(appName) >= 0) {
    console.error(
      chalk.red(
        `Não podemos criar um projeto chamado ${chalk.green(
          appName
        )} porque existe uma dependência com o mesmo nome.\n` +
          `Devido ao modo como o npm funciona, os seguintes nomes não são permitidos:\n\n`
      ) +
        chalk.cyan(dependencies.map(depName => `  ${depName}`).join('\n')) +
        chalk.red('\n\nPor favor, escolha um nome de projeto diferente.')
    );
    process.exit(1);
  }
}

function makeCaretRange(dependencies, name) {
  const version = dependencies[name];

  if (typeof version === 'undefined') {
    console.error(chalk.red(`Faltando ${name} dependência em package.json`));
    process.exit(1);
  }

  let patchedVersion = `^${version}`;

  if (!semver.validRange(patchedVersion)) {
    console.error(
      `Não é possível corrigir ${name} versão de dependência porque versão ${chalk.red(
        version
      )} vai se tornar inválido ${chalk.red(patchedVersion)}`
    );
    patchedVersion = version;
  }

  dependencies[name] = patchedVersion;
}

function setCaretRangeForRuntimeDeps(packageName) {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageJson = require(packagePath);

  if (typeof packageJson.dependencies === 'undefined') {
    console.error(chalk.red('Faltando dependências em package.json'));
    process.exit(1);
  }

  const packageVersion = packageJson.dependencies[packageName];
  if (typeof packageVersion === 'undefined') {
    console.error(chalk.red(`Não foi possível encontrar ${packageName} em package.json`));
    process.exit(1);
  }

  makeCaretRange(packageJson.dependencies, 'react');
  makeCaretRange(packageJson.dependencies, 'react-dom');

  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + os.EOL);
}


function isSafeToCreateProjectIn(root, name) {
  const validFiles = [
    '.DS_Store',
    'Thumbs.db',
    '.git',
    '.gitignore',
    '.idea',
    'README.md',
    'LICENSE',
    '.hg',
    '.hgignore',
    '.hgcheck',
    '.npmignore',
    'mkdocs.yml',
    'docs',
    '.travis.yml',
    '.gitlab-ci.yml',
    '.gitattributes',
  ];
  console.log();

  const conflicts = fs
    .readdirSync(root)
    .filter(file => !validFiles.includes(file))
    .filter(file => !/\.iml$/.test(file))
    .filter(
      file => !errorLogFilePatterns.some(pattern => file.indexOf(pattern) === 0)
    );

  if (conflicts.length > 0) {
    console.log(
      `O diretório ${chalk.green(name)} contém arquivos que podem entrar em conflito:`
    );
    console.log();
    for (const file of conflicts) {
      console.log(`  ${file}`);
    }
    console.log();
    console.log(
      'Tente usar um novo nome de diretório ou remova os arquivos listados acima.'
    );

    return false;
  }

  // Remova todos os arquivos remanescentes de uma instalação anterior
  const currentFiles = fs.readdirSync(path.join(root));
  currentFiles.forEach(file => {
    errorLogFilePatterns.forEach(errorLogFilePattern => {
      // Isso vai pegar arquivos `(npm-debug|yarn-error|yarn-debug).log*` 
      if (file.indexOf(errorLogFilePattern) === 0) {
        fs.removeSync(path.join(root, file));
      }
    });
  });
  return true;
}

function getProxy() {
  if (process.env.https_proxy) {
    return process.env.https_proxy;
  } else {
    try {
      // Tentando ler https-proxy de .npmrc
      let httpsProxy = execSync('npm config get https-proxy')
        .toString()
        .trim();
      return httpsProxy !== 'null' ? httpsProxy : undefined;
    } catch (e) {
      return;
    }
  }
}
function checkThatNpmCanReadCwd() {
  const cwd = process.cwd();
  let childOutput = null;
  try {
    childOutput = spawn.sync('npm', ['config', 'list']).output.join('');
  } catch (err) {
    return true;
  }
  if (typeof childOutput !== 'string') {
    return true;
  }
  const lines = childOutput.split('\n');
  // `npm config list` saída inclui a seguinte linha:
  // "; cwd = C:\path\to\current\dir" (unquoted)
  const prefix = '; cwd = ';
  const line = lines.find(line => line.indexOf(prefix) === 0);
  if (typeof line !== 'string') {
    return true;
  }
  const npmCWD = line.substring(prefix.length);
  if (npmCWD === cwd) {
    return true;
  }
  console.error(
    chalk.red(
      `Não foi possível iniciar um processo npm no diretório correto.\n\n` +
        `O diretório atual é: ${chalk.bold(cwd)}\n` +
        `No entanto, um processo npm recém-iniciado é executado: ${chalk.bold(
          npmCWD
        )}\n\n` +
        `Isso provavelmente é causado por um shell de terminal do sistema configurado incorretamente.`
    )
  );
  if (process.platform === 'win32') {
    console.error(
      chalk.red(`No Windows, isso geralmente pode ser corrigido pela execução:\n\n`) +
        `  ${chalk.cyan(
          'reg'
        )} delete "HKCU\\Software\\Microsoft\\Command Processor" /v AutoRun /f\n` +
        `  ${chalk.cyan(
          'reg'
        )} delete "HKLM\\Software\\Microsoft\\Command Processor" /v AutoRun /f\n\n` +
        chalk.red(`Tente executar as duas linhas acima no terminal.\n`) +
        chalk.red(
          `Para saber mais sobre esse problema, leai: https://blogs.msdn.microsoft.com/oldnewthing/20071121-00/?p=24433/`
        )
    );
  }
  return false;
}

function checkIfOnline(useYarn) {
  if (!useYarn) {    
    return Promise.resolve(true);
  }

  return new Promise(resolve => {
    dns.lookup('registry.yarnpkg.com', err => {
      let proxy;
      if (err != null && (proxy = getProxy())) {
        // Se um proxy for definido, provavelmente não poderemos resolver nomes de host externos.
        // Tente resolver o nome do proxy como uma indicação de uma conexão.
        dns.lookup(url.parse(proxy).hostname, proxyErr => {
          resolve(proxyErr == null);
        });
      } else {
        resolve(err == null);
      }
    });
  });
}

function executeNodeScript({ cwd, args }, data, source) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [...args, '-e', source, '--', JSON.stringify(data)],
      { cwd, stdio: 'inherit' }
    );

    child.on('close', code => {
      if (code !== 0) {
        reject({
          command: `node ${args.join(' ')}`,
        });
        return;
      }
      resolve();
    });
  });
}
