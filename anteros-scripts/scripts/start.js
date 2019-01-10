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
process.env.BABEL_ENV = 'development';
process.env.NODE_ENV = 'development';

// Faz o script travar em rejeições não tratadas em vez de silenciosamente
// ignorando-os. No futuro, rejeições que não forem tratadas
// terminam o processo Node.js com um código de saída diferente de zero.
process.on('unhandledRejection', err => {
  throw err;
});

// Certifique-se de que as variáveis ​​de ambiente sejam lidas.
require('../config/env');
// @remove-on-eject-begin
// Faça a verificação prévia (só acontece antes de ejetar)
const verifyPackageTree = require('./utils/verifyPackageTree');
if (process.env.SKIP_PREFLIGHT_CHECK !== 'true') {
  verifyPackageTree();
}
const verifyTypeScriptSetup = require('./utils/verifyTypeScriptSetup');
verifyTypeScriptSetup();
// @remove-on-eject-end

const fs = require('fs');
const chalk = require('chalk');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const clearConsole = require('react-dev-utils/clearConsole');
const checkRequiredFiles = require('react-dev-utils/checkRequiredFiles');
const {
  choosePort,
  createCompiler,
  prepareProxy,
  prepareUrls,
} = require('react-dev-utils/WebpackDevServerUtils');
const openBrowser = require('react-dev-utils/openBrowser');
const paths = require('../config/paths');
const configFactory = require('../config/webpack.config');
const createDevServerConfig = require('../config/webpackDevServer.config');

const useYarn = fs.existsSync(paths.yarnLockFile);
const isInteractive = process.stdout.isTTY;

// Avisar e travar se os arquivos necessários estiverem faltando
if (!checkRequiredFiles([paths.appHtml, paths.appIndexJs])) {
  process.exit(1);
}

// Ferramentas como a Cloud9 contam com isso.
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

if (process.env.HOST) {
  console.log(
    chalk.cyan(
      `Tentando fazer bind à variável de ambiente do HOST: ${chalk.yellow(
        chalk.bold(process.env.HOST)
      )}`
    )
  );
  console.log(
    `Se isso não foi intencional, verifique se você não o definiu erroneamente em seu shell.`
  );
  console.log(
    `Saiba mais aqui: ${chalk.yellow('http://bit.ly/CRA-advanced-config')}`
  );
  console.log();
}

// Exigimos que você configure explicitamente os navegadores e não recorra a
// padrões de browserslist.
const { checkBrowsers } = require('react-dev-utils/browsersHelper');
checkBrowsers(paths.appPath, isInteractive)
  .then(() => {
    // Tentamos usar a porta padrão, mas se ela estiver ocupada, oferecemos ao usuário
    // rodar em uma porta diferente. `choosePort ()` Promise resolve para a próxima porta livre.
    return choosePort(HOST, DEFAULT_PORT);
  })
  .then(port => {
    if (port == null) {
      // Nós não encontramos uma porta.
      return;
    }
    const config = configFactory('development');
    const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
    const appName = require(paths.appPackageJson).name;
    const urls = prepareUrls(protocol, HOST, port);
    // Crie um compilador de webpack configurado com mensagens customizadas.
    const compiler = createCompiler(webpack, config, appName, urls, useYarn);
    // Carregar configuração de proxy
    const proxySetting = require(paths.appPackageJson).proxy;
    const proxyConfig = prepareProxy(proxySetting, paths.appPublic);
    // Servir assets de webpack gerados pelo compilador em um servidor da web.
    const serverConfig = createDevServerConfig(
      proxyConfig,
      urls.lanUrlForConfig
    );
    const devServer = new WebpackDevServer(compiler, serverConfig);
    // Inicie o WebpackDevServer.
    devServer.listen(port, HOST, err => {
      if (err) {
        return console.log(err);
      }
      if (isInteractive) {
        clearConsole();
      }
      console.log(chalk.cyan('Iniciando o servidor de desenvolvimento...\n'));
      openBrowser(urls.localUrlForBrowser);
    });

    ['SIGINT', 'SIGTERM'].forEach(function(sig) {
      process.on(sig, function() {
        devServer.close();
        process.exit();
      });
    });
  })
  .catch(err => {
    if (err && err.message) {
      console.log(err.message);
    }
    process.exit(1);
  });
