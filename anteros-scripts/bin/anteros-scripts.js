#!/usr/bin/env node
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

const spawn = require('react-dev-utils/crossSpawn');
const args = process.argv.slice(2);

const scriptIndex = args.findIndex(
  x => x === 'build' || x === 'eject' || x === 'start' || x === 'test'
);
const script = scriptIndex === -1 ? args[0] : args[scriptIndex];
const nodeArgs = scriptIndex > 0 ? args.slice(0, scriptIndex) : [];

switch (script) {
  case 'build':
  case 'eject':
  case 'start':
  case 'test': {
    const result = spawn.sync(
      'node',
      nodeArgs
        .concat(require.resolve('../scripts/' + script))
        .concat(args.slice(scriptIndex + 1)),
      { stdio: 'inherit' }
    );
    if (result.signal) {
      if (result.signal === 'SIGKILL') {
        console.log(
          'A compilação falhou porque o processo terminou muito cedo. ' +
            'Isso provavelmente significa que o sistema ficou sem memória ou alguém chamou ' +
            '`kill -9` no processo.'
        );
      } else if (result.signal === 'SIGTERM') {
        console.log(
          'A construção falhou porque o processo foi encerrado cedo demais. '+
          'Alguém pode ter chamado `kill` ou` killall`, ou o sistema poderia' +
          "estar desligando."
        );
      }
      process.exit(1);
    }
    process.exit(result.status);
    break;
  }
  default:
    console.log('Script desconhecido "' + script + '".');
    console.log('Talvez você precise atualizar anteros-scripts?');
    console.log(
      'Veja: https://github.com/anterostecnologia/anteroscreateapp'
    );
    break;
}
