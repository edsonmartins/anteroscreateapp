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

const fs = require('fs');
const chalk = require('chalk');
const paths = require('../../config/paths');

module.exports = (resolve, rootDir, isEjecting) => {
  // Use isso em vez de `paths.testsSetup` para evitar colocar
  // um nome de arquivo absoluto na configuração após ejetar.
  const setupTestsMatches = paths.testsSetup.match(/src[/\\]setupTests\.(.+)/);
  const setupTestsFileExtension =
    (setupTestsMatches && setupTestsMatches[1]) || 'js';
  const setupTestsFile = fs.existsSync(paths.testsSetup)
    ? `<rootDir>/src/setupTests.${setupTestsFileExtension}`
    : undefined;

  const config = {
    collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/**/*.d.ts'],

    // TODO: isso quebra o Yarn PnP ao ejetar.
    // Mas não podemos simplesmente emitir isso porque será um caminho absoluto.
    // A correção apropriada é escrever jest.config.js no eject em vez de uma chave package.json.
    // Então, eles sempre podem ficar como require.resolve()s.
    resolver: isEjecting
      ? 'jest-pnp-resolver'
      : require.resolve('jest-pnp-resolver'),
    setupFiles: [
      isEjecting
        ? 'react-app-polyfill/jsdom'
        : require.resolve('react-app-polyfill/jsdom'),
    ],

    setupTestFrameworkScriptFile: setupTestsFile,
    testMatch: [
      '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
      '<rootDir>/src/**/?(*.)(spec|test).{js,jsx,ts,tsx}',
    ],
    testEnvironment: 'jsdom',
    testURL: 'http://localhost',
    transform: {
      '^.+\\.(js|jsx|ts|tsx)$': isEjecting
        ? '<rootDir>/node_modules/babel-jest'
        : resolve('config/jest/babelTransform.js'),
      '^.+\\.css$': resolve('config/jest/cssTransform.js'),
      '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': resolve(
        'config/jest/fileTransform.js'
      ),
    },
    transformIgnorePatterns: [
      '[/\\\\]node_modules[/\\\\].+\\.(js|jsx|ts|tsx)$',
      '^.+\\.module\\.(css|sass|scss)$',
    ],
    moduleNameMapper: {
      '^react-native$': 'react-native-web',
      '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
    },
    moduleFileExtensions: [...paths.moduleFileExtensions, 'node'].filter(
      ext => !ext.includes('mjs')
    ),
  };
  if (rootDir) {
    config.rootDir = rootDir;
  }
  const overrides = Object.assign({}, require(paths.appPackageJson).jest);
  const supportedKeys = [
    'collectCoverageFrom',
    'coverageReporters',
    'coverageThreshold',
    'globalSetup',
    'globalTeardown',
    'resetMocks',
    'resetModules',
    'snapshotSerializers',
    'watchPathIgnorePatterns',
  ];
  if (overrides) {
    supportedKeys.forEach(key => {
      if (overrides.hasOwnProperty(key)) {
        config[key] = overrides[key];
        delete overrides[key];
      }
    });
    const unsupportedKeys = Object.keys(overrides);
    if (unsupportedKeys.length) {
      const isOverridingSetupFile =
        unsupportedKeys.indexOf('setupTestFrameworkScriptFile') > -1;

      if (isOverridingSetupFile) {
        console.error(
          chalk.red(
            'Nós detectamos ' +
              chalk.bold('setupTestFrameworkScriptFile') +
              ' no seu package.json.\n\n' +
              'Remova-o da configuração do Jest e coloque o código de inicialização em ' +
              chalk.bold('src/setupTests.js') +
              '.\nEste arquivo será carregado automaticamente.\n'
          )
        );
      } else {
        console.error(
          chalk.red(
            '\nFora da caixa, o Anteros Create App suporta apenas a substituição' +
              'estas opções de Jest:\n\n' +
              supportedKeys
                .map(key => chalk.bold('  \u2022 ' + key))
                .join('\n') +
              '.\n\n' +
              'Essas opções em seu package.json configuração Jest ' +
              'não são suportados atualmente pelo Anteros Create App:\n\n' +
              unsupportedKeys
                .map(key => chalk.bold('  \u2022 ' + key))
                .join('\n') +
              '\n\nSe você deseja substituir outras opções Jest, você precisa ' +
              'ejetar da configuração padrão. Você pode fazer isso executando ' +
              chalk.bold('npm run eject') +
              ' mas lembre-se que esta é uma operação unidirecional. ' +
              'Você também pode registrar um problema com o Anteros Create App para discutir ' +
              'suportando mais opções fora da caixa.\n'
          )
        );
      }

      process.exit(1);
    }
  }
  return config;
};
