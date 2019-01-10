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
const webpack = require('webpack');
const resolve = require('resolve');
const PnpWebpackPlugin = require('pnp-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CaseSensitivePathsPlugin = require('case-sensitive-paths-webpack-plugin');
const InlineChunkHtmlPlugin = require('react-dev-utils/InlineChunkHtmlPlugin');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const safePostCssParser = require('postcss-safe-parser');
const ManifestPlugin = require('webpack-manifest-plugin');
const InterpolateHtmlPlugin = require('react-dev-utils/InterpolateHtmlPlugin');
const WorkboxWebpackPlugin = require('workbox-webpack-plugin');
const WatchMissingNodeModulesPlugin = require('react-dev-utils/WatchMissingNodeModulesPlugin');
const ModuleScopePlugin = require('react-dev-utils/ModuleScopePlugin');
const getCSSModuleLocalIdent = require('react-dev-utils/getCSSModuleLocalIdent');
const paths = require('./paths');
const getClientEnvironment = require('./env');
const ModuleNotFoundPlugin = require('react-dev-utils/ModuleNotFoundPlugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin-alt');
const typescriptFormatter = require('react-dev-utils/typescriptFormatter');
// @remove-on-eject-begin
const getCacheIdentifier = require('react-dev-utils/getCacheIdentifier');
// @remove-on-eject-end

// Os Source Maps são pesados ​​em recursos e podem causar problemas de falta de memória para arquivos de origem grandes.
const shouldUseSourceMap = process.env.GENERATE_SOURCEMAP !== 'false';
// Alguns aplicativos não precisam dos benefícios de salvar uma solicitação da Web, portanto, não é necessário incluir o bloco
// contribui para um processo de construção mais suave.
const shouldInlineRuntimeChunk = process.env.INLINE_RUNTIME_CHUNK !== 'false';

// Verifique se o TypeScript está configurado
const useTypeScript = fs.existsSync(paths.appTsConfig);

// arquivos de estilo regexes
const cssRegex = /\.css$/;
const cssModuleRegex = /\.module\.css$/;
const sassRegex = /\.(scss|sass)$/;
const sassModuleRegex = /\.module\.(scss|sass)$/;

// Esta é a configuração de produção e desenvolvimento.
// É focado na experiência do desenvolvedor, reconstruções rápidas e um pacote mínimo.
module.exports = function(webpackEnv) {
  const isEnvDevelopment = webpackEnv === 'development';
  const isEnvProduction = webpackEnv === 'production';

  // O Webpack usa o `publicPath` para determinar de onde o aplicativo está sendo servido.
  // Requer uma barra final ou os assets de arquivo receberão um caminho incorreto.
  // Em desenvolvimento, sempre partimos da raiz. Isso torna a configuração mais fácil.
  const publicPath = isEnvProduction
    ? paths.servedPath
    : isEnvDevelopment && '/';
  // Alguns aplicativos não usam o roteamento do lado do cliente com o pushState.
  // Para estes, "homepage" pode ser definido como "." para ativar caminhos de ativos relativos.
  const shouldUseRelativeAssetPaths = publicPath === './';

  // `publicUrl` é como` publicPath`, mas iremos fornecer isso para nosso aplicativo
  // como% PUBLIC_URL% em `index.html` e` process.env.PUBLIC_URL` em JavaScript.
  // Omitir barra como% PUBLIC_URL% / xyz parece melhor que% PUBLIC_URL% xyz.
  const publicUrl = isEnvProduction
    ? publicPath.slice(0, -1)
    : isEnvDevelopment && '';
  // Obtenha variáveis ​​de ambiente para injetar em nosso aplicativo.
  const env = getClientEnvironment(publicUrl);

  // unção comum para obter carregadores de estilo
  const getStyleLoaders = (cssOptions, preProcessor) => {
    const loaders = [
      isEnvDevelopment && require.resolve('style-loader'),
      isEnvProduction && {
        loader: MiniCssExtractPlugin.loader,
        options: Object.assign(
          {},
          shouldUseRelativeAssetPaths ? { publicPath: '../../' } : undefined
        ),
      },
      {
        loader: require.resolve('css-loader'),
        options: cssOptions,
      },
      {
        // Options for PostCSS conforme nós referenciamos essas opções duas vezes
        // Adiciona o prefixo do fornecedor com base no suporte do navegador especificado em
        // package.json
        loader: require.resolve('postcss-loader'),
        options: {
          // Necessário para importações de CSS externas para trabalhar
          ident: 'postcss',
          plugins: () => [
            require('postcss-flexbugs-fixes'),
            require('postcss-preset-env')({
              autoprefixer: {
                flexbox: 'no-2009',
              },
              stage: 3,
            }),
          ],
          sourceMap: isEnvProduction && shouldUseSourceMap,
        },
      },
    ].filter(Boolean);
    if (preProcessor) {
      loaders.push({
        loader: require.resolve(preProcessor),
        options: {
          sourceMap: isEnvProduction && shouldUseSourceMap,
        },
      });
    }
    return loaders;
  };

  return {
    mode: isEnvProduction ? 'production' : isEnvDevelopment && 'development',
    // Pare a compilação no início da produção
    bail: isEnvProduction,
    devtool: isEnvProduction
      ? shouldUseSourceMap
        ? 'source-map'
        : false
      : isEnvDevelopment && 'eval-source-map',
    // Estes são os "pontos de entrada" para o nosso aplicativo.
    // Isso significa que elas serão as importações "raiz" incluídas no pacote JS.
    entry: [
      // Incluir um cliente alternativo para WebpackDevServer. O trabalho de um cliente é
      // conectar-se ao WebpackDevServer por um socket e ser notificado sobre mudanças.
      // Quando você salva um arquivo, o cliente também aplica atualizações rápidas (no caso de
      // de alterações CSS), ou atualize a página (no caso de alterações JS). Quando você
      // criar um erro de sintaxe, esse cliente exibirá uma sobreposição de erro de sintaxe.
      // Nota: em vez do cliente WebpackDevServer padrão, usamos um personalizado
      // para trazer uma melhor experiência para os usuários do Anteros Create App. Você pode substituir
      // a linha abaixo com estas duas linhas se você preferir o cliente padrão do webpack:
      // require.resolve ('webpack-dev-server/client') + '?/',
      // require.resolve ('webpack/hot/dev-server'),
      isEnvDevelopment &&
        require.resolve('react-dev-utils/webpackHotDevClient'),
      // Finalmente, este é o código do seu aplicativo:
      paths.appIndexJs,
      // Incluímos o código do aplicativo por último para que, se houver um erro de tempo de execução durante
      // inicialização, não acione o cliente WebpackDevServer e
      // alterar o código JS ainda acionaria uma atualização.
    ].filter(Boolean),
    output: {
      // A pasta de construção.
      path: isEnvProduction ? paths.appBuild : undefined,
      // Adicionar /* filename */ comentários para require()s gerados na saída.
      pathinfo: isEnvDevelopment,
      // Haverá um pacote principal e um arquivo por trecho assíncrono.
      // Em desenvolvimento, não produz arquivos reais.
      filename: isEnvProduction
        ? 'static/js/[name].[chunkhash:8].js'
        : isEnvDevelopment && 'static/js/bundle.js',
      // Também há arquivos de fragmento JS adicionais se você usar a divisão de código.
      chunkFilename: isEnvProduction
        ? 'static/js/[name].[chunkhash:8].chunk.js'
        : isEnvDevelopment && 'static/js/[name].chunk.js',
      // Inferimos o "caminho público" (como / ou /my-project) da página inicial.
      // Usamos "/" em desenvolvimento.
      publicPath: publicPath,
      // Aponte as entradas do sourcemap para a localização original do disco (formato como URL no Windows)
      devtoolModuleFilenameTemplate: isEnvProduction
        ? info =>
            path
              .relative(paths.appSrc, info.absoluteResourcePath)
              .replace(/\\/g, '/')
        : isEnvDevelopment &&
          (info => path.resolve(info.absoluteResourcePath).replace(/\\/g, '/')),
    },
    optimization: {
      minimize: isEnvProduction,
      minimizer: [
        // Isso é usado apenas no modo de produção
        new TerserPlugin({
          terserOptions: {
            parse: {
              // queremos que o terser analise o código do ecma 8. No entanto, não queremos
              // para aplicar quaisquer etapas de minficação que ativem o código válido do ecma 5
              // no código ecma 5 inválido. É por isso que a 'compressa' e 'saída'
              // seções somente aplicam transformações que são ecma 5 seguras
              ecma: 8,
            },
            compress: {
              ecma: 5,
              warnings: false,
              // Desabilitado devido a um problema com o Uglify quebrando um código aparentemente válido:
              // Aguardando investigação adicional.
              comparisons: false,
              // Desabilitado devido a um problema com o Terser quebrando o código válido:
              // Aguardando investigação adicional.
              inline: 2,
            },
            mangle: {
              safari10: true,
            },
            output: {
              ecma: 5,
              comments: false,
              // Ligado porque emoji e regex não são minificados corretamente usando o padrão
              ascii_only: true,
            },
          },
          // Use a execução paralela de vários processos para melhorar a velocidade de construção
          // Número padrão de execuções simultâneas: os.cpus (). Length - 1
          parallel: true,
          // Ativar armazenamento em cache de arquivos
          cache: true,
          sourceMap: shouldUseSourceMap,
        }),
        // Isso é usado apenas no modo de produção
        new OptimizeCSSAssetsPlugin({
          cssProcessorOptions: {
            parser: safePostCssParser,
            map: shouldUseSourceMap
              ? {
                  // `inline: false` força o sourcemap a ser gerado em um
                  // arquivo separado
                  inline: false,
                  // `annotation: true` acrescenta o sourceMappingURL ao final do
                  // o arquivo css, ajudando o navegador a encontrar o sourcemap
                  annotation: true,
                }
              : false,
          },
        }),
      ],
      // Automaticamente dividir fornecedor e commons
      // https://twitter.com/wSokra/status/969633336732905474
      // https://medium.com/webpack/webpack-4-code-splitting-chunk-graph-and-the-splitchunks-optimization-be739a861366
      splitChunks: {
        chunks: 'all',
        name: false,
      },
      // Mantenha o fragmento de tempo de execução separado para ativar o armazenamento em cache de longo prazo
      // https://twitter.com/wSokra/status/969679223278505985
      runtimeChunk: true,
    },
    resolve: {
      // Isso permite que você defina um fallback para onde o Webpack deve procurar por módulos.
      // Colocamos esses caminhos em segundo lugar porque queremos que o node_modules "ganhe"
      // se houver algum conflito. Isso corresponde ao mecanismo de resolução do Node.
      modules: ['node_modules'].concat(
        // É garantido que existe porque o ajustamos em `env.js`
        process.env.NODE_PATH.split(path.delimiter).filter(Boolean)
      ),
      // Estes são os padrões razoáveis ​​suportados pelo ecossistema do Nó.
      // Também incluímos o JSX como uma extensão de nome de arquivo de componente comum para suportar
      // algumas ferramentas, embora não recomendemos usá-lo.
      // Os prefixos de extensão web foram adicionados para melhor suporte
      // para React Native Web.
      extensions: paths.moduleFileExtensions
        .map(ext => `.${ext}`)
        .filter(ext => useTypeScript || !ext.includes('ts')),
      alias: {
        // Suporte React Native Web
        // https://www.smashingmagazine.com/2016/08/a-glimpse-into-the-future-with-react-native-for-web/
        'react-native': 'react-native-web',
      },
      plugins: [
        // Adiciona suporte para instalação com Plug'n'Play, levando a instalações mais rápidas e adicionando
        // protege contra dependências esquecidas e tal.
        PnpWebpackPlugin,
        // Impede que os usuários importem arquivos de fora de src / (ou node_modules /).
        // Isso geralmente causa confusão porque processamos somente arquivos dentro de src / com o babel.
        // Para corrigir isso, impedimos que você importe arquivos de src / - se você quiser,
        // por favor, ligue os arquivos em seu node_modules / e deixe a resolução do módulo entrar.
        // Certifique-se de que seus arquivos de origem estejam compilados, pois eles não serão processados ​​de forma alguma.
        new ModuleScopePlugin(paths.appSrc, [paths.appPackageJson]),
      ],
    },
    resolveLoader: {
      plugins: [
        // Também relacionado ao Plug'n'Play, mas desta vez ele diz ao Webpack para carregar seus loaders
        // do pacote atual.
        PnpWebpackPlugin.moduleLoader(module),
      ],
    },
    module: {
      strictExportPresence: true,
      rules: [
        // Desativar require.ensure, pois não é um recurso de idioma padrão.
        { parser: { requireEnsure: false } },

        // Primeiro, execute o linter.
        // É importante fazer isso antes que o Babel processe o JS.
        {
          test: /\.(js|mjs|jsx)$/,
          enforce: 'pre',
          use: [
            {
              options: {
                formatter: require.resolve('react-dev-utils/eslintFormatter'),
                eslintPath: require.resolve('eslint'),
                // @remove-on-eject-begin
                baseConfig: {
                  extends: [require.resolve('eslint-config-react-app')],
                },
                ignore: false,
                useEslintrc: false,
                // @remove-on-eject-end
              },
              loader: require.resolve('eslint-loader'),
            },
          ],
          include: paths.appSrc,
        },
        {
          // "oneOf" irá percorrer todos os seguintes loaders até que um
          // corresponde aos requisitos. Quando nenhum carregador corresponder, ele irá
          // voltar para o carregador de "arquivos" no final da lista de carregadores.
          oneOf: [
            // O "url" loader funciona como o "file" loader, exceto que ele incorpora recursos
            // menores que o limite especificado em bytes como URLs de dados para evitar solicitações.
            // Um ​​`test` faltante é equivalente a uma correspondência.
            {
              test: [/\.bmp$/, /\.gif$/, /\.jpe?g$/, /\.png$/],
              loader: require.resolve('url-loader'),
              options: {
                limit: 10000,
                name: 'static/media/[name].[hash:8].[ext]',
              },
            },
            // Processa o aplicativo JS com o Babel.
            // A predefinição inclui recursos JSX, Flow, TypeScript e alguns recursos ESnext.
            {
              test: /\.(js|mjs|jsx|ts|tsx)$/,
              include: paths.appSrc,
              loader: require.resolve('babel-loader'),
              options: {
                customize: require.resolve(
                  'babel-preset-react-app/webpack-overrides'
                ),
                // @remove-on-eject-begin
                babelrc: false,
                configFile: false,
                presets: [require.resolve('babel-preset-react-app')],
                // Verifique se temos um identificador de cache exclusivo, errando no
                // lado da cautela.
                // Nós removemos isso quando o usuário ejeta porque o padrão
                // é são e usa as opções do Babel. Em vez de opções, usamos
                // as versões anteros-scripts e babel-preset-react-app.
                cacheIdentifier: getCacheIdentifier(
                  isEnvProduction
                    ? 'production'
                    : isEnvDevelopment && 'development',
                  [
                    'babel-plugin-named-asset-import',
                    'babel-preset-react-app',
                    'react-dev-utils',
                    'anteros-scripts',
                  ]
                ),
                // @remove-on-eject-end
                plugins: [
                  [
                    require.resolve('babel-plugin-named-asset-import'),
                    {
                      loaderMap: {
                        svg: {
                          ReactComponent:
                            '@svgr/webpack?-prettier,-svgo![path]',
                        },
                      },
                    },
                  ],
                ],
                // Este é um recurso do `babel-loader` para o webpack (não o próprio Babel).
                // Permite armazenar os resultados de cache em ./node_modules/.cache/babel-loader/
                // diretório para reconstruções mais rápidas.
                cacheDirectory: true,
                cacheCompression: isEnvProduction,
                compact: isEnvProduction,
              },
            },
            // Processe qualquer JS fora do aplicativo com o Babel.
            // Ao contrário do aplicativo JS, nós apenas compilamos os recursos ES padrão.
            {
              test: /\.(js|mjs)$/,
              exclude: /@babel(?:\/|\\{1,2})runtime/,
              loader: require.resolve('babel-loader'),
              options: {
                babelrc: false,
                configFile: false,
                compact: false,
                presets: [
                  [
                    require.resolve('babel-preset-react-app/dependencies'),
                    { helpers: true },
                  ],
                ],
                cacheDirectory: true,
                cacheCompression: isEnvProduction,
                // @remove-on-eject-begin
                cacheIdentifier: getCacheIdentifier(
                  isEnvProduction
                    ? 'production'
                    : isEnvDevelopment && 'development',
                  [
                    'babel-plugin-named-asset-import',
                    'babel-preset-react-app',
                    'react-dev-utils',
                    'anteros-scripts',
                  ]
                ),
                // @remove-on-eject-end
                // Se um erro acontecer em um pacote, é possível ser
                // porque foi compilado. Assim, não queremos o navegador
                // debugger para mostrar o código original. Em vez disso, o código
                // ser avaliado seria muito mais útil.
                sourceMaps: false,
              },
            },
            // O loader "postcss" aplica o autoprefixer ao nosso CSS.
            // O "css" loader resolve os caminhos não CSS e adiciona os assets como dependências.
            // loader "style" transforma CSS JS e injeta tags <style>.
            // Na produção, usado MiniCSSExtractPlugin para extrair esse CSS
            // para um arquivo, mas no carregador "style"
            // de CSS.
            // Por padrão nós suportamos CSS Modules com a extensão .module.css
            {
              test: cssRegex,
              exclude: cssModuleRegex,
              use: getStyleLoaders({
                importLoaders: 1,
                sourceMap: isEnvProduction && shouldUseSourceMap,
              }),
              // Não considere o código morto das importações de CSS, mesmo que o
              // contendo reivindicações de pacote para não ter efeitos colaterais.
              // Remova isso quando o webpack adicionar um aviso ou um erro para isso.
              // See https://github.com/webpack/webpack/issues/6571
              sideEffects: true,
            },
            // Adiciona suporte para módulos CSS (https://github.com/css-modules/css-modules)
            // usando a extensão .module.css
            {
              test: cssModuleRegex,
              use: getStyleLoaders({
                importLoaders: 1,
                sourceMap: isEnvProduction && shouldUseSourceMap,
                modules: true,
                getLocalIdent: getCSSModuleLocalIdent,
              }),
            },
            // Suporte opcional para SASS (usando extensões .scss ou .sass).
            // Por padrão nós suportamos módulos SASS com
            // extensões .module.scss ou .module.sass
            {
              test: sassRegex,
              exclude: sassModuleRegex,
              use: getStyleLoaders(
                {
                  importLoaders: 2,
                  sourceMap: isEnvProduction && shouldUseSourceMap,
                },
                'sass-loader'
              ),
              // Não considere o código morto das importações de CSS, mesmo que
              // contendo reivindicações de pacote para não ter efeitos colaterais.
              // Remova isso quando o webpack adicionar um aviso ou um erro para isso.
              // Veja https://github.com/webpack/webpack/issues/6571
              sideEffects: true,
            },
            // Adiciona suporte para módulos CSS, mas usando SASS
            // usando a extensão .module.scss ou .module.sass
            {
              test: sassModuleRegex,
              use: getStyleLoaders(
                {
                  importLoaders: 2,
                  sourceMap: isEnvProduction && shouldUseSourceMap,
                  modules: true,
                  getLocalIdent: getCSSModuleLocalIdent,
                },
                'sass-loader'
              ),
            },
            // O "file" loader garante que esses recursos sejam atendidos pelo WebpackDevServer.
            // Quando você "importa" um asset, você obtém seu nome de arquivo (virtual).
            // Na produção, eles seriam copiados para a pasta `build`.
            // Este loader não usa um "test" para capturar todos os módulos
            // que caem através dos outros carregadores.
            {
              loader: require.resolve('file-loader'),
              // Exclui arquivos `js` para manter o carregador" css "funcionando enquanto injeta
              // seu tempo de execução que, de outra forma, seria processado pelo carregador "file".
              // Também exclui as extensões `html` e` json` para que sejam processadas
              // por carregadores internos de webpacks.
              exclude: [/\.(js|mjs|jsx|ts|tsx)$/, /\.html$/, /\.json$/],
              options: {
                name: 'static/media/[name].[hash:8].[ext]',
              },
            },
            // ** STOP ** Você está adicionando um novo carregador?
            // Certifique-se de adicionar o (s) novo (s) carregador (s) antes do carregador de "arquivos".
          ],
        },
      ],
    },
    plugins: [
      // Gera um arquivo `index.html` com o <script> injetado.
      new HtmlWebpackPlugin(
        Object.assign(
          {},
          {
            inject: true,
            template: paths.appHtml,
          },
          isEnvProduction
            ? {
                minify: {
                  removeComments: true,
                  collapseWhitespace: true,
                  removeRedundantAttributes: true,
                  useShortDoctype: true,
                  removeEmptyAttributes: true,
                  removeStyleLinkTypeAttributes: true,
                  keepClosingSlash: true,
                  minifyJS: true,
                  minifyCSS: true,
                  minifyURLs: true,
                },
              }
            : undefined
        )
      ),
      // Inscreve o script de tempo de execução do webpack. Este script é muito pequeno para justificar
      // um pedido de rede.
      isEnvProduction &&
        shouldInlineRuntimeChunk &&
        new InlineChunkHtmlPlugin(HtmlWebpackPlugin, [/runtime~.+[.]js/]),
      // Torna algumas variáveis ​​de ambiente disponíveis em index.html.
      // O URL público está disponível como% PUBLIC_URL% em index.html, por exemplo:
      // <link rel="ícone de atalho" href="%PUBLIC_URL%/favicon.ico">
      // Na produção, será uma string vazia, a menos que você especifique "homepage"
      // em `package.json`, caso em que será o nome do caminho dessa URL.
      // Em desenvolvimento, esta será uma string vazia.
      new InterpolateHtmlPlugin(HtmlWebpackPlugin, env.raw),
      // Isso fornece algum contexto necessário para os erros do módulo não encontrados, como
      // o recurso solicitante.
      new ModuleNotFoundPlugin(paths.appPath),
      // Torna algumas variáveis ​​de ambiente disponíveis para o código JS, por exemplo:
      // if (process.env.NODE_ENV === 'production') {...}. Veja `./Env.js`.
      // É absolutamente essencial que o NODE_ENV esteja configurado para produção
      // durante uma compilação de produção.
      // Caso contrário, o React será compilado no modo de desenvolvimento muito lento.
      new webpack.DefinePlugin(env.stringified),
      // Isto é necessário para emitir atualizações quentes (atualmente somente CSS):
      isEnvDevelopment && new webpack.HotModuleReplacementPlugin(),
      // Watcher não funciona bem se você digitar incorretamente em um caminho, então usamos
      // um plugin que imprime um erro quando você tenta fazer isso.
      isEnvDevelopment && new CaseSensitivePathsPlugin(),
      // Se você precisar de um módulo faltando e então executar `npm install` para ele, você ainda tem
      // que reiniciar o servidor de desenvolvimento do Webpack para descobri-lo. Este plugin
      // torna a descoberta automática, para que você não precise reiniciar.
      isEnvDevelopment &&
        new WatchMissingNodeModulesPlugin(paths.appNodeModules),
      isEnvProduction &&
        new MiniCssExtractPlugin({
          // Opções semelhantes às mesmas opções em webpackOptions.output
          // ambas as opções são opcionais
          filename: 'static/css/[name].[contenthash:8].css',
          chunkFilename: 'static/css/[name].[contenthash:8].chunk.css',
        }),
      // Gera um arquivo de manifesto que contém um mapeamento de todos os nomes de arquivos de ativos
      // para o arquivo de saída correspondente para que as ferramentas possam pegá-lo sem
      // ter que analisar `index.html`.
      new ManifestPlugin({
        fileName: 'asset-manifest.json',
        publicPath: publicPath,
      }),
      // Moment.js é uma biblioteca extremamente popular que agrupa grandes arquivos de código de idioma
      // por padrão, devido a como o Webpack interpreta seu código. Esta é uma prática
      // solução que exige que o usuário opte pela importação de localidades específicas.
      // https://github.com/jmblog/how-to-optimize-momentjs-with-webpack
      // Você pode remover isso se você não usar Moment.js:
      new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
      // Gere um script de service worker que precache e mantenha-se atualizado
      // o HTML e os recursos que fazem parte da compilação do Webpack.
      isEnvProduction &&
        new WorkboxWebpackPlugin.GenerateSW({
          clientsClaim: true,
          exclude: [/\.map$/, /asset-manifest\.json$/],
          importWorkboxFrom: 'cdn',
          navigateFallback: publicUrl + '/index.html',
          navigateFallbackBlacklist: [
            // Exclui URLs que começam com /_, pois provavelmente são uma chamada de API
            new RegExp('^/_'),
            // Exclui URLs que contenham um ponto, pois é provável que seja um recurso em
            // público / e não uma rota de SPA
            new RegExp('/[^/]+\\.[^/]+$'),
          ],
        }),
      // Verificação do tipo de TypeScript
      useTypeScript &&
        new ForkTsCheckerWebpackPlugin({
          typescript: resolve.sync('typescript', {
            basedir: paths.appNodeModules,
          }),
          async: false,
          checkSyntacticErrors: true,
          tsconfig: paths.appTsConfig,
          compilerOptions: {
            module: 'esnext',
            moduleResolution: 'node',
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: 'preserve',
          },
          reportFiles: [
            '**',
            '!**/*.json',
            '!**/__tests__/**',
            '!**/?(*.)(spec|test).*',
            '!**/src/setupProxy.*',
            '!**/src/setupTests.*',
          ],
          watch: paths.appSrc,
          silent: true,
          formatter: typescriptFormatter,
        }),
    ].filter(Boolean),
    // Algumas bibliotecas importam módulos do Node, mas não as utilizam no navegador.
    // Diz ao Webpack para fornecer mensagens vazias para eles, então importá-los funciona.
    node: {
      dgram: 'empty',
      fs: 'empty',
      net: 'empty',
      tls: 'empty',
      child_process: 'empty',
    },
    // Desativar o processamento de desempenho porque utilizamos
    // nossas próprias dicas através do FileSizeReporter
    performance: false,
  };
};
