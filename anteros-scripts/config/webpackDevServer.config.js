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

const errorOverlayMiddleware = require('react-dev-utils/errorOverlayMiddleware');
const evalSourceMapMiddleware = require('react-dev-utils/evalSourceMapMiddleware');
const noopServiceWorkerMiddleware = require('react-dev-utils/noopServiceWorkerMiddleware');
const ignoredFiles = require('react-dev-utils/ignoredFiles');
const paths = require('./paths');
const fs = require('fs');

const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
const host = process.env.HOST || '0.0.0.0';

module.exports = function(proxy, allowedHost) {
  return {
    // WebpackDevServer 2.4.3 introduziu uma correção de segurança que impede a
    // sites que potencialmente acessam conteúdo local por meio da religação de DNS:
    // https://github.com/webpack/webpack-dev-server/issues/887
    // https://medium.com/webpack/webpack-dev-server-middleware-security-issues-1489d950874a
    // No entanto, ele fez vários casos de uso existentes, como desenvolvimento em nuvem
    // ambiente ou subdomínios em desenvolvimento significativamente mais complicado:
    // Enquanto estamos investigando soluções melhores, por enquanto vamos dar uma
    // como compromisso. Já que nossa configuração do WDS só serve arquivos na pasta `public`,
    // não consideraremos o acesso a uma vulnerabilidade. No entanto, se você
    // use o recurso `proxy`, fica mais perigoso porque pode expor
    // vulnerabilidades de execução remota de código em backends como Django e Rails.
    // Então vamos desabilitar a verificação do host normalmente, mas vc habilitá-lo se você tiver
    // especificado a configuração `proxy`. Finalmente, deixamos que você o substitua se você
    // realmente sabe o que você está fazendo com uma variável de ambiente especial.
    disableHostCheck:
      !proxy || process.env.DANGEROUSLY_DISABLE_HOST_CHECK === 'true',
    // Ative a compactação gzip de arquivos gerados.
    compress: true,
    // Silencia os logs do próprio WebpackDevServer, pois geralmente não são úteis.
    // Ele ainda mostrará avisos e erros de compilação com essa configuração.
    clientLogLevel: 'none',
    // Por padrão, o WebpackDevServer exibe arquivos físicos do diretório atual
    // além de todos os produtos de construção virtual que ele obtém da memória.
    // Isso é confuso porque esses arquivos não estarão disponíveis automaticamente
    // na pasta de criação de produção, a menos que as copiemos. No entanto, copiar o todo
    // o diretório do projeto é perigoso porque podemos expor arquivos sensíveis.
    // Em vez disso, estabelecemos uma convenção que apenas arquivos no diretório `public`
    // é disponilizados. Nosso script de construção irá copiar `public` para a pasta` build`.
    // Em `index.html`, você pode obter o URL da pasta` public` com %PUBLIC_URL%:
    // <link rel = "ícone de atalho" href = "%PUBLIC_URL%/favicon.ico">
    // No código JavaScript, você pode acessá-lo com `process.env.PUBLIC_URL`.
    // Observe que só recomendamos usar a pasta `public` como uma escotilha de escape
    // para arquivos como `favicon.ico`,` manifest.json` e bibliotecas que são
    // por algum motivo quebrado quando importado através do Webpack. Se você quer apenas
    // usar uma imagem, coloque-a em `src` e importe-a do JavaScript.
    contentBase: paths.appPublic,
    // Por padrão, arquivos de `contentBase` não acionarão um recarregamento de página.
    watchContentBase: true,
    // Habilita servidor de recarregamento a quente. Ele fornecerá /sockjs-node/ endpoint
    // para o cliente WebpackDevServer para que ele possa saber quando os arquivos foram
    // atualizados. O cliente WebpackDevServer é incluído como um ponto de entrada
    // na configuração de desenvolvimento do Webpack. Note que apenas mudanças
    // para CSS estão atualmente recarregados. As alterações do JS atualizam o navegador.
    hot: true,
    // É importante dizer ao WebpackDevServer para usar o mesmo caminho "root"
    // conforme especificado na configuração. Em desenvolvimento, sempre servimos de /.
    publicPath: '/',
    // WebpackDevServer gera muitas mensagens por padrão, então emitimos uma mensagem personalizada
    // escutando os eventos do compilador com as chamadas `compiler.hooks [...]. tap` acima.
    quiet: true,
    // Reportedly, isso evita sobrecarga da CPU em alguns sistemas.
    // src/node_modules não é ignorado para suportar importações absolutas
    watchOptions: {
      ignored: ignoredFiles(paths.appSrc),
    },
    // Ativar HTTPS se a variável de ambiente HTTPS estiver definida como 'true'
    https: protocol === 'https',
    host,
    overlay: false,
    historyApiFallback: {
      // Os caminhos com pontos ainda devem usar o fallback do histórico.
      disableDotRule: true,
    },
    public: allowedHost,
    proxy,
    before(app, server) {
      if (fs.existsSync(paths.proxySetup)) {
        // Isso registra o middleware fornecido pelo usuário por razões de proxy
        require(paths.proxySetup)(app);
      }

      // Isso nos permite buscar o conteúdo de origem do webpack para a sobreposição de erro
      app.use(evalSourceMapMiddleware(server));
      // Isso nos permite abrir arquivos da sobreposição de erro de tempo de execução.
      app.use(errorOverlayMiddleware());

      // Este arquivo do service worker é efetivamente um 'no-op' que redefinirá qualquer
      // service worker anterior registrado para o mesmo host: combinação de portas.
      // Fazemos isso em desenvolvimento para evitar atingir o cache de produção se
      // usou o mesmo host e porta.
      app.use(noopServiceWorkerMiddleware());
    },
  };
};
