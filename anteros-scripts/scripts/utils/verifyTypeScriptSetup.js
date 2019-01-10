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

const chalk = require('chalk');
const fs = require('fs');
const resolve = require('resolve');
const path = require('path');
const paths = require('../../config/paths');
const os = require('os');
const immer = require('react-dev-utils/immer').produce;
const globby = require('react-dev-utils/globby').sync;

function writeJson(fileName, object) {
  fs.writeFileSync(fileName, JSON.stringify(object, null, 2) + os.EOL);
}

function verifyNoTypeScript() {
  const typescriptFiles = globby('**/*.(ts|tsx)', { cwd: paths.appSrc });
  if (typescriptFiles.length > 0) {
    console.warn(
      chalk.yellow(
        `Detectamos o TypeScript no seu projeto (${chalk.bold(
          `src${path.sep}${typescriptFiles[0]}`
        )}) e criamos um ${chalk.bold('tsconfig.json')} arquivo para você.`
      )
    );
    console.warn();
    return false;
  }
  return true;
}

function verifyTypeScriptSetup() {
  let firstTimeSetup = false;

  if (!fs.existsSync(paths.appTsConfig)) {
    if (verifyNoTypeScript()) {
      return;
    }
    writeJson(paths.appTsConfig, {});
    firstTimeSetup = true;
  }

  const isYarn = fs.existsSync(paths.yarnLockFile);

  // Certifique-se de que o typescript esteja instalado
  let ts;
  try {
    ts = require(resolve.sync('typescript', {
      basedir: paths.appNodeModules,
    }));
  } catch (_) {
    console.error(
      chalk.bold.red(
        `Parece que você está tentando usar o TypeScript, mas não tem ${chalk.bold(
          'typescript'
        )} instalado.`
      )
    );
    console.error(
      chalk.bold(
        'Por favor instale',
        chalk.cyan.bold('typescript'),
        'executando ',
        chalk.cyan.bold(
          isYarn ? 'yarn add typescript' : 'npm install typescript'
        ) + '.'
      )
    );
    console.error(
      chalk.bold(
        'Se você não estiver tentando usar o TypeScript, remova ' +
          chalk.cyan('tsconfig.json') +
          ' arquivo do seu pacote raiz (e qualquer arquivo TypeScript).'
      )
    );
    console.error();
    process.exit(1);
  }

  const compilerOptions = {
    // Estes são valores sugeridos e serão definidos quando não estiverem presentes no
    // tsconfig.json
    // 'parsedValue' corresponde ao valor de saída de ts.parseJsonConfigFileContent ()
    target: {
      parsedValue: ts.ScriptTarget.ES5,
      suggested: 'es5',
    },
    lib: { suggested: ['dom', 'dom.iterable', 'esnext'] },
    allowJs: { suggested: true },
    skipLibCheck: { suggested: true },
    esModuleInterop: { suggested: true },
    allowSyntheticDefaultImports: { suggested: true },
    strict: { suggested: true },
    forceConsistentCasingInFileNames: { suggested: true },

    // Estes valores são obrigatórios e não podem ser alterados pelo usuário
    // Mantenha isso em sincronia com a configuração do webpack
    module: {
      parsedValue: ts.ModuleKind.ESNext,
      value: 'esnext',
      reason: 'para import() e import/export',
    },
    moduleResolution: {
      parsedValue: ts.ModuleResolutionKind.NodeJs,
      value: 'node',
      reason: 'para corresponder à resolução do webpack',
    },
    resolveJsonModule: { value: true, reason: 'para corresponder ao loader de webpack' },
    isolatedModules: { value: true, reason: 'limitação de implementação' },
    noEmit: { value: true },
    jsx: {
      parsedValue: ts.JsxEmit.Preserve,
      value: 'preserve',
      reason: 'JSX é compilado por Babel',
    },
    // Não apoiamos importações absolutas, embora isso possa vir como um futuro
    // Aprimoramento
    baseUrl: {
      value: undefined,
      reason: 'importações absolutas não são suportadas (ainda)',
    },
    paths: { value: undefined, reason: 'importações com alias não são suportadas' },
  };

  const formatDiagnosticHost = {
    getCanonicalFileName: fileName => fileName,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => os.EOL,
  };

  const messages = [];
  let appTsConfig;
  let parsedTsConfig;
  let parsedCompilerOptions;
  try {
    const { config: readTsConfig, error } = ts.readConfigFile(
      paths.appTsConfig,
      ts.sys.readFile
    );

    if (error) {
      throw new Error(ts.formatDiagnostic(error, formatDiagnosticHost));
    }

    appTsConfig = readTsConfig;

    // Pega o TS para analisar e resolver qualquer "extends"
    // Chamar essa função também altera o tsconfig acima,
    // adicionando "include" e "exclude", mas o compiladorOptions permanece intocado
    let result;
    parsedTsConfig = immer(readTsConfig, config => {
      result = ts.parseJsonConfigFileContent(
        config,
        ts.sys,
        path.dirname(paths.appTsConfig)
      );
    });

    if (result.errors && result.errors.length) {
      throw new Error(
        ts.formatDiagnostic(result.errors[0], formatDiagnosticHost)
      );
    }

    parsedCompilerOptions = result.options;
  } catch (e) {
    console.error(
      chalk.red.bold(
        'Não foi possível analisar',
        chalk.cyan('tsconfig.json') + '.',
        'Por favor, certifique-se que contém JSON sintaticamente correto.'
      )
    );
    console.error(e && e.message ? `Detalhes: ${e.message}` : '');
    process.exit(1);
  }

  if (appTsConfig.compilerOptions == null) {
    appTsConfig.compilerOptions = {};
    firstTimeSetup = true;
  }

  for (const option of Object.keys(compilerOptions)) {
    const { parsedValue, value, suggested, reason } = compilerOptions[option];

    const valueToCheck = parsedValue === undefined ? value : parsedValue;
    const coloredOption = chalk.cyan('compilerOptions.' + option);

    if (suggested != null) {
      if (parsedCompilerOptions[option] === undefined) {
        appTsConfig.compilerOptions[option] = suggested;
        messages.push(
          `${coloredOption} é ${chalk.bold(
            'sugerido'
          )} valor: ${chalk.cyan.bold(suggested)} (isso pode ser alterado)`
        );
      }
    } else if (parsedCompilerOptions[option] !== valueToCheck) {
      appTsConfig.compilerOptions[option] = value;
      messages.push(
        `${coloredOption} ${chalk.bold(
          valueToCheck == null ? 'Não deve' : 'deve'
        )} ser ${valueToCheck == null ? 'set' : chalk.cyan.bold(value)}` +
          (reason != null ? ` (${reason})` : '')
      );
    }
  }

  // O tsconfig terá o "include" e "exclude" mesclados por este ponto
  if (parsedTsConfig.include == null) {
    appTsConfig.include = ['src'];
    messages.push(
      `${chalk.cyan('include')} deveria ser ${chalk.cyan.bold('src')}`
    );
  }

  if (messages.length > 0) {
    if (firstTimeSetup) {
      console.log(
        chalk.bold(
          'Seu',
          chalk.cyan('tsconfig.json'),
          'foi preenchido com valores padrão.'
        )
      );
      console.log();
    } else {
      console.warn(
        chalk.bold(
          'As seguintes alterações estão sendo feitas no seu arquivo',
          chalk.cyan('tsconfig.json')
        )
      );
      messages.forEach(message => {
        console.warn('  - ' + message);
      });
      console.warn();
    }
    writeJson(paths.appTsConfig, appTsConfig);
  }

  // Reference `anteros-scripts` types
  if (!fs.existsSync(paths.appTypeDeclarations)) {
    fs.writeFileSync(
      paths.appTypeDeclarations,
      `/// <reference types="anteros-scripts" />${os.EOL}`
    );
  }
}

module.exports = verifyTypeScriptSetup;
