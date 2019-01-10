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

const fs = require('fs');
const path = require('path');
const paths = require('./paths');

// Certifique-se de que incluir paths.js após env.js leia variáveis ​​.env.
delete require.cache[require.resolve('./paths')];

const NODE_ENV = process.env.NODE_ENV;
if (!NODE_ENV) {
  throw new Error(
    'The NODE_ENV environment variable is required but was not specified.'
  );
}

// https://github.com/bkeepers/dotenv#what-other-env-files-can-i-use
var dotenvFiles = [
  `${paths.dotenv}.${NODE_ENV}.local`,
  `${paths.dotenv}.${NODE_ENV}`,
  // Não inclua `.env.local` para o ambiente` test`
  // já que normalmente você espera que os testes produzam o mesmo
  // resultados para todos
  NODE_ENV !== 'test' && `${paths.dotenv}.local`,
  paths.dotenv,
].filter(Boolean);

// Carrega variáveis ​​de ambiente de arquivos .env *. Suprimir avisos usando o modo silencioso
// se este arquivo estiver faltando. O dotenv nunca modificará nenhuma variável de ambiente
// que já foram definidos. A expansão de variáveis ​​é suportada em arquivos .env.
// https://github.com/motdotla/dotenv
// https://github.com/motdotla/dotenv-expand
dotenvFiles.forEach(dotenvFile => {
  if (fs.existsSync(dotenvFile)) {
    require('dotenv-expand')(
      require('dotenv').config({
        path: dotenvFile,
      })
    );
  }
});


const appDirectory = fs.realpathSync(process.cwd());
process.env.NODE_PATH = (process.env.NODE_PATH || '')
  .split(path.delimiter)
  .filter(folder => folder && !path.isAbsolute(folder))
  .map(folder => path.resolve(appDirectory, folder))
  .join(path.delimiter);

// Pegue as variáveis ​​de ambiente NODE_ENV e REACT_APP_ * e prepare-as para serem
// injetado no aplicativo via DefinePlugin na configuração do Webpack.
const REACT_APP = /^REACT_APP_/i;

function getClientEnvironment(publicUrl) {
  const raw = Object.keys(process.env)
    .filter(key => REACT_APP.test(key))
    .reduce(
      (env, key) => {
        env[key] = process.env[key];
        return env;
      },
      {
        // Útil para determinar se estamos executando no modo de produção.
        // Mais importante, ele muda o React para o modo correto.
        NODE_ENV: process.env.NODE_ENV || 'development',
        // Útil para resolver o caminho correto para ativos estáticos em `public`.
        // Por exemplo, <img src = {process.env.PUBLIC_URL + '/img/logo.png'} />.
        // Isso só deve ser usado como uma escotilha de escape. Normalmente você colocaria
        // imagens no `src` e` importá-las no código para obter seus caminhos.
        PUBLIC_URL: publicUrl,
      }
    );
  // Stringify todos os valores para que possamos alimentar no Webpack DefinePlugin
  const stringified = {
    'process.env': Object.keys(raw).reduce((env, key) => {
      env[key] = JSON.stringify(raw[key]);
      return env;
    }, {}),
  };

  return { raw, stringified };
}

module.exports = getClientEnvironment;
