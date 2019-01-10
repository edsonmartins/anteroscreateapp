// @remove-on-eject-begin
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
// @remove-on-eject-end
'use strict';

// Faça isso como a primeira coisa, para que qualquer código que esteja lendo saiba o env correto.
process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

// Faz o script travar em rejeições não tratadas em vez de silenciosamente
// ignorando-os. No futuro, rejeições que não forem tratadas
// terminam o processo Node.js com um código de saída diferente de zero.
process.on('unhandledRejection', err => {
  throw err;
});

// Certifique-se de que as variáveis ​​de ambiente sejam lidas.
require('../config/env');
// @remove-on-eject-begin
// Faça as verificações de comprovação (só acontece antes de ejetar).
const verifyPackageTree = require('./utils/verifyPackageTree');
if (process.env.SKIP_PREFLIGHT_CHECK !== 'true') {
  verifyPackageTree();
}
const verifyTypeScriptSetup = require('./utils/verifyTypeScriptSetup');
verifyTypeScriptSetup();
// @remove-on-eject-end

const path = require('path');
const chalk = require('chalk');
const fs = require('fs-extra');
const webpack = require('webpack');
const bfj = require('bfj');
const configFactory = require('../config/webpack.config');
const paths = require('../config/paths');
const checkRequiredFiles = require('react-dev-utils/checkRequiredFiles');
const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');
const printHostingInstructions = require('react-dev-utils/printHostingInstructions');
const FileSizeReporter = require('react-dev-utils/FileSizeReporter');
const printBuildError = require('react-dev-utils/printBuildError');

const measureFileSizesBeforeBuild =
  FileSizeReporter.measureFileSizesBeforeBuild;
const printFileSizesAfterBuild = FileSizeReporter.printFileSizesAfterBuild;
const useYarn = fs.existsSync(paths.yarnLockFile);

// Esses tamanhos são bem grandes. Vamos avisar para pacotes que os excedam.
const WARN_AFTER_BUNDLE_GZIP_SIZE = 512 * 1024;
const WARN_AFTER_CHUNK_GZIP_SIZE = 1024 * 1024;

const isInteractive = process.stdout.isTTY;

// Avisar e travar se os arquivos necessários estiverem faltando
if (!checkRequiredFiles([paths.appHtml, paths.appIndexJs])) {
  process.exit(1);
}

// Processar CLI argumentos
const argv = process.argv.slice(2);
const writeStatsJson = argv.indexOf('--stats') !== -1;

// Gere a configuração
const config = configFactory('production');

// Exigimos que você defina explicitamente navegadores e não retorne a
// padrões de browserslist.
const { checkBrowsers } = require('react-dev-utils/browsersHelper');
checkBrowsers(paths.appPath, isInteractive)
  .then(() => {
    // Primeiro, leia os tamanhos de arquivo atuais no diretório de construção.
    // Isso nos permite mostrar o quanto eles mudaram mais tarde.
    return measureFileSizesBeforeBuild(paths.appBuild);
  })
  .then(previousFileSizes => {
    // Remove todo o conteúdo, mas mantém o diretório para que
    // se você estiver nele, não acabará na Lixeira
    fs.emptyDirSync(paths.appBuild);
    // Mesclar com a pasta pública
    copyPublicFolder();
    // Iniciar a compilação do webpack
    return build(previousFileSizes);
  })
  .then(
    ({ stats, previousFileSizes, warnings }) => {
      if (warnings.length) {
        console.log(chalk.yellow('Compilado com avisos.\n'));
        console.log(warnings.join('\n\n'));
        console.log(
          '\nPesquise pelas ' +
            chalk.underline(chalk.yellow('palavras-chave')) +
            ' para saber mais sobre cada aviso.'
        );
        console.log(
          'Para ignorar, adicione ' +
            chalk.cyan('// eslint-disable-next-line') +
            ' antes da linha.\n'
        );
      } else {
        console.log(chalk.green('Compilado com sucesso.\n'));
      }

      console.log('Tamanhos de arquivo após o gzip:\n');
      printFileSizesAfterBuild(
        stats,
        previousFileSizes,
        paths.appBuild,
        WARN_AFTER_BUNDLE_GZIP_SIZE,
        WARN_AFTER_CHUNK_GZIP_SIZE
      );
      console.log();

      const appPackage = require(paths.appPackageJson);
      const publicUrl = paths.publicUrl;
      const publicPath = config.output.publicPath;
      const buildFolder = path.relative(process.cwd(), paths.appBuild);
      printHostingInstructions(
        appPackage,
        publicUrl,
        publicPath,
        buildFolder,
        useYarn
      );
    },
    err => {
      console.log(chalk.red('Falha ao compilar.\n'));
      printBuildError(err);
      process.exit(1);
    }
  )
  .catch(err => {
    if (err && err.message) {
      console.log(err.message);
    }
    process.exit(1);
  });

// Crie a construção de produção e imprima as instruções de implantação.
function build(previousFileSizes) {
  console.log('Criando uma construção de produção otimizada...');

  let compiler = webpack(config);
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      let messages;
      if (err) {
        if (!err.message) {
          return reject(err);
        }
        messages = formatWebpackMessages({
          errors: [err.message],
          warnings: [],
        });
      } else {
        messages = formatWebpackMessages(
          stats.toJson({ all: false, warnings: true, errors: true })
        );
      }
      if (messages.errors.length) {
        // Apenas mantenha o primeiro erro. Outros são frequentemente indicativos
        // do mesmo problema, mas confundir o leitor com ruído.
        if (messages.errors.length > 1) {
          messages.errors.length = 1;
        }
        return reject(new Error(messages.errors.join('\n\n')));
      }
      if (
        process.env.CI &&
        (typeof process.env.CI !== 'string' ||
          process.env.CI.toLowerCase() !== 'false') &&
        messages.warnings.length
      ) {
        console.log(
          chalk.yellow(
            '\nTratar avisos como erros porque process.env.CI = true.\n' +
              'A maioria dos servidores de CI define automaticamente.\n'
          )
        );
        return reject(new Error(messages.warnings.join('\n\n')));
      }

      const resolveArgs = {
        stats,
        previousFileSizes,
        warnings: messages.warnings,
      };
      if (writeStatsJson) {
        return bfj
          .write(paths.appBuild + '/bundle-stats.json', stats.toJson())
          .then(() => resolve(resolveArgs))
          .catch(error => reject(new Error(error)));
      }

      return resolve(resolveArgs);
    });
  });
}

function copyPublicFolder() {
  fs.copySync(paths.appPublic, paths.appBuild, {
    dereference: true,
    filter: file => file !== paths.appHtml,
  });
}
