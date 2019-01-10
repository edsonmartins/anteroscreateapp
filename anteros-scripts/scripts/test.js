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
process.env.BABEL_ENV = 'test';
process.env.NODE_ENV = 'test';
process.env.PUBLIC_URL = '';

// Faz o script travar em rejeições não tratadas em vez de silenciosamente
// ignorando-os. No futuro, rejeições que não forem tratadas
// terminam o processo Node.js com um código de saída diferente de zero.
process.on('unhandledRejection', err => {
  throw err;
});

// Certifique-se de que as variáveis ​​de ambiente sejam lidas.
require('../config/env');
// @remove-on-eject-begin
// Faça a verificação prévia (só acontece antes de ejetar).
const verifyPackageTree = require('./utils/verifyPackageTree');
if (process.env.SKIP_PREFLIGHT_CHECK !== 'true') {
  verifyPackageTree();
}
const verifyTypeScriptSetup = require('./utils/verifyTypeScriptSetup');
verifyTypeScriptSetup();
// @remove-on-eject-end

const jest = require('jest');
const execSync = require('child_process').execSync;
let argv = process.argv.slice(2);

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

// Assista, a menos que no CI, no modo de cobertura ou executando explicitamente todos os testes
if (
  !process.env.CI &&
  argv.indexOf('--coverage') === -1 &&
  argv.indexOf('--watchAll') === -1
) {
  const hasSourceControl = isInGitRepository() || isInMercurialRepository();
  argv.push(hasSourceControl ? '--watch' : '--watchAll');
}

// @remove-on-eject-begin
// Isso não é necessário após a ejeção, pois incorporamos a configuração em package.json.
const createJestConfig = require('./utils/createJestConfig');
const path = require('path');
const paths = require('../config/paths');
argv.push(
  '--config',
  JSON.stringify(
    createJestConfig(
      relativePath => path.resolve(__dirname, '..', relativePath),
      path.resolve(paths.appSrc, '..'),
      false
    )
  )
);

const resolve = require('resolve');
function resolveJestDefaultEnvironment(name) {
  const jestDir = path.dirname(
    resolve.sync('jest', {
      basedir: __dirname,
    })
  );
  const jestCLIDir = path.dirname(
    resolve.sync('jest-cli', {
      basedir: jestDir,
    })
  );
  const jestConfigDir = path.dirname(
    resolve.sync('jest-config', {
      basedir: jestCLIDir,
    })
  );
  return resolve.sync(name, {
    basedir: jestConfigDir,
  });
}
let cleanArgv = [];
let env = 'jsdom';
let next;
do {
  next = argv.shift();
  if (next === '--env') {
    env = argv.shift();
  } else if (next.indexOf('--env=') === 0) {
    env = next.substring('--env='.length);
  } else {
    cleanArgv.push(next);
  }
} while (argv.length > 0);
argv = cleanArgv;
let resolvedEnv;
try {
  resolvedEnv = resolveJestDefaultEnvironment(`jest-environment-${env}`);
} catch (e) {
  // ignorar
}
if (!resolvedEnv) {
  try {
    resolvedEnv = resolveJestDefaultEnvironment(env);
  } catch (e) {
    // ignorar
  }
}
const testEnvironment = resolvedEnv || env;
argv.push('--env', testEnvironment);
// @remove-on-eject-end
jest.run(argv);
