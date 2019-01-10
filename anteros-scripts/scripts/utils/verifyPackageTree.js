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
const path = require('path');

// Assumimos que ter versões erradas desses
// na árvore provavelmente irá quebrar sua configuração.
// Esta é uma maneira de esforço relativamente baixo para encontrar problemas comuns.
function verifyPackageTree() {
  const depsToCheck = [    
    'babel-eslint',
    'babel-jest',
    'babel-loader',
    'eslint',
    'jest',
    'webpack',
    'webpack-dev-server',
  ];
  // Inlined from semver-regex, licença MIT.
  // Não quero tornar isso uma dependência após ejetar.
  const getSemverRegex = () =>
    /\bv?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\da-z-]+(?:\.[\da-z-]+)*)?(?:\+[\da-z-]+(?:\.[\da-z-]+)*)?\b/gi;
  const ownPackageJson = require('../../package.json');
  const expectedVersionsByDep = {};
  // Reúne procurados
  depsToCheck.forEach(dep => {
    const expectedVersion = ownPackageJson.dependencies[dep];
    if (!expectedVersion) {
      throw new Error('Esta lista de dependências está desatualizada, corrija-a.');
    }
    if (!getSemverRegex().test(expectedVersion)) {
      throw new Error(
        `O ${dep} pacote deve ser fixado, em vez disso tem versão ${expectedVersion}.`
      );
    }
    expectedVersionsByDep[dep] = expectedVersion;
  });
  // Verifique se não temos outras versões na árvore
  let currentDir = __dirname;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const previousDir = currentDir;
    currentDir = path.resolve(currentDir, '..');
    if (currentDir === previousDir) {
      // Nós alcançamos a raiz.
      break;
    }
    const maybeNodeModules = path.resolve(currentDir, 'node_modules');
    if (!fs.existsSync(maybeNodeModules)) {
      continue;
    }
    depsToCheck.forEach(dep => {
      const maybeDep = path.resolve(maybeNodeModules, dep);
      if (!fs.existsSync(maybeDep)) {
        return;
      }
      const maybeDepPackageJson = path.resolve(maybeDep, 'package.json');
      if (!fs.existsSync(maybeDepPackageJson)) {
        return;
      }
      const depPackageJson = JSON.parse(
        fs.readFileSync(maybeDepPackageJson, 'utf8')
      );
      const expectedVersion = expectedVersionsByDep[dep];
      if (depPackageJson.version !== expectedVersion) {
        console.error(
          chalk.red(
            `\nPode haver um problema com a árvore de dependência do projeto.\n` +
              `É provável ${chalk.bold(
                'não'
              )} é um bug no Anteros Create App, mas algo que você precisa corrigir localmente.\n\n`
          ) +
            `O ${chalk.bold(
              ownPackageJson.name
            )} pacote fornecido pelo Anteros Create App requer uma dependência:\n\n` +
            chalk.green(
              `  "${chalk.bold(dep)}": "${chalk.bold(expectedVersion)}"\n\n`
            ) +
            `Não tente instalá-lo manualmente: o gerenciador de pacotes faz isso automaticamente.\n` +
            `No entanto, uma versão diferente do ${chalk.bold(
              dep
            )} foi detectado mais acima na árvore:\n\n` +
            `  ${chalk.bold(chalk.red(maybeDep))} (version: ${chalk.bold(
              chalk.red(depPackageJson.version)
            )}) \n\n` +
            `A instalação manual de versões incompatíveis é conhecida por causar problemas difíceis de depurar.\n\n` +
            chalk.red(
              `Se você preferir ignorar essa verificação, adicione ${chalk.bold(
                'SKIP_PREFLIGHT_CHECK=true'
              )} para um ${chalk.bold('.env')} arquivo em seu projeto.\n` +
                `Isso desativará permanentemente esta mensagem, mas você poderá encontrar outros problemas.\n\n`
            ) +
            `Para ${chalk.green(
              'corrigir'
            )} a árvore de dependência, tente seguir as etapas abaixo na ordem exata:\n\n` +
            `  ${chalk.cyan('1.')} Remova ${chalk.bold(
              'package-lock.json'
            )} (${chalk.underline('não')} ${chalk.bold(
              'package.json'
            )}!) e/ou ${chalk.bold('yarn.lock')} na pasta do seu projeto.\n` +
            `  ${chalk.cyan('2.')} Remova ${chalk.bold(
              'node_modules'
            )} na pasta do seu projeto.\n` +
            `  ${chalk.cyan('3.')} Remova "${chalk.bold(
              dep
            )}" de ${chalk.bold('dependencies')} e/ou ${chalk.bold(
              'devDependencies'
            )} no ${chalk.bold(
              'package.json'
            )} na pasta do seu projeto.\n` +
            `  ${chalk.cyan('4.')} Rode ${chalk.bold(
              'npm install'
            )} ou ${chalk.bold(
              'yarn'
            )}, dependendo do gerenciador de pacotes que você usa.\n\n` +
            `Na maioria dos casos, isso deve ser suficiente para corrigir o problema.\n` +
            `Se isso não ajudou, há algumas outras coisas que você pode tentar:\n\n` +
            `  ${chalk.cyan('5.')} Se você usou ${chalk.bold(
              'npm'
            )}, install ${chalk.bold(
              'yarn'
            )} (http://yarnpkg.com/) e repita os passos acima com isso.\n` +
            `     Isso pode ajudar porque o npm tem problemas conhecidos com o içamento de pacotes que podem ser resolvidos em versões futuras.\n\n` +
            `  ${chalk.cyan('6.')} Verifique se ${chalk.bold(
              maybeDep
            )} está fora do diretório do seu projeto.\n` +
            `     Por exemplo, você pode ter instalado algo acidentalmente na sua pasta pessoal.\n\n` +
            `  ${chalk.cyan('7.')} Tente rodar ${chalk.bold(
              `npm ls ${dep}`
            )} na pasta do seu projeto.\n` +
            `     Isto irá dizer-lhe qual ${chalk.underline(
              'outro'
            )} pacote (além do esperado ${chalk.bold(
              ownPackageJson.name
            )}) instalado ${chalk.bold(dep)}.\n\n` +
            `Se nada mais ajudar, adicione ${chalk.bold(
              'SKIP_PREFLIGHT_CHECK=true'
            )} para um ${chalk.bold('.env')} arquivo em seu projeto.\n` +
            `Isso desativaria permanentemente essa verificação de comprovação, caso você queira continuar de qualquer maneira.\n\n` +
            chalk.cyan(
              `P.S. Sabemos que esta mensagem é longa, mas leia os passos acima :-) Esperamos que você os ache úteis.!\n`
            )
        );
        process.exit(1);
      }
    });
  }
}

module.exports = verifyPackageTree;
